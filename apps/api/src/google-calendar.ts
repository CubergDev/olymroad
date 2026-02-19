type UnknownRecord = Record<string, unknown>;

const GOOGLE_USER_INFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (source: UnknownRecord, key: string): string | null => {
  const value = source[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readNumber = (source: UnknownRecord, key: string): number | null => {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export class GoogleApiError extends Error {
  status: number;
  reason: string | null;
  details: unknown;

  constructor(
    status: number,
    message: string,
    reason: string | null = null,
    details: unknown = null
  ) {
    super(message);
    this.name = "GoogleApiError";
    this.status = status;
    this.reason = reason;
    this.details = details;
  }
}

const toGoogleApiError = (
  status: number,
  payload: unknown,
  fallbackMessage: string
): GoogleApiError => {
  if (isRecord(payload) && isRecord(payload.error)) {
    const message = readString(payload.error, "message") ?? fallbackMessage;
    let reason: string | null = null;
    const errors = payload.error.errors;
    if (Array.isArray(errors) && errors.length > 0 && isRecord(errors[0])) {
      reason = readString(errors[0], "reason");
    }
    return new GoogleApiError(status, message, reason, payload);
  }

  if (typeof payload === "string" && payload.trim().length > 0) {
    return new GoogleApiError(status, payload, null, payload);
  }

  return new GoogleApiError(status, fallbackMessage, null, payload);
};

const googleApiRequest = async <T>(
  accessToken: string,
  url: string,
  init: RequestInit = {}
): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  let requestBody = init.body;
  if (
    requestBody &&
    typeof requestBody === "object" &&
    !(requestBody instanceof ArrayBuffer) &&
    !(requestBody instanceof Blob) &&
    !(requestBody instanceof URLSearchParams) &&
    !(requestBody instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(requestBody);
  }

  const response = await fetch(url, {
    ...init,
    headers,
    body: requestBody,
  });

  const payload = await parseJsonSafely(response);
  if (!response.ok) {
    throw toGoogleApiError(
      response.status,
      payload,
      "Google API request failed."
    );
  }

  return payload as T;
};

const normalizeScope = (rawScope: string | null): string[] => {
  if (!rawScope) {
    return [];
  }
  return rawScope
    .split(" ")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const addDaysToDate = (dateIso: string, days: number): string => {
  const [yyyy, mm, dd] = dateIso.split("-").map((part) => Number(part));
  if (!yyyy || !mm || !dd) {
    return dateIso;
  }
  const asUtc = new Date(Date.UTC(yyyy, mm - 1, dd));
  asUtc.setUTCDate(asUtc.getUTCDate() + days);
  return asUtc.toISOString().slice(0, 10);
};

export type GoogleCalendarTokenIdentity = {
  providerAccountId: string;
  email: string | null;
  name: string | null;
  scope: string[];
  tokenExpiresAt: string | null;
};

export const verifyGoogleCalendarAccessToken = async (
  accessToken: string
): Promise<GoogleCalendarTokenIdentity | null> => {
  try {
    const userInfoResponse = await fetch(GOOGLE_USER_INFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!userInfoResponse.ok) {
      return null;
    }

    const userInfoPayload = await userInfoResponse.json();
    if (!isRecord(userInfoPayload)) {
      return null;
    }

    const providerAccountId = readString(userInfoPayload, "sub");
    if (!providerAccountId) {
      return null;
    }

    const email = readString(userInfoPayload, "email");
    const name = readString(userInfoPayload, "name");

    const tokenInfoUrl = new URL(GOOGLE_TOKEN_INFO_URL);
    tokenInfoUrl.searchParams.set("access_token", accessToken);
    const tokenInfoResponse = await fetch(tokenInfoUrl);

    let scope: string[] = [];
    let tokenExpiresAt: string | null = null;
    if (tokenInfoResponse.ok) {
      const tokenInfoPayload = await tokenInfoResponse.json();
      if (isRecord(tokenInfoPayload)) {
        scope = normalizeScope(readString(tokenInfoPayload, "scope"));
        const expiresInSeconds = readNumber(tokenInfoPayload, "expires_in");
        if (expiresInSeconds !== null && expiresInSeconds > 0) {
          tokenExpiresAt = new Date(
            Date.now() + expiresInSeconds * 1000
          ).toISOString();
        }
      }
    }

    return {
      providerAccountId,
      email,
      name,
      scope,
      tokenExpiresAt,
    };
  } catch {
    return null;
  }
};

export const hasGoogleCalendarScope = (scope: string[]): boolean => {
  const allowedScopes = new Set([
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly",
  ]);
  return scope.some((entry) => allowedScopes.has(entry));
};

type GoogleCalendarListEventsResponse = {
  items?: unknown[];
  nextPageToken?: string;
};

const parseGoogleEventBoundary = (
  value: unknown
): { iso: string; allDay: boolean } | null => {
  if (!isRecord(value)) {
    return null;
  }

  const dateTime = readString(value, "dateTime");
  if (dateTime) {
    const parsed = new Date(dateTime);
    if (!Number.isNaN(parsed.getTime())) {
      return { iso: parsed.toISOString(), allDay: false };
    }
  }

  const date = readString(value, "date");
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { iso: `${date}T00:00:00.000Z`, allDay: true };
  }

  return null;
};

export type ImportedGoogleCalendarEvent = {
  providerEventId: string;
  calendarId: string;
  summary: string | null;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  htmlLink: string | null;
  isCancelled: boolean;
  rawJson: UnknownRecord;
};

export const listGoogleCalendarEvents = async (input: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
  maxResults?: number;
}): Promise<ImportedGoogleCalendarEvent[]> => {
  const maxResults =
    typeof input.maxResults === "number" && input.maxResults > 0
      ? Math.min(Math.floor(input.maxResults), 2500)
      : 2500;

  const items: ImportedGoogleCalendarEvent[] = [];
  let nextPageToken: string | null = null;

  do {
    const url = new URL(
      `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(
        input.calendarId
      )}/events`
    );
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("showDeleted", "true");
    url.searchParams.set("timeMin", input.timeMin);
    url.searchParams.set("timeMax", input.timeMax);
    url.searchParams.set("maxResults", String(maxResults));
    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken);
    }

    const payload = await googleApiRequest<GoogleCalendarListEventsResponse>(
      input.accessToken,
      url.toString()
    );
    const pageItems = Array.isArray(payload.items) ? payload.items : [];

    for (const item of pageItems) {
      if (!isRecord(item)) {
        continue;
      }

      const providerEventId = readString(item, "id");
      if (!providerEventId) {
        continue;
      }

      const startBoundary =
        parseGoogleEventBoundary(item.start) ??
        parseGoogleEventBoundary(item.originalStartTime);
      if (!startBoundary) {
        continue;
      }

      const endBoundary = parseGoogleEventBoundary(item.end);
      items.push({
        providerEventId,
        calendarId: input.calendarId,
        summary: readString(item, "summary"),
        description: readString(item, "description"),
        location: readString(item, "location"),
        startsAt: startBoundary.iso,
        endsAt: endBoundary?.iso ?? null,
        allDay: startBoundary.allDay,
        htmlLink: readString(item, "htmlLink"),
        isCancelled: readString(item, "status") === "cancelled",
        rawJson: item,
      });
    }

    nextPageToken =
      typeof payload.nextPageToken === "string" &&
      payload.nextPageToken.trim().length > 0
        ? payload.nextPageToken
        : null;
  } while (nextPageToken);

  return items;
};

export type GoogleCalendarStageExportPayload = {
  summary: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string | null;
  sourceUrl: string | null;
};

const toGoogleEventPayload = (payload: GoogleCalendarStageExportPayload) => {
  const endDateExclusive = addDaysToDate(payload.endDate ?? payload.startDate, 1);

  return {
    summary: payload.summary,
    description: payload.description ?? undefined,
    location: payload.location ?? undefined,
    start: { date: payload.startDate },
    end: { date: endDateExclusive },
    source: payload.sourceUrl
      ? {
          title: "OlymRoad",
          url: payload.sourceUrl,
        }
      : undefined,
  };
};

export const upsertGoogleCalendarStageEvent = async (input: {
  accessToken: string;
  calendarId: string;
  eventId: string | null;
  payload: GoogleCalendarStageExportPayload;
}): Promise<{ eventId: string; htmlLink: string | null; created: boolean }> => {
  const eventPayload = toGoogleEventPayload(input.payload);

  if (input.eventId) {
    try {
      const updated = await googleApiRequest<UnknownRecord>(
        input.accessToken,
        `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(
          input.calendarId
        )}/events/${encodeURIComponent(input.eventId)}`,
        {
          method: "PATCH",
          body: eventPayload,
        }
      );
      const id = readString(updated, "id");
      if (id) {
        return {
          eventId: id,
          htmlLink: readString(updated, "htmlLink"),
          created: false,
        };
      }
    } catch (error) {
      if (!(error instanceof GoogleApiError) || error.status !== 404) {
        throw error;
      }
    }
  }

  const created = await googleApiRequest<UnknownRecord>(
    input.accessToken,
    `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(
      input.calendarId
    )}/events`,
    {
      method: "POST",
      body: eventPayload,
    }
  );
  const createdEventId = readString(created, "id");
  if (!createdEventId) {
    throw new GoogleApiError(
      500,
      "Google Calendar API did not return event id."
    );
  }

  return {
    eventId: createdEventId,
    htmlLink: readString(created, "htmlLink"),
    created: true,
  };
};

export const deleteGoogleCalendarEvent = async (input: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<void> => {
  try {
    await googleApiRequest<unknown>(
      input.accessToken,
      `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(
        input.calendarId
      )}/events/${encodeURIComponent(input.eventId)}`,
      { method: "DELETE" }
    );
  } catch (error) {
    if (error instanceof GoogleApiError && error.status === 404) {
      return;
    }
    throw error;
  }
};

export const isGoogleUnauthorizedError = (error: unknown): boolean =>
  error instanceof GoogleApiError &&
  (error.status === 401 || error.status === 403);
