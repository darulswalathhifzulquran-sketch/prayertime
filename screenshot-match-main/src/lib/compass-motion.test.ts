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

import { newMotionTracker, trackHeading } from "./compass-motion";
import { magneticDeclination } from "./wmm2025";

describe("stationary compass and true north", () => {
  it("holds the entire dial through stationary magnetic jitter shown in the recording", () => {
    let tracker = newMotionTracker();
    for (let t = 0; t < 600; t += 25) tracker = trackHeading(tracker, 291, t, 25, false);
    expect(tracker.locked).toBe(true);
    const frozen = tracker.value;
    const noise = [289, 285, 288, 290, 287, 288, 287, 280, 285, 289, 291];
    for (let i = 0; i < 220; i++) {
      tracker = trackHeading(tracker, noise[i % noise.length], 600 + i * 25, 25, false);
      expect(tracker.value).toBe(frozen);
    }
  });
  it("unlocks immediately on detected motion and settles at the new heading", () => {
    let tracker = newMotionTracker();
    for (let t = 0; t < 600; t += 25) tracker = trackHeading(tracker, 291, t, 25, false);
    tracker = trackHeading(tracker, 321, 625, 25, true);
    expect(tracker.locked).toBe(false);
    expect(tracker.value).toBeGreaterThan(315);
    for (let t = 650; t < 1400; t += 25) tracker = trackHeading(tracker, 321, t, 25, false);
    expect(tracker.locked).toBe(true);
    expect(tracker.value).toBeCloseTo(321);
  });
  it("flags magnetic disagreement instead of confidently claiming alignment", () => {
    let tracker = newMotionTracker();
    for (let t = 0; t < 600; t += 25) tracker = trackHeading(tracker, 291, t, 25, false);
    let disturbed = false;
    for (let t = 600; t < 1200; t += 25) {
      const next = trackHeading(tracker, 310, t, 25, false);
      disturbed = next.disturbed;
      tracker = next;
    }
    expect(disturbed).toBe(true);
    expect(tracker.value).toBe(291);
  });
  it("still follows sustained turns if gyro is unavailable", () => {
    let tracker = newMotionTracker();
    tracker = trackHeading(tracker, 291, 0, 25, null);
    for (let t = 25; t < 600; t += 25) tracker = trackHeading(tracker, 320, t, 25, null);
    expect(tracker.value).toBeGreaterThan(317);
  });
  it("matches published WMM2025 surface examples", () => {
    const date = new Date("2025-01-01T00:00:00Z");
    expect(magneticDeclination(80, 0, date)).toBeCloseTo(1.28, 1);
    expect(magneticDeclination(0, 120, date)).toBeCloseTo(-0.16, 1);
    expect(magneticDeclination(-80, -120, date)).toBeCloseTo(68.78, 1);
  });
  it("uses the screenshot's Kozhikode coordinates without a hardcoded Qibla adjustment", () => {
    const d = magneticDeclination(11+9/60+28/3600, 76+1/60+21/3600, new Date("2026-11-22"));
    expect(Number.isFinite(d)).toBe(true);
    expect(Math.abs(d)).toBeLessThan(8);
  });
});
