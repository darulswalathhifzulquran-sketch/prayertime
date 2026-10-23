export const TZ = "Asia/Kolkata";

export type District = { id: string; en: string; ml: string; hq: string; lat: number; lng: number };

// District headquarters coordinates (representative locations).
export const DISTRICTS: [District, ...District[]] = [
  { id: "tvm", en: "Thiruvananthapuram", ml: "തിരുവനന്തപുരം", hq: "Thiruvananthapuram", lat: 8.5241, lng: 76.9366 },
  { id: "klm", en: "Kollam", ml: "കൊല്ലം", hq: "Kollam", lat: 8.8932, lng: 76.6141 },
  { id: "pta", en: "Pathanamthitta", ml: "പത്തനംതിട്ട", hq: "Pathanamthitta", lat: 9.2648, lng: 76.787 },
  { id: "alp", en: "Alappuzha", ml: "ആലപ്പുഴ", hq: "Alappuzha", lat: 9.4981, lng: 76.3388 },
  { id: "ktm", en: "Kottayam", ml: "കോട്ടയം", hq: "Kottayam", lat: 9.5916, lng: 76.5222 },
  { id: "idk", en: "Idukki", ml: "ഇടുക്കി", hq: "Painavu", lat: 9.8497, lng: 76.9719 },
  { id: "ekm", en: "Ernakulam", ml: "എറണാകുളം", hq: "Kakkanad", lat: 10.0159, lng: 76.3419 },
  { id: "tsr", en: "Thrissur", ml: "തൃശ്ശൂർ", hq: "Thrissur", lat: 10.5276, lng: 76.2144 },
  { id: "pkd", en: "Palakkad", ml: "പാലക്കാട്", hq: "Palakkad", lat: 10.7867, lng: 76.6548 },
  { id: "mlp", en: "Malappuram", ml: "മലപ്പുറം", hq: "Malappuram", lat: 11.051, lng: 76.0711 },
  { id: "kkd", en: "Kozhikode", ml: "കോഴിക്കോട്", hq: "Kozhikode", lat: 11.2588, lng: 75.7804 },
  { id: "wyd", en: "Wayanad", ml: "വയനാട്", hq: "Kalpetta", lat: 11.6085, lng: 76.083 },
  { id: "knr", en: "Kannur", ml: "കണ്ണൂർ", hq: "Kannur", lat: 11.8745, lng: 75.3704 },
  { id: "ksd", en: "Kasaragod", ml: "കാസർഗോഡ്", hq: "Kasaragod", lat: 12.4996, lng: 74.9869 },
];

export type PrayerKey = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha" | "Sunrise";

// Display order: five obligatory prayers, then Sunrise LAST.
export const CARDS: { key: PrayerKey; en: string; ar: string; ml: string }[] = [
  { key: "Fajr", en: "Fajr", ar: "الفَجْر", ml: "സുബ്ഹ്" },
  { key: "Dhuhr", en: "Dhuhr", ar: "الظُّهْر", ml: "ളുഹ്ർ" },
  { key: "Asr", en: "Asr", ar: "العَصْر", ml: "അസർ" },
  { key: "Maghrib", en: "Maghrib", ar: "المَغْرِب", ml: "മഗ്‌രിബ്" },
  { key: "Isha", en: "Isha", ar: "العِشَاء", ml: "ഇശാഅ്" },
  { key: "Sunrise", en: "Sunrise", ar: "الشُّرُوق", ml: "ഉദയം" },
];

export const FIVE: PrayerKey[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

export const METHODS: { id: number; name: string }[] = [
  { id: 1, name: "University of Islamic Sciences, Karachi" },
  { id: 3, name: "Muslim World League" },
  { id: 4, name: "Umm Al-Qura, Makkah" },
  { id: 5, name: "Egyptian General Authority of Survey" },
  { id: 2, name: "Islamic Society of North America" },
];
export const DEFAULT_METHOD = 1;

export type Timings = Record<PrayerKey, string>; // "HH:MM" 24h, Asia/Kolkata

/** Parts of a Date as seen in Asia/Kolkata. */
export function istParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value])) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** DD-MM-YYYY date key in Asia/Kolkata (AlAdhan format). */
export function istDateKey(d: Date) {
  const p = istParts(d);
  return `${String(p.d).padStart(2, "0")}-${String(p.mo).padStart(2, "0")}-${p.y}`;
}

/** Seconds since IST midnight. */
export function istSecondsOfDay(d: Date) {
  const p = istParts(d);
  return p.h * 3600 + p.mi * 60 + p.s;
}

export function toMinutes(hhmm: string) {
  const [h = 0, m = 0] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

export function applyOffset(hhmm: string, offset: number) {
  const t = (((toMinutes(hhmm) + offset) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * Next obligatory prayer (Sunrise excluded). After Isha, returns tomorrow's Fajr,
 * using tomorrowFajr when known, else today's Fajr as an approximation.
 */
export function nextPrayer(t: Timings, nowSec: number, tomorrowFajr?: string | undefined) {
  for (const k of FIVE) {
    const s = toMinutes(t[k]) * 60;
    if (s > nowSec) return { key: k, secondsLeft: s - nowSec, tomorrow: false };
  }
  const f = toMinutes(tomorrowFajr ?? t.Fajr) * 60;
  return { key: "Fajr" as PrayerKey, secondsLeft: 86400 - nowSec + f, tomorrow: true };
}

export function formatHMS(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function formatTime(hhmm: string, h12: boolean) {
  if (!h12) return hhmm;
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function apiUrl(dateKey: string, lat: number, lng: number, method: number) {
  return `https://api.aladhan.com/v1/timings/${dateKey}?latitude=${lat}&longitude=${lng}&method=${method}&school=0&timezonestring=${encodeURIComponent(TZ)}`;
}

export function nearestDistrict(lat: number, lng: number) {
  let best: District = DISTRICTS[0], bd = Infinity;
  for (const d of DISTRICTS) {
    const dist = (d.lat - lat) ** 2 + ((d.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (dist < bd) { bd = dist; best = d; }
  }
  return best;
}
