import { createFileRoute } from "@tanstack/react-router";
import { pushConfigured, savePushSubscription, deletePushSubscription, validatePushRecord, allowPushRegistration } from "@/lib/prayer-push.server";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  return origin === url.origin;
}

export const Route = createFileRoute("/api/push/subscription")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!pushConfigured()) return Response.json({ error: "Background push not configured" }, { status: 503 });
        if (!sameOrigin(request)) return Response.json({ error: "Origin rejected" }, { status: 403 });
        if (!request.headers.get("content-type")?.startsWith("application/json"))
          return Response.json({ error: "JSON required" }, { status: 415 });
        let body: unknown;
        try {
          const raw = await request.text();
          if (raw.length > 5000) return Response.json({ error: "Payload too large" }, { status: 413 });
          body = JSON.parse(raw);
        } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
        const record = validatePushRecord(body);
        if (!record) return Response.json({ error: "Invalid push subscription" }, { status: 400 });
        try {
          const caller = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            request.headers.get("x-real-ip") || "unknown";
          if (!await allowPushRegistration(caller)) {
            return Response.json({ error: "Too many subscriptions" }, { status: 429 });
          }
          await savePushSubscription(record);
          return Response.json({ enabled: true }, { headers: { "Cache-Control": "no-store" } });
        } catch { return Response.json({ error: "Push storage unavailable" }, { status: 503 }); }
      },
      DELETE: async ({ request }) => {
        if (!pushConfigured()) return Response.json({ error: "Background push not configured" }, { status: 503 });
        if (!sameOrigin(request)) return Response.json({ error: "Origin rejected" }, { status: 403 });
        let body: { endpoint?: string } = {};
        try { body = await request.json() as { endpoint?: string }; } catch {}
        if (typeof body.endpoint !== "string" || body.endpoint.length > 2200)
          return Response.json({ error: "Invalid endpoint" }, { status: 400 });
        try { await deletePushSubscription(body.endpoint); return Response.json({ enabled: false }); }
        catch { return Response.json({ error: "Storage unavailable" }, { status: 503 }); }
      },
    },
  },
});
