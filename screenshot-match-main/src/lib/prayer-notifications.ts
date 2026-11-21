import type { PrayerKey } from "./prayer";

const PRAYERS = new Set<string>(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]);

export function prayerNotificationBody(prayer: PrayerKey, time: string): string {
  if (!PRAYERS.has(prayer)) throw new Error("Sunrise must not send a prayer notification");
  return `${prayer} at ${time} — It's time to pray!`;
}

export function canUsePrayerNotifications(): boolean {
  return typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    window.isSecureContext;
}

export async function registerPrayerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUsePrayerNotifications()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/** Called only after permission was granted. This is a foreground fallback;
 * remote Push API delivery is still necessary once the app is suspended/closed. */
export async function showForegroundPrayerNotification(
  prayer: PrayerKey,
  time: string,
  date: string,
): Promise<void> {
  if (!PRAYERS.has(prayer) || !canUsePrayerNotifications() || Notification.permission !== "granted") return;
  const registration = await registerPrayerServiceWorker();
  if (!registration) return;
  try {
    await registration.showNotification(`JAMIA AWQAAT · ${prayer}`, {
      body: prayerNotificationBody(prayer, time),
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: `jamia-prayer-${prayer}-${date}`,
      data: { url: "/" },
      requireInteraction: false,
    });
  } catch {
    // Some browsers grant notifications but restrict them in the current mode.
  }
}
