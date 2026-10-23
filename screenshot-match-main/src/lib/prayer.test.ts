import { describe, expect, it } from "vitest";
import { CARDS, DISTRICTS, nextPrayer, applyOffset, istDateKey, type Timings } from "./prayer";

const t: Timings = { Fajr: "04:55", Sunrise: "06:10", Dhuhr: "12:15", Asr: "15:35", Maghrib: "18:10", Isha: "19:22" };

describe("prayer rules", () => {
  it("has all 14 Kerala districts", () => expect(DISTRICTS).toHaveLength(14));
  it("shows Sunrise as the last card after Isha", () =>
    expect(CARDS.map((c) => c.key)).toEqual(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha", "Sunrise"]));
  it("skips Sunrise in the countdown", () => expect(nextPrayer(t, 5 * 3600).key).toBe("Dhuhr"));
  it("after Isha counts down to tomorrow's Fajr", () => {
    const n = nextPrayer(t, 20 * 3600, "04:56");
    expect(n).toEqual({ key: "Fajr", secondsLeft: 4 * 3600 + 4 * 3600 + 56 * 60, tomorrow: true });
  });
  it("applies minute offsets across midnight", () => expect(applyOffset("23:58", 5)).toBe("00:03"));
  it("uses Asia/Kolkata date", () => expect(istDateKey(new Date("2026-10-22T19:00:00Z"))).toBe("23-10-2026"));
});
