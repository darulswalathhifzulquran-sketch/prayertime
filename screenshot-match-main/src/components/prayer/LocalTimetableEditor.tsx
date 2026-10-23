import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FIVE, formatTime, type Timings } from "@/lib/prayer";
import {
  isFiveTimings, localTimetableKey, makeLocalTimetable,
  type FiveKey, type FiveTimings, type LocalTimetable,
} from "@/lib/local-timetable";

const EMPTY: FiveTimings = { Fajr: "", Dhuhr: "", Asr: "", Maghrib: "", Isha: "" };

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
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const source = saved?.dateKey === dateKey ? saved.times : calculated;
    setDraft(source ? {
      Fajr: source.Fajr, Dhuhr: source.Dhuhr, Asr: source.Asr, Maghrib: source.Maghrib, Isha: source.Isha,
    } : EMPTY);
    setAutoAdjust(saved?.autoAdjust ?? false);
    setNotice("");
  }, [scope, dateKey, calculated, saved]);

  const save = () => {
    if (!calculated) { setNotice("Wait for the prayer API to finish loading."); return; }
    if (!isFiveTimings(draft)) { setNotice("Enter all five valid HH:MM times."); return; }
    try {
      const reference = makeLocalTimetable(dateKey, draft, calculated, autoAdjust);
      localStorage.setItem(localTimetableKey(scope), JSON.stringify(reference));
      onChange(reference);
      setNotice(autoAdjust
        ? "Saved for today. Future times use approximate minute adjustments — please verify."
        : "Saved for today only on this device. Tomorrow uses calculated API times.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to save this local reference.");
    }
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
          Enter the five times from your trusted local calendar for {dateKey || "today"}.
          Sunrise remains API-calculated. Saved values affect only this browser and selected area.
          GPS settings store an approximate 1 km location key, not exact coordinates.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoAdjust}
            onChange={(event) => setAutoAdjust(event.target.checked)}
            className="mt-1"
          />
          <span>
            Automatically apply today's separate minute differences to later dates.
            <strong> Approximation only — NOT a verified daily local timetable.</strong>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!calculated || !dateKey} onClick={save}>Save my local times</Button>
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
