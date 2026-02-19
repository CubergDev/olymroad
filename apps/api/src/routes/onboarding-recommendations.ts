import type { Elysia } from "elysia";
import { requireUser } from "../auth";
import { sql } from "../db";
import { fail, failForDbError } from "../http";
import { CONFIG } from "../config";
import { getInteger, getNullableString, isRecord } from "../validation";

type SubjectRow = {
  id: number;
  code: string;
  name_ru: string;
  name_kz: string;
};

type DbRecommendationRow = {
  id: number;
  title: string;
  season: string;
  format: string;
  organizer: string | null;
  rules_url: string | null;
  subject_code: string;
  subject_name_ru: string;
  subject_name_kz: string;
  level_name_ru: string;
  level_name_kz: string;
  next_deadline: string | null;
};

type DbRecommendation = {
  id: number;
  title: string;
  season: string;
  format: string;
  organizer: string | null;
  rules_url: string | null;
  subject_code: string;
  subject_name_ru: string;
  subject_name_kz: string;
  subject_label: string;
  level_label: string;
  next_deadline: string | null;
};

type AiWebPick = {
  title: string;
  organizer: string | null;
  why_fit: string;
  fit_score: number;
  expected_deadline: string | null;
  source_name: string | null;
  source_url: string | null;
};

type AiRecommendations = {
  model: string;
  prompt_used: string;
  summary: string;
  goal_alignment: string[];
  web_picks: AiWebPick[];
  plan_30_days: string[];
};

const normalizeText = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N}\s-]+/gu, "").trim();

const toIsoDate = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const raw = String(value);
  if (raw.length >= 10) {
    return raw.slice(0, 10);
  }
  return null;
};

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => entry !== null);
};

const asNullableString = (value: unknown): string | null => {
  if (value === null) {
    return null;
  }
  return asString(value);
};

const asFitScore = (value: unknown): number => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;
  if (!Number.isFinite(parsed)) {
    return 50;
  }
  return Math.max(1, Math.min(100, Math.round(parsed)));
};

const localeLanguageName = (locale: string): string => {
  if (locale === "ru") {
    return "Russian";
  }
  if (locale === "kz") {
    return "Kazakh";
  }
  return "English";
};

const buildOnboardingPrompt = (input: {
  locale: string;
  grade: number;
  directions: string[];
  goalsText: string;
  dbRecommendations: DbRecommendation[];
}): string => {
  const language = localeLanguageName(input.locale);
  const shortlist = input.dbRecommendations.slice(0, 8).map((item) => ({
    title: item.title,
    subject: item.subject_label,
    level: item.level_label,
    season: item.season,
    next_deadline: item.next_deadline,
    rules_url: item.rules_url,
    organizer: item.organizer,
  }));

  return [
    "You are an OlymRoad olympiad strategy advisor.",
    `Respond only in ${language}.`,
    "Use web search for current, real olympiad announcements and official sources.",
    "Prioritize factual deadlines, official registration pages, and opportunities relevant to Kazakhstan students.",
    "Do not invent URLs or deadlines; when unknown, return null.",
    "Balance ambition and feasibility for a school student.",
    "",
    "Student profile:",
    `- Grade: ${input.grade}`,
    `- Directions: ${input.directions.join(", ")}`,
    `- Goals: ${input.goalsText}`,
    "",
    "Internal DB shortlist (prefer these when strong fit):",
    JSON.stringify(shortlist, null, 2),
    "",
    "Create:",
    "1) concise strategic summary tailored to goals,",
    "2) specific goal-alignment bullets,",
    "3) up to 6 web picks with sources and fit score (1..100),",
    "4) practical 30-day action plan.",
  ].join("\n");
};

const ONBOARDING_AI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    goal_alignment: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    web_picks: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          organizer: { type: ["string", "null"] },
          why_fit: { type: "string" },
          fit_score: { type: "number" },
          expected_deadline: { type: ["string", "null"] },
          source_name: { type: ["string", "null"] },
          source_url: { type: ["string", "null"] },
        },
        required: [
          "title",
          "organizer",
          "why_fit",
          "fit_score",
          "expected_deadline",
          "source_name",
          "source_url",
        ],
      },
    },
    plan_30_days: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
  },
  required: ["summary", "goal_alignment", "web_picks", "plan_30_days"],
} as const;

const extractResponseOutputText = (payload: unknown): string | null => {
  if (!isRecord(payload)) {
    return null;
  }
  const direct = asString(payload.output_text);
  if (direct) {
    return direct;
  }
  if (!Array.isArray(payload.output)) {
    return null;
  }

  for (const outputItem of payload.output) {
    if (!isRecord(outputItem) || outputItem.type !== "message" || !Array.isArray(outputItem.content)) {
      continue;
    }
    for (const contentItem of outputItem.content) {
      if (!isRecord(contentItem) || contentItem.type !== "output_text") {
        continue;
      }
      const text = asString(contentItem.text);
      if (text) {
        return text;
      }
    }
  }

  return null;
};

const mapAiRecommendations = (payload: unknown): Omit<AiRecommendations, "model" | "prompt_used"> | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const summary = asString(payload.summary);
  if (!summary) {
    return null;
  }

  const goalAlignment = asStringArray(payload.goal_alignment);
  const plan30Days = asStringArray(payload.plan_30_days);
  const webPicksRaw = Array.isArray(payload.web_picks) ? payload.web_picks : [];
  const webPicks: AiWebPick[] = webPicksRaw
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const title = asString(entry.title);
      const whyFit = asString(entry.why_fit);
      if (!title || !whyFit) {
        return null;
      }
      return {
        title,
        organizer: asNullableString(entry.organizer),
        why_fit: whyFit,
        fit_score: asFitScore(entry.fit_score),
        expected_deadline: asNullableString(entry.expected_deadline),
        source_name: asNullableString(entry.source_name),
        source_url: asNullableString(entry.source_url),
      };
    })
    .filter((entry): entry is AiWebPick => entry !== null);

  return {
    summary,
    goal_alignment: goalAlignment,
    web_picks: webPicks,
    plan_30_days: plan30Days,
  };
};

const resolveSubjectLabel = (
  row: Pick<DbRecommendationRow, "subject_code" | "subject_name_ru" | "subject_name_kz">,
  locale: string
): string => {
  if (locale === "kz") {
    return row.subject_name_kz || row.subject_name_ru || row.subject_code;
  }
  if (locale === "en") {
    return row.subject_code;
  }
  return row.subject_name_ru || row.subject_code;
};

const resolveLevelLabel = (
  row: Pick<DbRecommendationRow, "level_name_ru" | "level_name_kz">,
  locale: string
): string => {
  if (locale === "kz") {
    return row.level_name_kz || row.level_name_ru;
  }
  return row.level_name_ru;
};

const findMatchingSubjectIds = (directions: string[], subjects: SubjectRow[]): number[] => {
  const normalizedDirections = directions
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0);
  if (normalizedDirections.length === 0) {
    return [];
  }

  return subjects
    .filter((subject) => {
      const aliases = [
        normalizeText(subject.code),
        normalizeText(subject.name_ru),
        normalizeText(subject.name_kz),
      ].filter((value) => value.length > 0);
      return normalizedDirections.some((direction) =>
        aliases.some(
          (alias) =>
            direction === alias ||
            direction.includes(alias) ||
            alias.includes(direction)
        )
      );
    })
    .map((subject) => subject.id);
};

const fetchDbRecommendations = async (
  directions: string[],
  locale: string
): Promise<DbRecommendation[]> => {
  const subjectRows = await sql`
    SELECT id, code, name_ru, name_kz
    FROM subjects
    WHERE is_active = TRUE
  `;
  const subjects = subjectRows as SubjectRow[];
  const matchedSubjectIds = findMatchingSubjectIds(directions, subjects);

  const rows = await sql`
    WITH base AS (
      SELECT
        o.id,
        o.title,
        o.season,
        o.format::text AS format,
        o.organizer,
        o.rules_url,
        sub.code AS subject_code,
        sub.name_ru AS subject_name_ru,
        sub.name_kz AS subject_name_kz,
        lvl.name_ru AS level_name_ru,
        lvl.name_kz AS level_name_kz,
        COALESCE(
          MIN(CASE WHEN s.registration_deadline >= CURRENT_DATE THEN s.registration_deadline END),
          MIN(s.registration_deadline)
        ) AS next_deadline,
        o.updated_at
      FROM olympiads o
      INNER JOIN subjects sub ON sub.id = o.subject_id
      INNER JOIN levels lvl ON lvl.id = o.level_id
      LEFT JOIN stages s ON s.olympiad_id = o.id AND s.status = 'published'
      WHERE
        o.status = 'published'
        AND (
          jsonb_array_length(${matchedSubjectIds}::jsonb) = 0
          OR o.subject_id IN (
            SELECT CAST(value AS integer)
            FROM jsonb_array_elements_text(${matchedSubjectIds}::jsonb)
          )
        )
      GROUP BY
        o.id,
        sub.code,
        sub.name_ru,
        sub.name_kz,
        lvl.name_ru,
        lvl.name_kz
    )
    SELECT
      id,
      title,
      season,
      format,
      organizer,
      rules_url,
      subject_code,
      subject_name_ru,
      subject_name_kz,
      level_name_ru,
      level_name_kz,
      next_deadline
    FROM base
    ORDER BY
      CASE WHEN next_deadline IS NULL THEN 1 ELSE 0 END,
      next_deadline ASC,
      updated_at DESC
    LIMIT 12
  `;

  return (rows as DbRecommendationRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    season: row.season,
    format: row.format,
    organizer: row.organizer,
    rules_url: row.rules_url,
    subject_code: row.subject_code,
    subject_name_ru: row.subject_name_ru,
    subject_name_kz: row.subject_name_kz,
    subject_label: resolveSubjectLabel(row, locale),
    level_label: resolveLevelLabel(row, locale),
    next_deadline: toIsoDate(row.next_deadline),
  }));
};

const generateAiRecommendations = async (input: {
  locale: string;
  grade: number;
  directions: string[];
  goalsText: string;
  dbRecommendations: DbRecommendation[];
}): Promise<AiRecommendations> => {
  const prompt = buildOnboardingPrompt(input);
  const model = CONFIG.ai.openaiModelFast;
  const endpoint = `${CONFIG.ai.openaiApiBaseUrl}/responses`;

  const requestBody = {
    model,
    input: prompt,
    tools: [
      {
        type: "web_search_preview",
        search_context_size: "medium",
        user_location: {
          type: "approximate",
          country: "KZ",
          timezone: CONFIG.appTimezone,
        },
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "onboarding_recommendations",
        schema: ONBOARDING_AI_SCHEMA,
        strict: true,
      },
    },
    temperature: 0.3,
    max_output_tokens: 1300,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.ai.openaiApiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  const responseJson = await response.json();
  if (!response.ok) {
    throw new Error(`openai_http_${response.status}`);
  }

  const outputText = extractResponseOutputText(responseJson);
  if (!outputText) {
    throw new Error("openai_empty_output");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("openai_invalid_json");
  }

  const mapped = mapAiRecommendations(parsed);
  if (!mapped) {
    throw new Error("openai_invalid_schema");
  }

  return {
    model,
    prompt_used: prompt,
    ...mapped,
  };
};

export const registerOnboardingRecommendationRoutes = (app: Elysia) => {
  app.post("/me/onboarding/recommendations", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (user.role !== "student") {
      return fail(set, 403, "forbidden", "Only students can generate onboarding recommendations.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    if (!Object.prototype.hasOwnProperty.call(body, "directions")) {
      return fail(set, 400, "validation_error", "directions are required.");
    }
    if (!Array.isArray(body.directions)) {
      return fail(set, 400, "validation_error", "directions must be an array of strings.");
    }

    const directions = (body.directions as unknown[])
      .map((entry) => asString(entry))
      .filter((entry): entry is string => entry !== null);
    if (directions.length === 0) {
      return fail(set, 400, "validation_error", "directions must include at least one item.");
    }

    const goalsText = getNullableString(body.goals_text);
    if (typeof goalsText === "undefined" || goalsText === null || goalsText.trim().length === 0) {
      return fail(set, 400, "validation_error", "goals_text must be a non-empty string.");
    }

    const grade = body.grade === null ? null : getInteger(body.grade);
    if (grade === null || grade < 1 || grade > 12) {
      return fail(set, 400, "validation_error", "grade must be between 1 and 12.");
    }

    try {
      const dbRecommendations = await fetchDbRecommendations(directions, user.locale);
      const warnings: string[] = [];
      let aiRecommendations: AiRecommendations | null = null;

      if (!CONFIG.ai.enabled) {
        warnings.push("ai_not_configured");
      } else {
        try {
          aiRecommendations = await generateAiRecommendations({
            locale: user.locale,
            grade,
            directions,
            goalsText,
            dbRecommendations,
          });
        } catch {
          warnings.push("ai_generation_failed");
        }
      }

      return {
        generated_at: new Date().toISOString(),
        directions,
        goals_text: goalsText.trim(),
        grade,
        db_recommendations: dbRecommendations,
        ai_recommendations: aiRecommendations,
        warnings,
      };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "onboarding_recommendations_failed",
        "Failed to generate onboarding recommendations."
      );
    }
  });
};
