import { describe, expect, it } from "vitest";
import { applyLocalTimetable, gpsReferenceScope, isFiveTimings, makeLocalTimetable } from "./local-timetable";
import type { Timings } from "./prayer";

const api: Timings = {
  Fajr: "05:06", Sunrise: "06:17", Dhuhr: "12:11",
  Asr: "15:33", Maghrib: "18:05", Isha: "19:13",
};
const local = {
  Fajr: "05:00", Dhuhr: "12:13", Asr: "15:34",
  Maghrib: "18:08", Isha: "19:19",
};

describe("reference timetable", () => {
  it("validates local five times", () => expect(isFiveTimings(local)).toBe(true));
  it("rejects invalid time", () => expect(isFiveTimings({ ...local, Isha: "27:45" })).toBe(false));
  it("uses user reference for current date only", () => {
    const saved = makeLocalTimetable("23-10-2026", local, api, false);
    expect(applyLocalTimetable(api, saved, "23-10-2026")).toEqual({
      source: "manual", timings: { ...api, ...local },
    });
    expect(applyLocalTimetable(api, saved, "24-10-2026")).toEqual({ source: "api", timings: api });
  });
  it("uses opt-in approximate offsets on later dates", () => {
    const saved = makeLocalTimetable("23-10-2026", local, api, true);
    expect(applyLocalTimetable(api, saved, "24-10-2026").timings).toEqual({ ...api, ...local });
  });
  it("uses coarse GPS key", () =>
    expect(gpsReferenceScope(11.2588, 75.7804)).toBe("gps:11.26:75.78"));
});

describe("user supplied 23 October reference", () => {
  it("keeps sunrise 06:16 only for the reference date", () => {
    const saved = makeLocalTimetable(
      "23-10-2026",
      { Fajr: "05:00", Dhuhr: "12:13", Asr: "15:34", Maghrib: "18:08", Isha: "19:19" },
      api, false, "06:16",
    );
    expect(applyLocalTimetable(api, saved, "23-10-2026").timings?.Sunrise).toBe("06:16");
    expect(applyLocalTimetable(api, saved, "24-10-2026").timings?.Sunrise).toBe("06:17");
  });
});
