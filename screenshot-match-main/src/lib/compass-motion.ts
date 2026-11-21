/** Circular heading smoothing with fast deliberate motion and a stable readout. */
export const normalizeHeading = (n: number) => ((n % 360) + 360) % 360;
export const headingDifference = (a: number, b: number) => ((a - b + 540) % 360) - 180;

export function nextCompassHeading(previous: number | null, raw: number, elapsedMs: number): number {
  if (previous === null) return normalizeHeading(raw);
  const delta = headingDifference(raw, normalizeHeading(previous));
  const dt = Math.max(1, Math.min(250, elapsedMs));
  // Track deliberate turns almost immediately; damp stationary sensor noise.
  const tau = Math.abs(delta) >= 8 ? 14 : Math.abs(delta) >= 2 ? 45 : 150;
  return previous + delta * (1 - Math.exp(-dt / tau));
}

/** Schmitt trigger: prevent 290/291 oscillation around a rounding boundary. */
export function stableHeadingDegree(value: number, previous: number | null): number {
  const rounded = normalizeHeading(Math.round(value));
  return previous !== null && Math.abs(headingDifference(value, previous)) < 0.85
    ? previous : rounded;
}

export type AlignmentState = { since: number | null; aligned: boolean; armed: boolean };
export function updateAlignment(
  previous: AlignmentState, now: number, filteredError: number, rawError: number, reliable: boolean,
): AlignmentState & { buzz: boolean } {
  const armed = previous.armed || (reliable && rawError >= 12 && filteredError >= 12);
  if (!reliable || rawError > 5 || filteredError > 5) {
    return { since: null, aligned: false, armed, buzz: false };
  }
  const since = previous.since ?? now;
  const aligned = now - since >= 180;
  return { since, aligned, armed: armed && !aligned, buzz: aligned && armed };
}
