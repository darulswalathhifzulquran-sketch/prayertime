import { applyOffset, FIVE, toMinutes, type PrayerKey, type Timings } from "./prayer";

export type FiveKey = Exclude<PrayerKey, "Sunrise">;
export type FiveTimings = Record<FiveKey, string>;
export type LocalTimetable = {
  dateKey: string;
  times: FiveTimings;
  offsets: Record<FiveKey, number>;
  autoAdjust: boolean;
};

/** Rounded to ~1 km so exact GPS values are never saved by this feature. */
export const gpsReferenceScope = (lat: number, lng: number) =>
  "gps:" + lat.toFixed(2) + ":" + lng.toFixed(2);

export const localTimetableKey = (scope: string) => "kpt:local-timetable:v1:" + scope;
const VALID_TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function isFiveTimings(value: unknown): value is FiveTimings {
  if (!value || typeof value !== "object") return false;
  return FIVE.every((key) => {
    const time = (value as Record<string, unknown>)[key];
    return typeof time === "string" && VALID_TIME.test(time);
  });
}

export function readLocalTimetable(scope: string): LocalTimetable | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const content = localStorage.getItem(localTimetableKey(scope));
    if (!content) return null;
    const value: unknown = JSON.parse(content);
    if (!value || typeof value !== "object") return null;
    const r = value as LocalTimetable;
    if (!/^\d{2}-\d{2}-\d{4}$/.test(r.dateKey) || !isFiveTimings(r.times) ||
        !r.offsets || typeof r.offsets !== "object" || typeof r.autoAdjust !== "boolean" ||
        !FIVE.every((key) => Number.isInteger(r.offsets[key as FiveKey]) && Math.abs(r.offsets[key as FiveKey]) <= 180)) {
      return null;
    }
    return r;
  } catch {
    return null;
  }
}

export function makeLocalTimetable(dateKey: string, times: FiveTimings, calculated: Timings, autoAdjust: boolean): LocalTimetable {
  if (!isFiveTimings(times)) throw new Error("Enter all five times in HH:MM format.");
  const offsets = {} as Record<FiveKey, number>;
  for (const key of FIVE as FiveKey[]) {
    const delta = toMinutes(times[key]) - toMinutes(calculated[key]);
    if (autoAdjust && Math.abs(delta) > 180) {
      throw new Error("Difference exceeds 3 hours; please check the location and entered times.");
    }
    offsets[key] = Math.max(-180, Math.min(180, delta));
  }
  return { dateKey, times, offsets, autoAdjust };
}

export function applyLocalTimetable(
  api: Timings | undefined, reference: LocalTimetable | null, dateKey: string,
): { timings: Timings | undefined; source: "api" | "manual" | "adjusted" } {
  if (!api || !reference) return { timings: api, source: "api" };
  const timings = { ...api };
  if (reference.dateKey === dateKey) {
    for (const key of FIVE as FiveKey[]) timings[key] = reference.times[key];
    return { timings, source: "manual" };
  }
  if (reference.autoAdjust) {
    for (const key of FIVE as FiveKey[]) timings[key] = applyOffset(api[key], reference.offsets[key]);
    return { timings, source: "adjusted" };
  }
  return { timings: api, source: "api" };
}
