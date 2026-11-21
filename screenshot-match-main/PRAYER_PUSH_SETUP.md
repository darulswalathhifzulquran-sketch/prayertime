# JAMIA AWQAAT — Production Web Push activation

The app includes a service worker, an opt-in notification screen, a VAPID
Web Push sender, Redis-backed subscriptions, and a protected dispatch API.
**Push is disabled by design until all production services are configured.**
The app does not silently request notification permissions.

## Requirements

1. Use the **production Vercel project that serves**
   https://screenshot-match-main.vercel.app/ (not a different Jamia project).
2. Create an Upstash Redis database with REST access; put its HTTPS REST URL and
   REST token into Vercel production environment variables, never into Git.
3. Generate a new VAPID key pair offline using
   `bunx web-push generate-vapid-keys` (or `npx web-push generate-vapid-keys`).
   Set both keys in Vercel. Never commit the private key.
4. Set a random 32+-character `CRON_SECRET` to guard the dispatch endpoint.
5. Configure a trusted scheduler to invoke the authenticated endpoint
   `GET https://screenshot-match-main.vercel.app/api/push/dispatch`
   every minute with header `Authorization: Bearer <CRON_SECRET>`.
   If your **Vercel plan supports per-minute Cron Jobs**, you may add
   `{"path":"/api/push/dispatch","schedule":"* * * * *"}` to the
   `crons` array of `vercel.json`. Do not add this until checking the plan:
   Vercel Hobby generally cannot schedule every minute and may reject deployment.
6. Confirm `/api/push/config` returns `{"ready":true, ...}` on the actual
   production domain. The public key is safe to expose; private key is not.
7. On **iPhone iOS 16.4+**, add JAMIA AWQAAT to Home Screen from Safari, open
   the installed app, visit Reminders, and tap "Allow prayer notifications"
   once to grant OS permission and subscribe. Android also requires permission.
8. Test with a consented device and actual due prayer time. Inspect Vercel
   dispatch logs and stale-subscription cleanup before enabling for all users.

Required Vercel production environment variables:
- `WEB_PUSH_PUBLIC_KEY` — base64url VAPID public key
- `WEB_PUSH_PRIVATE_KEY` — secret base64url private key
- `WEB_PUSH_CONTACT` — email URI, e.g. `mailto:admin@example.org`
- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST HTTPS endpoint
- `UPSTASH_REDIS_REST_TOKEN` — secret REST token
- `CRON_SECRET` — random strong scheduler authentication token

## Data retention and privacy

Only explicitly opted-in clients are saved. Stored: encrypted push
subscription endpoint/keys, prayer calculation method/school/language, and
**latitude/longitude rounded to two decimal places** (approximate location).
Exact GPS is not stored. Subscriptions expire after 90 days without refresh.
Users can unsubscribe from the Reminders page or block notifications in OS settings.
Do not enable this feature if you cannot disclose server-side location storage.

## Platform limitations

- A browser cannot bypass Apple's user gesture and notification-permission step.
- The phone OS controls lock-screen placement, vibration, and sounds. The
  screenshot is a visual reference, not an exact UI the website can render.
- Web push delivery and cron execution are best-effort, not mathematically exact
  to the second. Internet, focus modes, power-saving and device policies can delay
  or suppress alerts.
- No Azan at Sunrise. Alerts cover the five obligatory prayer starts.
- If push setup is incomplete, current foreground reminders work only while
  app JavaScript remains active. Never market this as closed-app push.
- Prayer timings come from AlAdhan and may differ from the locally approved
  masjid timetable; verify before relying on notifications.
