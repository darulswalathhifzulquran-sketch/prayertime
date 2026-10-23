import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl, istDateKey, type District, type Timings } from "@/lib/prayer";

type PrayerLocation = Pick<District, "id" | "lat" | "lng">;

type Entry = { timings: Timings; fetchedAt: number };
type State = {
  today?: Timings | undefined; tomorrowFajr?: string | undefined; dateKey: string;
  fetchedAt?: number | undefined; fromCache: boolean; loading: boolean; error?: string | undefined;
  locationKey?: string;
};

const cacheKey = (id: string, date: string, method: number) => `kpt:v1:${id}:${date}:m${method}`;

async function fetchDay(d: PrayerLocation, date: string, method: number): Promise<Entry> {
  const res = await fetch(apiUrl(date, d.lat, d.lng, method));
  if (!res.ok) throw new Error(`Prayer service returned ${res.status}`);
  const j = await res.json();
  const x = j?.data?.timings;
  if (!x?.Fajr) throw new Error("Unexpected response from prayer service");
  const pick = (k: string) => String(x[k]).slice(0, 5);
  const timings = { Fajr: pick("Fajr"), Sunrise: pick("Sunrise"), Dhuhr: pick("Dhuhr"), Asr: pick("Asr"), Maghrib: pick("Maghrib"), Isha: pick("Isha") };
  return { timings, fetchedAt: Date.now() };
}

async function getDay(d: PrayerLocation, date: string, method: number, force: boolean) {
  // Never persist precise GPS coordinates or GPS-based prayer times in local storage.
  const isGps = d.id === "gps";
  const k = cacheKey(d.id, date, method);
  const cached = isGps ? null : localStorage.getItem(k);
  if (cached && !force) return { ...(JSON.parse(cached) as Entry), fromCache: true };
  try {
    const e = await fetchDay(d, date, method);
    if (!isGps) localStorage.setItem(k, JSON.stringify(e));
    return { ...e, fromCache: false };
  } catch (err) {
    if (cached) return { ...(JSON.parse(cached) as Entry), fromCache: true, err };
    throw err;
  }
}

export function usePrayerTimes(district: PrayerLocation | undefined, method: number) {
  const [s, setS] = useState<State>({ dateKey: "", fromCache: false, loading: true });
  const reqId = useRef(0);
  const locationKey = district ? [district.id, district.lat.toFixed(4), district.lng.toFixed(4), method].join(":") : "";

  const load = useCallback(async (force = false) => {
    if (!district) return;
    const id = ++reqId.current;
    const now = new Date();
    const dateKey = istDateKey(now);
    const tomorrowKey = istDateKey(new Date(now.getTime() + 86400000));
    setS({ dateKey, locationKey, fromCache: false, loading: true });
    try {
      const today = await getDay(district, dateKey, method, force);
      let tomorrowFajr: string | undefined;
      try { tomorrowFajr = (await getDay(district, tomorrowKey, method, false)).timings.Fajr; } catch { /* optional */ }
      if (id !== reqId.current) return;
      setS({
        today: today.timings, tomorrowFajr, dateKey, locationKey, fetchedAt: today.fetchedAt, fromCache: today.fromCache,
        loading: false, error: "err" in today ? "Could not refresh — showing saved times." : undefined,
      });
    } catch (e) {
      if (id !== reqId.current) return;
      setS({ dateKey, locationKey, fromCache: false, loading: false, error: e instanceof Error ? e.message : "Failed to load" });
    }
  }, [district, method, locationKey]);

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
