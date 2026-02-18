import { CONFIG } from "./config";

const MINUTE_MS = 60 * 1000;

const getDateInOffset = (source: Date, offsetMinutes: number): Date => {
  const utcMs = source.getTime() + source.getTimezoneOffset() * MINUTE_MS;
  return new Date(utcMs + offsetMinutes * MINUTE_MS);
};

export const getNowInConfiguredOffset = (): Date =>
  getDateInOffset(new Date(), CONFIG.appTimezoneOffsetMinutes);

export const getCurrentDateInConfiguredOffset = (): string =>
  getNowInConfiguredOffset().toISOString().slice(0, 10);

export const getDateDaysAgoInConfiguredOffset = (daysAgo: number): string => {
  const date = getNowInConfiguredOffset();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
};

export const getWeekStartInConfiguredOffset = (): string => {
  const date = getNowInConfiguredOffset();
  const day = date.getUTCDay();
  const shift = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + shift);
  return date.toISOString().slice(0, 10);
};

export const getMonthStartInConfiguredOffset = (): string => {
  const date = getNowInConfiguredOffset();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
};
