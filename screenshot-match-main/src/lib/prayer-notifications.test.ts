import { describe, expect, it } from "vitest";
import { prayerNotificationBody } from "./prayer-notifications";

describe("prayer lock-screen notification text", () => {
  it("renders the prayer start in a short clear message", () => {
    expect(prayerNotificationBody("Dhuhr", "12:58")).toBe("Dhuhr at 12:58 — It's time to pray!");
  });
  it("does not generate an alert for sunrise", () => {
    expect(() => prayerNotificationBody("Sunrise", "06:20")).toThrow();
  });
});
