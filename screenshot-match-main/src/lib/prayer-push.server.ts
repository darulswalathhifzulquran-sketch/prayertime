import { createHash } from "node:crypto";
import webPush from "web-push";
import { istDateKey, istSecondsOfDay, toMinutes, type PrayerKey } from "./prayer";

const INDEX = "jamia-awqaat:prayer-push:ids";
const PRAYERS: PrayerKey[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const TTL = 60 * 60 * 24 * 90;

export type PushRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  latitude: number;
  longitude: number;
  method: number;
  school: 0 | 1;
  language: "en" | "ml" | "ar";
};

function config() {
  return {
    vapidPublic: process.env.WEB_PUSH_PUBLIC_KEY || "",
    vapidPrivate: process.env.WEB_PUSH_PRIVATE_KEY || "",
    vapidContact: process.env.WEB_PUSH_CONTACT || "",
    redisUrl: process.env.UPSTASH_REDIS_REST_URL || "",
    redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    cronSecret: process.env.CRON_SECRET || "",
  };
}

export function pushConfigured(): boolean {
  const c = config();
  return !!(c.vapidPublic && c.vapidPrivate && c.vapidContact && c.redisUrl && c.redisToken && c.cronSecret);
}
export function pushPublicKey(): string {
  return pushConfigured() ? config().vapidPublic : "";
}

function redisEndpoint(): string {
  const url = config().redisUrl;
  if (!url.startsWith("https://")) throw new Error("Redis service is not configured over HTTPS");
  return url.replace(/\/$/, "");
}

async function redisCommand(command: (string | number)[]): Promise<unknown> {
  const response = await fetch(redisEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config().redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(7500),
  });
  if (!response.ok) throw new Error("Push storage is unavailable");
  const result = (await response.json()) as { result?: unknown; error?: string };
  if (result.error) throw new Error("Push storage rejected the operation");
  return result.result;
}

const storageKey = (id: string) => `jamia-awqaat:prayer-push:sub:${id}`;
const hashEndpoint = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

const allowedPushHost = (host: string) => (
  host === "fcm.googleapis.com" ||
  host === "updates.push.services.mozilla.com" ||
  host === "web.push.apple.com" ||
  host.endsWith(".push.apple.com") ||
  host.endsWith(".notify.windows.com") ||
  host.endsWith(".wns.windows.com")
);

export function validatePushRecord(input: unknown): PushRecord | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Partial<PushRecord>;
  const host = (() => {
    try { const url = new URL(r.endpoint ?? ""); return url.protocol === "https:" ? url.hostname : ""; }
    catch { return ""; }
  })();
  if (!allowedPushHost(host) || typeof r.endpoint !== "string" || r.endpoint.length > 2200) return null;
  if (!r.keys || typeof r.keys.p256dh !== "string" || typeof r.keys.auth !== "string" ||
      !/^[A-Za-z0-9_-]{60,130}$/.test(r.keys.p256dh) || !/^[A-Za-z0-9_-]{12,36}$/.test(r.keys.auth)) return null;
  if (typeof r.latitude !== "number" || typeof r.longitude !== "number" ||
      !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude) ||
      r.latitude < 6 || r.latitude > 38 || r.longitude < 68 || r.longitude > 98) return null;
  if (typeof r.method !== "number" || !Number.isInteger(r.method) || r.method < 1 || r.method > 20 ||
      (r.school !== 0 && r.school !== 1) || !["en", "ml", "ar"].includes(r.language || "")) return null;
  return {
    endpoint: r.endpoint,
    keys: { p256dh: r.keys.p256dh, auth: r.keys.auth },
    // Coarse, approximately kilometre-scale coordinates, not precise GPS.
    latitude: Number(r.latitude.toFixed(2)),
    longitude: Number(r.longitude.toFixed(2)),
    method: r.method,
    school: r.school,
    language: r.language as PushRecord["language"],
  };
}

export async function savePushSubscription(record: PushRecord): Promise<void> {
  const id = hashEndpoint(record.endpoint);
  await redisCommand(["SET", storageKey(id), JSON.stringify(record), "EX", TTL]);
  await redisCommand(["SADD", INDEX, id]);
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const id = hashEndpoint(endpoint);
  await redisCommand(["DEL", storageKey(id)]);
  await redisCommand(["SREM", INDEX, id]);
}

async function getActiveRecords(): Promise<PushRecord[]> {
  const ids = await redisCommand(["SMEMBERS", INDEX]) as string[] | null;
  if (!Array.isArray(ids) || !ids.length) return [];
  const selected = ids.slice(0, 300);
  const values = await redisCommand(["MGET", ...selected.map(storageKey)]) as (string | null)[];
  const records: PushRecord[] = [];
  for (let i = 0; i < selected.length; i++) {
    if (!values?.[i]) {
      await redisCommand(["SREM", INDEX, selected[i]]);
      continue;
    }
    try {
      const record = validatePushRecord(JSON.parse(values[i]!));
      if (record) records.push(record);
    } catch { /* ignore corrupt stored entry */ }
  }
  return records;
}

async function fetchTimings(record: PushRecord, now: Date): Promise<Record<PrayerKey, string>> {
  const date = istDateKey(now);
  const query = new URLSearchParams({
    latitude: String(record.latitude),
    longitude: String(record.longitude),
    method: String(record.method),
    school: String(record.school),
  });
  const response = await fetch(`https://api.aladhan.com/v1/timings/${date}?${query}`, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Prayer-time provider is unavailable");
  const result = await response.json() as {
    code?: number;
    data?: { timings?: Record<string, string>; meta?: { timezone?: string } };
  };
  if (result.code !== 200 || result.data?.meta?.timezone !== "Asia/Kolkata" || !result.data.timings)
    throw new Error("Unexpected prayer-time provider location");
  return Object.fromEntries(PRAYERS.map((key) => {
    const value = result.data!.timings![key]?.match(/^\d{1,2}:\d{2}/)?.[0];
    if (!value) throw new Error("Invalid prayer time");
    return [key, value];
  })) as Record<PrayerKey, string>;
}

/** Authorized scheduler invokes this once per minute. This is not a realtime
 * guarantee; system push delivery and external cron can be delayed. */
export async function dispatchPrayerPush(now = new Date()): Promise<{ checked: number; sent: number }> {
  if (!pushConfigured()) return { checked: 0, sent: 0 };
  const c = config();
  webPush.setVapidDetails(c.vapidContact, c.vapidPublic, c.vapidPrivate);
  const subscriptions = await getActiveRecords();
  const date = istDateKey(now);
  const currentMinute = Math.floor(istSecondsOfDay(now) / 60);
  let sent = 0;
  const schedules = new Map<string, Promise<Record<PrayerKey, string>>>();
  for (const record of subscriptions) {
    const scheduleKey = `${record.latitude}:${record.longitude}:${record.method}:${record.school}`;
    if (!schedules.has(scheduleKey)) schedules.set(scheduleKey, fetchTimings(record, now));
    let timings: Record<PrayerKey, string>;
    try { timings = await schedules.get(scheduleKey)!; } catch { continue; }
    for (const prayer of PRAYERS) {
      const dueMinute = toMinutes(timings[prayer]);
      if (currentMinute < dueMinute || currentMinute > dueMinute + 1) continue;
      const id = hashEndpoint(record.endpoint);
      const dedupKey = `jamia-awqaat:prayer-push:sent:${id}:${date}:${prayer}`;
      const claimed = await redisCommand(["SET", dedupKey, "1", "NX", "EX", 172800]);
      if (claimed !== "OK") continue;
      try {
        const label = prayer === "Dhuhr" ? "Dhuhr" : prayer;
        await webPush.sendNotification(
          { endpoint: record.endpoint, keys: record.keys },
          JSON.stringify({
            prayer: label,
            body: `${prayer} at ${timings[prayer]} — It's time to pray!`,
            date,
          }),
          { TTL: 120, urgency: "high" },
        );
        sent++;
      } catch (error) {
        const code = typeof error === "object" && error && "statusCode" in error
          ? Number((error as {statusCode?: number}).statusCode) : 0;
        if (code === 404 || code === 410) await deletePushSubscription(record.endpoint);
        else await redisCommand(["DEL", dedupKey]);
      }
    }
  }
  return { checked: subscriptions.length, sent };
}
