import { describe, expect, it } from "vitest";
import { formatHijriDate, hijriDisplayInstant } from "./hijri-date";

describe("Hijri date for JAMIA AWQAAT", () => {
  const before = new Date("2026-11-21T12:20:00+05:30");
  const after = new Date("2026-11-21T18:45:00+05:30");

  it("keeps the calendar date before Maghrib and begins a new lunar day after it", () => {
    expect(hijriDisplayInstant(before, "18:10").getTime()).toBe(before.getTime());
    expect(hijriDisplayInstant(after, "18:10").getTime()).toBe(after.getTime() + 86_400_000);
    expect(hijriDisplayInstant(after, undefined).getTime()).toBe(after.getTime());
  });

  it("supports a local moon-sighting correction without changing UTC or prayer times", () => {
    expect(hijriDisplayInstant(before, "18:10", -1).getTime()).toBe(before.getTime() - 86_400_000);
    expect(hijriDisplayInstant(before, "18:10", 1).getTime()).toBe(before.getTime() + 86_400_000);
    expect(hijriDisplayInstant(after, "18:10", -1).getTime()).toBe(after.getTime());
  });

  it("formats English, Malayalam and Arabic using a supported Hijri calendar", () => {
    for (const lang of ["en", "ml", "ar"] as const) {
      const value = formatHijriDate(before, lang, "18:10");
      expect(value.length).toBeGreaterThan(9);
    }
    expect(formatHijriDate(after, "en", "18:10"))
      .not.toBe(formatHijriDate(before, "en", "18:10"));
  });

  it("correctly interprets the Indian timezone even on UTC-hosted servers", () => {
    const nearMaghrib = new Date("2026-11-21T12:45:00Z"); // 18:15 IST
    expect(hijriDisplayInstant(nearMaghrib, "18:10").getTime())
      .toBe(nearMaghrib.getTime() + 86_400_000);
  });
});
