import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl, istDateKey, type AsrSchool, type PrayerLocation, type Timings } from "@/lib/prayer";

type Entry = { timings: Timings; fetchedAt: number };
type State = {
  today?: Timings | undefined; tomorrowFajr?: string | undefined; dateKey: string;
  fetchedAt?: number | undefined; fromCache: boolean; loading: boolean; error?: string | undefined;
  locationKey?: string;
};

const cacheKey = (id: string, date: string, method: number, school: AsrSchool) => `kpt:v2:${id}:${date}:m${method}:asr${school}`;

async function fetchDay(d: PrayerLocation, date: string, method: number, school: AsrSchool): Promise<Entry> {
  const res = await fetch(apiUrl(date, d, method, school));
  if (!res.ok) throw new Error(`Prayer service returned ${res.status}`);
  const j = await res.json();
  const x = j?.data?.timings;
  if (!x?.Fajr) throw new Error("The prayer service could not resolve this Indian district or town. Try GPS or a nearby city.");
  const metaLat = Number(j?.data?.meta?.latitude);
  const metaLng = Number(j?.data?.meta?.longitude);
  if (d.address && Number.isFinite(metaLat) && Number.isFinite(metaLng) &&
      (metaLat < 6 || metaLat > 39 || metaLng < 68 || metaLng > 98)) {
    throw new Error("The prayer service resolved a location outside India. Try GPS instead.");
  }
  const pick = (k: string) => {
    const time = String(x[k] ?? "").slice(0, 5);
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Prayer service returned an invalid time.");
    return time;
  };
  const timings = { Fajr: pick("Fajr"), Sunrise: pick("Sunrise"), Dhuhr: pick("Dhuhr"), Asr: pick("Asr"), Maghrib: pick("Maghrib"), Isha: pick("Isha") };
  return { timings, fetchedAt: Date.now() };
}

async function getDay(d: PrayerLocation, date: string, method: number, school: AsrSchool, force: boolean) {
  // Never persist precise GPS coordinates or GPS-based prayer times in local storage.
  const isGps = d.id === "gps" || d.id.startsWith("city:");
  const k = cacheKey(d.id, date, method, school);
  const cached = isGps ? null : localStorage.getItem(k);
  if (cached && !force) return { ...(JSON.parse(cached) as Entry), fromCache: true };
  try {
    const e = await fetchDay(d, date, method, school);
    if (!isGps) localStorage.setItem(k, JSON.stringify(e));
    return { ...e, fromCache: false };
  } catch (err) {
    if (cached) return { ...(JSON.parse(cached) as Entry), fromCache: true, err };
    throw err;
  }
}

export function usePrayerTimes(district: PrayerLocation | undefined, method: number, school: AsrSchool = 0) {
  const [s, setS] = useState<State>({ dateKey: "", fromCache: false, loading: true });
  const reqId = useRef(0);
  const locationKey = district
    ? [district.id, district.lat?.toFixed(4) ?? "", district.lng?.toFixed(4) ?? "", district.address ?? "", method, school].join(":")
    : "";

  const load = useCallback(async (force = false) => {
    if (!district) return;
    const id = ++reqId.current;
    const now = new Date();
    const dateKey = istDateKey(now);
    const tomorrowKey = istDateKey(new Date(now.getTime() + 86400000));
    setS({ dateKey, locationKey, fromCache: false, loading: true });
    try {
      const today = await getDay(district, dateKey, method, school, force);
      let tomorrowFajr: string | undefined;
      try { tomorrowFajr = (await getDay(district, tomorrowKey, method, school, false)).timings.Fajr; } catch { /* optional */ }
      if (id !== reqId.current) return;
      setS({
        today: today.timings, tomorrowFajr, dateKey, locationKey, fetchedAt: today.fetchedAt, fromCache: today.fromCache,
        loading: false, error: "err" in today ? "Could not refresh — showing saved times." : undefined,
      });
    } catch (e) {
      if (id !== reqId.current) return;
      setS({ dateKey, locationKey, fromCache: false, loading: false, error: e instanceof Error ? e.message : "Failed to load" });
    }
  }, [district, method, school, locationKey]);

  useEffect(() => { void load(); }, [load]);

  // Detect IST date change (midnight, or returning to an inactive tab).
  useEffect(() => {
    const check = () => { if (istDateKey(new Date()) !== s.dateKey && s.dateKey) void load(); };
    const iv = setInterval(check, 15000);
    const vis = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("focus", check);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", vis); window.removeEventListener("focus", check); };
  }, [s.dateKey, load]);

  // Hide the previous location's schedule immediately, before effects run.
  // A selected district must never display the last GPS/district's prayer times.
  const current = s.locationKey === locationKey;
  return {
    ...s,
    today: current ? s.today : undefined,
    tomorrowFajr: current ? s.tomorrowFajr : undefined,
    fetchedAt: current ? s.fetchedAt : undefined,
    error: current ? s.error : undefined,
    loading: !current || s.loading,
    reload: () => load(true),
  };
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const iv = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(iv);
  }, [ms]);
  return now;
}

export function usePersisted<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem(key);
    if (raw) try { setV(JSON.parse(raw)); } catch { /* ignore */ }
    setReady(true);
  }, [key]);
  useEffect(() => { if (ready) localStorage.setItem(key, JSON.stringify(v)); }, [key, v, ready]);
  return [v, setV, ready] as const;
}
