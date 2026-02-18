import type { Elysia } from "elysia";
import { requireRole, requireUser } from "../auth";
import { first, sql } from "../db";
import { fail } from "../http";
import { getInteger } from "../validation";
import {
  getDateDaysAgoInConfiguredOffset,
  getMonthStartInConfiguredOffset,
  getWeekStartInConfiguredOffset,
} from "../time";

const asNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const pearson = (x: number[], y: number[]): number | null => {
  if (x.length !== y.length || x.length < 2) {
    return null;
  }
  const xMean = mean(x);
  const yMean = mean(y);

  let numerator = 0;
  let xVariance = 0;
  let yVariance = 0;
  for (let index = 0; index < x.length; index += 1) {
    const xDelta = x[index] - xMean;
    const yDelta = y[index] - yMean;
    numerator += xDelta * yDelta;
    xVariance += xDelta * xDelta;
    yVariance += yDelta * yDelta;
  }

  const denominator = Math.sqrt(xVariance * yVariance);
  if (denominator === 0) {
    return null;
  }
  return numerator / denominator;
};

export const registerAnalyticsRoutes = (app: Elysia) => {
  app.get("/analytics/me/scores", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can view analytics.");
    }

    const limit = query.limit ? getInteger(query.limit) : 100;
    if (!limit || limit <= 0 || limit > 1000) {
      return fail(set, 400, "validation_error", "limit must be between 1 and 1000.");
    }

    try {
      const items = await sql`
        SELECT
          r.stage_id,
          r.score,
          r.place,
          r.status,
          r.created_at,
          st.name AS stage_name,
          st.date_start,
          o.title AS olympiad_title,
          o.season,
          sub.code AS subject_code
        FROM results r
        INNER JOIN stages st ON st.id = r.stage_id
        INNER JOIN olympiads o ON o.id = st.olympiad_id
        INNER JOIN subjects sub ON sub.id = o.subject_id
        WHERE r.student_id = ${user.id}
        ORDER BY st.date_start ASC, r.created_at ASC
        LIMIT ${limit}
      `;

      const scoreValues = (items as Array<Record<string, unknown>>).map((row) =>
        asNumber(row.score)
      );

      return {
        items,
        summary: {
          count: scoreValues.length,
          average_score:
            scoreValues.length > 0
              ? scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length
              : null,
          best_score: scoreValues.length > 0 ? Math.max(...scoreValues) : null,
          latest_score:
            scoreValues.length > 0 ? scoreValues[scoreValues.length - 1] : null,
        },
      };
    } catch {
      return fail(set, 500, "analytics_scores_failed", "Failed to fetch score analytics.");
    }
  });

  app.get("/analytics/me/activity", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can view analytics.");
    }

    const periodDays = query.period_days ? getInteger(query.period_days) : 90;
    if (!periodDays || periodDays <= 0 || periodDays > 365) {
      return fail(
        set,
        400,
        "validation_error",
        "period_days must be between 1 and 365."
      );
    }

    try {
      const fromDate = getDateDaysAgoInConfiguredOffset(periodDays);
      const daily = await sql`
        SELECT
          date,
          COUNT(*) AS activities_count,
          COALESCE(SUM(duration_minutes), 0)::int AS minutes_total
        FROM prep_activities
        WHERE student_id = ${user.id}
          AND date >= ${fromDate}::date
        GROUP BY date
        ORDER BY date ASC
      `;

      const byType = await sql`
        SELECT
          type,
          COUNT(*) AS activities_count,
          COALESCE(SUM(duration_minutes), 0)::int AS minutes_total
        FROM prep_activities
        WHERE student_id = ${user.id}
          AND date >= ${fromDate}::date
        GROUP BY type
        ORDER BY type ASC
      `;

      const totalMinutes = (daily as Array<Record<string, unknown>>).reduce(
        (sum, row) => sum + asNumber(row.minutes_total),
        0
      );
      const totalActivities = (daily as Array<Record<string, unknown>>).reduce(
        (sum, row) => sum + asNumber(row.activities_count),
        0
      );

      return {
        period_days: periodDays,
        daily,
        by_type: byType,
        summary: {
          total_minutes: totalMinutes,
          total_activities: totalActivities,
          average_minutes_per_day:
            periodDays > 0 ? totalMinutes / periodDays : 0,
          average_minutes_per_activity:
            totalActivities > 0 ? totalMinutes / totalActivities : 0,
        },
      };
    } catch {
      return fail(
        set,
        500,
        "analytics_activity_failed",
        "Failed to fetch activity analytics."
      );
    }
  });

  app.get("/analytics/me/funnel", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can view analytics.");
    }

    try {
      const counts = await sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'planned') AS planned,
          COUNT(*) FILTER (WHERE status = 'registered') AS registered,
          COUNT(*) FILTER (WHERE status = 'participated') AS participated,
          COUNT(*) FILTER (WHERE status = 'result_added') AS result_added
        FROM registrations
        WHERE student_id = ${user.id}
      `;
      const row = first<Record<string, unknown>>(counts) ?? {};

      const planned = asNumber(row.planned);
      const registered = asNumber(row.registered);
      const participated = asNumber(row.participated);
      const resultAdded = asNumber(row.result_added);
      const total = planned + registered + participated + resultAdded;

      return {
        by_status: {
          planned,
          registered,
          participated,
          result_added: resultAdded,
        },
        total,
        conversion: {
          planned_to_registered: planned > 0 ? registered / planned : null,
          registered_to_participated:
            registered > 0 ? participated / registered : null,
          participated_to_result_added:
            participated > 0 ? resultAdded / participated : null,
        },
      };
    } catch {
      return fail(set, 500, "analytics_funnel_failed", "Failed to fetch funnel analytics.");
    }
  });

  app.get("/analytics/me/correlation", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can view analytics.");
    }

    try {
      const rows = await sql`
        SELECT
          r.stage_id,
          r.score,
          COALESCE(SUM(pa.duration_minutes), 0)::float8 AS prep_minutes
        FROM results r
        LEFT JOIN prep_activities pa
          ON pa.student_id = r.student_id
          AND pa.stage_id = r.stage_id
        WHERE r.student_id = ${user.id}
        GROUP BY r.stage_id, r.score
        ORDER BY r.stage_id ASC
      `;

      const pairs = (rows as Array<Record<string, unknown>>).map((row) => ({
        stage_id: row.stage_id,
        score: asNumber(row.score),
        prep_minutes: asNumber(row.prep_minutes),
      }));

      const correlation = pearson(
        pairs.map((pair) => pair.prep_minutes),
        pairs.map((pair) => pair.score)
      );

      let interpretation = "insufficient_data";
      if (correlation !== null) {
        if (correlation >= 0.5) interpretation = "positive";
        else if (correlation <= -0.5) interpretation = "negative";
        else interpretation = "weak_or_none";
      }

      return {
        sample_size: pairs.length,
        correlation_coefficient: correlation,
        interpretation,
        pairs,
      };
    } catch {
      return fail(
        set,
        500,
        "analytics_correlation_failed",
        "Failed to calculate correlation analytics."
      );
    }
  });

  app.get("/analytics/me/forecast", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can view analytics.");
    }

    try {
      const rows = await sql`
        SELECT score, created_at
        FROM results
        WHERE student_id = ${user.id}
        ORDER BY created_at ASC
      `;
      const scores = (rows as Array<Record<string, unknown>>).map((row) =>
        asNumber(row.score)
      );

      if (scores.length === 0) {
        return {
          sample_size: 0,
          trend: "insufficient_data",
          predicted_next_score: null,
          slope: null,
        };
      }

      if (scores.length === 1) {
        return {
          sample_size: 1,
          trend: "insufficient_data",
          predicted_next_score: scores[0],
          slope: 0,
        };
      }

      const xValues = scores.map((_, index) => index + 1);
      const yMean = mean(scores);
      const xMean = mean(xValues);

      let numerator = 0;
      let denominator = 0;
      for (let index = 0; index < scores.length; index += 1) {
        const xDelta = xValues[index] - xMean;
        numerator += xDelta * (scores[index] - yMean);
        denominator += xDelta * xDelta;
      }

      const slope = denominator === 0 ? 0 : numerator / denominator;
      const intercept = yMean - slope * xMean;
      const predictedNext = slope * (scores.length + 1) + intercept;

      const trend =
        slope > 0.1 ? "improving" : slope < -0.1 ? "declining" : "stable";

      return {
        sample_size: scores.length,
        trend,
        slope,
        predicted_next_score: predictedNext,
      };
    } catch {
      return fail(set, 500, "analytics_forecast_failed", "Failed to build forecast.");
    }
  });

  app.get("/analytics/me/summary", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can view analytics.");
    }

    try {
      const weekStart = getWeekStartInConfiguredOffset();
      const monthStart = getMonthStartInConfiguredOffset();
      const thirtyDaysAgo = getDateDaysAgoInConfiguredOffset(30);

      const recentRows = await sql`
        SELECT
          COUNT(*) AS activities_30d,
          COALESCE(SUM(duration_minutes), 0)::int AS minutes_30d,
          COUNT(*) FILTER (WHERE type = 'mock_exam') AS mock_exams_30d
        FROM prep_activities
        WHERE student_id = ${user.id}
          AND date >= ${thirtyDaysAgo}::date
      `;
      const recent = first<Record<string, unknown>>(recentRows) ?? {};

      const weekGoalRows = await sql`
        SELECT *
        FROM prep_goals
        WHERE student_id = ${user.id} AND period = 'week' AND period_start <= ${weekStart}
        ORDER BY period_start DESC
        LIMIT 1
      `;
      const monthGoalRows = await sql`
        SELECT *
        FROM prep_goals
        WHERE student_id = ${user.id} AND period = 'month' AND period_start <= ${monthStart}
        ORDER BY period_start DESC
        LIMIT 1
      `;
      const weekGoal = first<Record<string, unknown>>(weekGoalRows);
      const monthGoal = first<Record<string, unknown>>(monthGoalRows);

      const weekProgressRows = await sql`
        SELECT
          COALESCE(SUM(duration_minutes), 0)::int AS minutes_done,
          COUNT(*) FILTER (WHERE type = 'problems') AS problems_done,
          COUNT(*) FILTER (WHERE type = 'mock_exam') AS mock_exams_done
        FROM prep_activities
        WHERE student_id = ${user.id}
          AND date >= ${weekStart}
      `;
      const monthProgressRows = await sql`
        SELECT
          COALESCE(SUM(duration_minutes), 0)::int AS minutes_done,
          COUNT(*) FILTER (WHERE type = 'problems') AS problems_done,
          COUNT(*) FILTER (WHERE type = 'mock_exam') AS mock_exams_done
        FROM prep_activities
        WHERE student_id = ${user.id}
          AND date >= ${monthStart}
      `;
      const weekProgress = first<Record<string, unknown>>(weekProgressRows) ?? {};
      const monthProgress = first<Record<string, unknown>>(monthProgressRows) ?? {};

      const resultRows = await sql`
        SELECT COUNT(*) AS results_count, AVG(score) AS average_score
        FROM results
        WHERE student_id = ${user.id}
      `;
      const resultSummary = first<Record<string, unknown>>(resultRows) ?? {};

      const recommendations: string[] = [];

      const recentMocks = asNumber(recent.mock_exams_30d);
      if (recentMocks < 1) {
        recommendations.push("Add at least one mock exam this week.");
      }

      if (weekGoal) {
        const targetMinutes = asNumber(weekGoal.target_minutes);
        const doneMinutes = asNumber(weekProgress.minutes_done);
        if (targetMinutes > 0 && doneMinutes / targetMinutes < 0.5) {
          recommendations.push("Weekly study minutes are below 50% of the goal.");
        }
      }

      if (monthGoal) {
        const targetMinutes = asNumber(monthGoal.target_minutes);
        const doneMinutes = asNumber(monthProgress.minutes_done);
        if (targetMinutes > 0 && doneMinutes / targetMinutes < 0.4) {
          recommendations.push("Monthly study progress is below 40% of target minutes.");
        }
      }

      if (asNumber(resultSummary.results_count) === 0) {
        recommendations.push("Add olympiad results to unlock score trend analytics.");
      }

      if (recommendations.length === 0) {
        recommendations.push("Progress is stable. Keep the current preparation pace.");
      }

      return {
        metrics: {
          activities_30d: asNumber(recent.activities_30d),
          minutes_30d: asNumber(recent.minutes_30d),
          mock_exams_30d: recentMocks,
          results_count: asNumber(resultSummary.results_count),
          average_score: resultSummary.average_score
            ? asNumber(resultSummary.average_score)
            : null,
        },
        week_goal: weekGoal
          ? {
              period_start: weekGoal.period_start,
              target_minutes: asNumber(weekGoal.target_minutes),
              target_problems: asNumber(weekGoal.target_problems),
              target_mock_exams: asNumber(weekGoal.target_mock_exams),
              progress: {
                minutes_done: asNumber(weekProgress.minutes_done),
                problems_done: asNumber(weekProgress.problems_done),
                mock_exams_done: asNumber(weekProgress.mock_exams_done),
              },
            }
          : null,
        month_goal: monthGoal
          ? {
              period_start: monthGoal.period_start,
              target_minutes: asNumber(monthGoal.target_minutes),
              target_problems: asNumber(monthGoal.target_problems),
              target_mock_exams: asNumber(monthGoal.target_mock_exams),
              progress: {
                minutes_done: asNumber(monthProgress.minutes_done),
                problems_done: asNumber(monthProgress.problems_done),
                mock_exams_done: asNumber(monthProgress.mock_exams_done),
              },
            }
          : null,
        recommendations,
      };
    } catch {
      return fail(set, 500, "analytics_summary_failed", "Failed to build analytics summary.");
    }
  });
};
