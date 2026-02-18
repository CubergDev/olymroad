import type {
  EntityStatus,
  GoalPeriod,
  OlympiadFormat,
  PlanStatus,
  PrepType,
  RegistrationStatus,
  ResultStatus,
  StageChecklist,
  UserRole,
} from "./types";

export const isUserRole = (value: string): value is UserRole =>
  value === "student" || value === "teacher" || value === "admin";

export const isOlympiadFormat = (value: string): value is OlympiadFormat =>
  value === "online" || value === "offline" || value === "mixed";

export const isRegistrationStatus = (value: string): value is RegistrationStatus =>
  value === "planned" ||
  value === "registered" ||
  value === "participated" ||
  value === "result_added";

export const isPrepType = (value: string): value is PrepType =>
  value === "theory" || value === "problems" || value === "mock_exam";

export const isResultStatus = (value: string): value is ResultStatus =>
  value === "participant" || value === "prize_winner" || value === "winner";

export const isGoalPeriod = (value: string): value is GoalPeriod =>
  value === "week" || value === "month";

export const isEntityStatus = (value: string): value is EntityStatus =>
  value === "draft" || value === "published" || value === "archived";

export const isPlanStatus = (value: string): value is PlanStatus =>
  value === "draft" ||
  value === "active" ||
  value === "completed" ||
  value === "cancelled";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const getString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getNullableString = (value: unknown): string | null | undefined => {
  if (value === null) {
    return null;
  }
  if (typeof value === "undefined") {
    return undefined;
  }
  return getString(value);
};

export const getBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

export const getNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const getInteger = (value: unknown): number | null => {
  const parsed = getNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
};

export const getDateString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

export const getUuidString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalized
  )
    ? normalized
    : null;
};

export const normalizeChecklist = (value: unknown): StageChecklist => {
  const fallback: StageChecklist = {
    documents_required: [],
    consent_required: false,
    fee_amount: null,
    platform_name: null,
    platform_url: null,
  };

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    documents_required: Array.isArray(value.documents_required)
      ? value.documents_required.filter(
          (entry): entry is string => typeof entry === "string"
        )
      : [],
    consent_required:
      typeof value.consent_required === "boolean" ? value.consent_required : false,
    fee_amount: typeof value.fee_amount === "number" ? value.fee_amount : null,
    platform_name:
      typeof value.platform_name === "string" ? value.platform_name : null,
    platform_url: typeof value.platform_url === "string" ? value.platform_url : null,
  };
};

export const registrationTransitionMap: Record<
  Exclude<RegistrationStatus, "result_added">,
  RegistrationStatus
> = {
  planned: "registered",
  registered: "participated",
  participated: "result_added",
};
