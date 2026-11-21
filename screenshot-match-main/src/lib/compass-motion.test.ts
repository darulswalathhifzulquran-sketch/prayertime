import { describe, expect, it } from "vitest";
import { nextCompassHeading, normalizeHeading, stableHeadingDegree, updateAlignment, type AlignmentState } from "./compass-motion";

describe("Qibla responsive heading", () => {
  it("follows a deliberate 90 degree turn rapidly", () => {
    let current = nextCompassHeading(0, 90, 25);
    current = nextCompassHeading(current, 90, 25);
    expect(current).toBeGreaterThan(87);
  });
  it("takes the short path through north instead of a full revolution", () => {
    const result = nextCompassHeading(359, 1, 25);
    expect(result).toBeGreaterThan(359);
    expect(result).toBeLessThan(361);
    expect(stableHeadingDegree(359.91, null)).toBe(0);
    expect(normalizeHeading(result)).toBeGreaterThanOrEqual(0);
  });
  it("damps stationary jitter and does not flicker around a degree boundary", () => {
    expect(nextCompassHeading(290, 290.5, 25)).toBeLessThan(290.1);
    expect(stableHeadingDegree(290.51, 290)).toBe(290);
    expect(stableHeadingDegree(290.89, 290)).toBe(291);
    expect(stableHeadingDegree(290.49, 291)).toBe(291);
  });
  it("confirms once after 180ms of reliable alignment and rearms after leaving", () => {
    let state: AlignmentState = { since: null, aligned: false, armed: true };
    let next = updateAlignment(state, 100, 2, 2, true);
    expect(next.buzz).toBe(false);
    next = updateAlignment(next, 280, 2, 2, true);
    expect(next.aligned).toBe(true);
    expect(next.buzz).toBe(true);
    next = updateAlignment(next, 500, 1, 1, true);
    expect(next.buzz).toBe(false);
    next = updateAlignment(next, 550, 7, 7, true);
    expect(next.armed).toBe(false);
    next = updateAlignment(next, 600, 15, 15, true);
    expect(next.armed).toBe(true);
    next = updateAlignment(next, 650, 1, 1, true);
    next = updateAlignment(next, 850, 1, 1, true);
    expect(next.buzz).toBe(true);
  });
  it("does not confirm stale filtered headings, tilted phones or unreliable sensors", () => {
    const state = { since: 0, aligned: false, armed: true };
    expect(updateAlignment(state, 500, 1, 15, true).buzz).toBe(false);
    expect(updateAlignment(state, 500, 1, 1, false).buzz).toBe(false);
    expect(updateAlignment(state, 500, 6, 1, true).buzz).toBe(false);
  });
});
