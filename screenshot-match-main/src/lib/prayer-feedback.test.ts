import { describe, expect, it } from "vitest";
import { prayerDueThisMinute } from "./prayer-feedback";
import type { Timings } from "./prayer";

const timetable: Timings = {
  Fajr: "05:10",
  Sunrise: "06:21",
  Dhuhr: "12:19",
  Asr: "15:40",
  Maghrib: "18:00",
  Isha: "19:25",
};

const ist = (clock: string) => new Date(`2026-11-20T${clock}+05:30`);

describe("automatic prayer feedback schedule", () => {
  it("signals all five prayers only in their first minute", () => {
    for (const [name, clock] of [
      ["Fajr", "05:10:15"],
      ["Dhuhr", "12:19:30"],
      ["Asr", "15:40:59"],
      ["Maghrib", "18:00:00"],
      ["Isha", "19:25:01"],
    ] as const) {
      expect(prayerDueThisMinute(ist(clock), timetable)).toBe(name);
    }
  });

  it("never fires for sunrise", () => {
    expect(prayerDueThisMinute(ist("06:21:01"), timetable)).toBeNull();
  });

  it("does not fire early, or late after the first minute", () => {
    expect(prayerDueThisMinute(ist("05:09:59"), timetable)).toBeNull();
    expect(prayerDueThisMinute(ist("05:11:00"), timetable)).toBeNull();
  });

  it("uses India time zone even if the device runs in UTC", () => {
    expect(prayerDueThisMinute(new Date("2026-11-19T23:40:00Z"), timetable)).toBe("Fajr");
  });
});
