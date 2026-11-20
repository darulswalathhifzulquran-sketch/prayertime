import { FIVE, istSecondsOfDay, toMinutes, type PrayerKey, type Timings } from "./prayer";

/**
 * Foreground-only device feedback. Browsers, not the server, control physical
 * vibration and audio playback. Unsupported devices silently do nothing.
 */
let alertContext: AudioContext | null = null;

export function prayerDueThisMinute(now: Date, timings: Timings): PrayerKey | null {
  const second = istSecondsOfDay(now);
  for (const prayer of FIVE) {
    const start = toMinutes(timings[prayer]) * 60;
    if (second >= start && second < start + 60) return prayer;
  }
  // Sunrise is deliberately excluded: it is not one of the five prayers.
  return null;
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some devices block vibration, even when the browser exposes the API.
  }
}

/** Called only from an existing user gesture (tap / keyboard press). */
export function unlockPrayerBeep() {
  if (typeof window === "undefined") return;
  const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioCtor = (typeof AudioContext !== "undefined" ? AudioContext : undefined) ?? audioWindow.webkitAudioContext;
  if (!AudioCtor) return;
  try {
    if (!alertContext || alertContext.state === "closed") alertContext = new AudioCtor();
    if (alertContext.state === "suspended") {
      void alertContext.resume().catch(() => {
        // Autoplay policies may still deny playback until a user interaction.
      });
    }
  } catch {
    // Sound is optional if the device does not support Web Audio.
  }
}

/** A short, clear two-tone beep without touching the existing Azan recording. */
function beep() {
  const ctx = alertContext;
  if (!ctx || ctx.state !== "running") return;
  const origin = ctx.currentTime + 0.025;
  for (const [delay, frequency] of [[0, 740], [0.25, 925]] as const) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, origin + delay);
    gain.gain.setValueAtTime(0.001, origin + delay);
    gain.gain.exponentialRampToValueAtTime(0.13, origin + delay + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, origin + delay + 0.20);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(origin + delay);
    oscillator.stop(origin + delay + 0.21);
  }
}

export function signalPrayerTime() {
  vibrate([220, 110, 220, 110, 380]);
  beep();
}

export function signalQiblaAligned() {
  vibrate([160, 80, 210]);
}

export function signalReminderChanged() {
  vibrate(45);
}
