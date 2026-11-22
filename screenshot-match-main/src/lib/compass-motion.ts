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

/** A short circular median rejects isolated magnetic spikes, including across north. */
export function medianHeading(readings: number[], around: number): number {
  const values = readings.map(value => headingDifference(value, normalizeHeading(around))).sort((a,b) => a-b);
  const middle = Math.floor(values.length / 2);
  return around + (values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2);
}

export type MotionTracker = {
  value: number | null; samples: number[]; locked: boolean;
  quietSince: number | null; changeSince: number | null;
};
export const newMotionTracker = (): MotionTracker => ({
  value: null, samples: [], locked: false, quietSince: null, changeSince: null,
});

/** Use gyroscope motion evidence when present. Do not let stationary magnetic
 * noise move the entire dial. On sensors without rotationRate, use a circular
 * median, deadband and sustained-change confirmation instead. */
export function trackHeading(
  state: MotionTracker, raw: number, now: number, elapsed: number, moving: boolean | null,
): MotionTracker & { disturbed: boolean } {
  const samples = [...state.samples.slice(-6), raw];
  const previous = state.value ?? normalizeHeading(raw);
  const median = medianHeading(samples, previous);
  const delta = median - previous;
  if (moving === true) {
    // Ignore old stationary samples on a real turn; raw follows immediately.
    const value = nextCompassHeading(previous, raw, elapsed);
    return { value, samples: [raw], locked: false, quietSince: null, changeSince: null, disturbed: false };
  }
  if (moving === false) {
    const quietSince = state.quietSince ?? now;
    const locked = state.locked || now - quietSince >= 300;
    // Settle once, then hold exactly while the gyroscope reports no movement.
    const value = state.locked ? previous : median;
    const disturbed = locked && Math.abs(headingDifference(median, value)) > 8;
    return { value, samples, locked, quietSince, changeSince: null, disturbed };
  }
  // No gyroscope data: do not assume the phone is motionless.
  const changeSince = Math.abs(delta) >= 3 ? state.changeSince ?? now : null;
  const confirmed = changeSince !== null && now - changeSince >= 160;
  const value = confirmed ? nextCompassHeading(previous, median, elapsed) : previous;
  return { value, samples, locked: !confirmed, quietSince: null, changeSince, disturbed: false };
}
