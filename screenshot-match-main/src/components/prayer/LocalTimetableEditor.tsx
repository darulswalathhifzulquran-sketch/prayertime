import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FIVE, formatTime, type Timings } from "@/lib/prayer";
import {
  isFiveTimings, localTimetableKey, makeLocalTimetable,
  type FiveKey, type FiveTimings, type LocalTimetable,
} from "@/lib/local-timetable";

const EMPTY: FiveTimings = { Fajr: "", Dhuhr: "", Asr: "", Maghrib: "", Isha: "" };
// User-supplied local reference for 23 Oct 2026 only. Never apply globally.
export const SHARED_DATE = "23-10-2026";
export const SHARED_TIMES: FiveTimings = {
  Fajr: "05:00",
  Dhuhr: "12:13",
  Asr: "15:34",
  Maghrib: "18:08",
  Isha: "19:19",
};
export const SHARED_SUNRISE = "06:16";

type Props = {
  dateKey: string;
  scope: string;
  calculated?: Timings;
  saved: LocalTimetable | null;
  onChange: (newValue: LocalTimetable | null) => void;
};

export function LocalTimetableEditor({ dateKey, scope, calculated, saved, onChange }: Props) {
  const [draft, setDraft] = useState<FiveTimings>(EMPTY);
  const [autoAdjust, setAutoAdjust] = useState(false);
  const [sunrise, setSunrise] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const source = saved?.dateKey === dateKey ? saved.times : calculated;
    setDraft(source ? {
      Fajr: source.Fajr, Dhuhr: source.Dhuhr, Asr: source.Asr, Maghrib: source.Maghrib, Isha: source.Isha,
    } : EMPTY);
    setSunrise(saved?.dateKey === dateKey && saved.sunrise ? saved.sunrise : calculated?.Sunrise ?? "");
    setAutoAdjust(saved?.autoAdjust ?? false);
    setNotice("");
  }, [scope, dateKey, calculated, saved]);

  const saveValues = (times: FiveTimings, rise: string, useOffsets: boolean) => {
    if (!calculated) { setNotice("Wait for the prayer API to finish loading."); return; }
    if (!isFiveTimings(times)) { setNotice("Enter all five valid HH:MM times."); return; }
    try {
      const reference = makeLocalTimetable(dateKey, times, calculated, useOffsets, rise);
      localStorage.setItem(localTimetableKey(scope), JSON.stringify(reference));
      onChange(reference);
      setNotice(useOffsets
        ? "Saved for today. Future days use approximate adjustments only — please verify daily."
        : "Today's six reference times saved for this location only. Future dates require verified daily values.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to save this local reference.");
    }
  };

  const save = () => saveValues(draft, sunrise, autoAdjust);

  const useSharedReference = () => {
    if (dateKey !== SHARED_DATE || !scope.startsWith("gps:")) return;
    setDraft(SHARED_TIMES);
    setSunrise(SHARED_SUNRISE);
    setAutoAdjust(true);
    saveValues(SHARED_TIMES, SHARED_SUNRISE, true);
  };

  const clear = () => {
    localStorage.removeItem(localTimetableKey(scope));
    onChange(null);
    setAutoAdjust(false);
    setNotice("Local reference cleared. Displaying API-calculated times.");
  };

  return (
    <details className="mb-5 rounded-xl border bg-card p-4">
      <summary className="cursor-pointer font-semibold text-primary">
        Correct times using my local masjid timetable
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-muted-foreground">
          Enter six times from your trusted local calendar for {dateKey || "today"}.
          Saved times affect only this browser and the selected area.
          GPS settings use an approximate 1 km location key, not your exact coordinates.
        </p>
        {scope.startsWith("gps:") && dateKey === SHARED_DATE && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            <p className="font-semibold">Your shared local timings for 23 October 2026</p>
            <p className="mt-1">Fajr 05:00 · Dhuhr 12:13 · Asr 15:34 · Maghrib 18:08 · Isha 19:19 · Sunrise 06:16</p>
            <p className="mt-1 text-xs">Only for this GPS area. Future dates refresh automatically with approximate minute adjustments, not a verified local daily chart.</p>
            <Button type="button" className="mt-2" size="sm" disabled={!calculated} onClick={useSharedReference}>
              Use these times + estimated future daily updates
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FIVE.map((key) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{key}</span>
              <input
                type="time"
                aria-label={key + " local time"}
                value={draft[key as FiveKey]}
                onChange={(event) => setDraft((old) => ({ ...old, [key]: event.target.value }))}
                className="min-w-0 rounded-md border bg-background px-2 py-2 text-foreground"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Sunrise</span>
            <input type="time" aria-label="Sunrise local time" value={sunrise}
              onChange={(event) => setSunrise(event.target.value)}
              className="min-w-0 rounded-md border bg-background px-2 py-2 text-foreground" />
          </label>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoAdjust}
            onChange={(event) => setAutoAdjust(event.target.checked)}
            className="mt-1"
          />
          <span>
            Optionally apply today's minute differences to later dates.
            <strong> Approximation only — NOT a verified daily local timetable.</strong>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!calculated || !dateKey} onClick={save}>Save six local times</Button>
          {saved && <Button type="button" variant="outline" onClick={clear}>Clear local times</Button>}
          {calculated && <span className="text-xs text-muted-foreground">
            Calculated Dhuhr: {formatTime(calculated.Dhuhr, true)} · Asr: {formatTime(calculated.Asr, true)}
          </span>}
        </div>
        {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      </div>
    </details>
  );
}
