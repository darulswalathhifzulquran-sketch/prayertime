import { describe, expect, it } from "vitest";
import { INDIA_STATES } from "./india-locations";
import { apiUrl } from "./prayer";

const jammuKashmir = INDIA_STATES.find((state) => state.name === "Jammu And Kashmir");

describe("verified India district coordinate fallbacks", () => {
  it("covers all 20 Jammu and Kashmir districts with reference coordinates", () => {
    expect(jammuKashmir?.districts).toHaveLength(20);
    for (const district of jammuKashmir?.districts ?? []) {
      expect(Number.isFinite(district.lat)).toBe(true);
      expect(Number.isFinite(district.lng)).toBe(true);
      expect(district.lat).toBeGreaterThan(30);
      expect(district.lat).toBeLessThan(37);
      expect(district.lng).toBeGreaterThan(72);
      expect(district.lng).toBeLessThan(81);
    }
  });

  it("uses coordinate prayer requests instead of ambiguous place-name geocoding", () => {
    const district = jammuKashmir?.districts.find((row) => row.name === "Bandipora");
    expect(district).toBeDefined();
    const url = apiUrl("20-11-2026", {
      id: district!.id,
      lat: district!.lat,
      lng: district!.lng,
    }, 1, 0);
    expect(url).toContain("/v1/timings/20-11-2026?");
    expect(url).toContain("latitude=34.507");
    expect(url).toContain("longitude=74.771");
    expect(url).not.toContain("timingsByAddress");
  });

  it("keeps the existing directory and never overwrites known GPS coordinates", () => {
    expect(INDIA_STATES.reduce((total, state) => total + state.districts.length, 0)).toBe(784);
    expect(apiUrl("20-11-2026", { id: "gps", lat: 10.016, lng: 76.341 }, 1, 0))
      .toContain("latitude=10.016&longitude=76.341");
  });
});
