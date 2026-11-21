import { istSecondsOfDay, toMinutes, TZ } from "./prayer";
import type { Lang } from "./i18n";

export type HijriAdjustment = -1 | 0 | 1;

/**
 * Calendar estimate (Umm al-Qura), not a Kerala moon-sighting announcement.
 * A lunar day begins at Maghrib. Apply an optional locally observed date
 * correction to the calendar day, never to prayer times or GPS coordinates.
 */
export function hijriDisplayInstant(
  now: Date,
  maghrib: string | null | undefined,
  correction: HijriAdjustment = 0,
): Date {
  const parsedMaghrib = maghrib && /^\d{1,2}:\d{2}$/.test(maghrib)
    ? toMinutes(maghrib)
    : Number.NaN;
  const afterMaghrib = Number.isFinite(parsedMaghrib) &&
    istSecondsOfDay(now) >= parsedMaghrib * 60;
  const shiftDays = correction + (afterMaghrib ? 1 : 0);
  return new Date(now.getTime() + shiftDays * 86_400_000);
}

export function formatHijriDate(
  now: Date,
  lang: Lang,
  maghrib: string | null | undefined,
  correction: HijriAdjustment = 0,
): string {
  const date = hijriDisplayInstant(now, maghrib, correction);
  const locale = lang === "ar"
    ? "ar-SA-u-ca-islamic-umalqura"
    : lang === "ml"
      ? "ml-IN-u-ca-islamic-umalqura"
      : "en-US-u-ca-islamic-umalqura";
  const options: Intl.DateTimeFormatOptions = {
    timeZone: TZ, day: "numeric", month: "long", year: "numeric",
  };
  try {
    const formatter = new Intl.DateTimeFormat(locale, options);
    if (formatter.resolvedOptions().calendar !== "islamic-umalqura") {
      return new Intl.DateTimeFormat("en-u-ca-islamic", options).format(date);
    }
    return formatter.format(date);
  } catch {
    return new Intl.DateTimeFormat("en-u-ca-islamic", options).format(date);
  }
}
