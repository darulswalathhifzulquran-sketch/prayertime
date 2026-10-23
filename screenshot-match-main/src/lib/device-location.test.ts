import { describe, expect, it } from "vitest";
import { apiUrl, DISTRICTS } from "./prayer";

describe("GPS prayer-time URLs", () => {
  it("uses supplied GPS coordinates rather than the district headquarters", () => {
    const url = new URL(apiUrl("23-10-2026", 11.2333, 75.8122, 1));
    expect(url.searchParams.get("latitude")).toBe("11.2333");
    expect(url.searchParams.get("longitude")).toBe("75.8122");
    expect(url.searchParams.get("timezonestring")).toBe("Asia/Kolkata");
    expect(url.searchParams.get("school")).toBe("0");
    expect(url.searchParams.get("latitude")).not.toBe(String(DISTRICTS[0].lat));
  });
});
