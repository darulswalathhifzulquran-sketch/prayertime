/* JAMIA AWQAAT: native-looking system notifications, including Web Push.
   The OS determines lock-screen appearance, sound and vibration availability. */
self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const prayer = typeof payload.prayer === "string" && /^(Fajr|Dhuhr|Asr|Maghrib|Isha)$/.test(payload.prayer)
    ? payload.prayer : "Prayer";
  const title = "JAMIA AWQAAT · " + prayer;
  const body = typeof payload.body === "string" && payload.body.length < 150
    ? payload.body : "It's time to pray!";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "jamia-prayer-" + prayer + "-" + (payload.date || "today"),
    data: {url: "/"},
    requireInteraction: false,
    renotify: false,
    vibrate: [200, 100, 200],
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL("/", self.location.origin).href;
    const clients = await self.clients.matchAll({type: "window", includeUncontrolled: true});
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin)) {
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
