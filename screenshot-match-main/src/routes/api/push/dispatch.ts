import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { dispatchPrayerPush } from "@/lib/prayer-push.server";

export const Route = createFileRoute("/api/push/dispatch")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET || "";
        const supplied = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
        const valid = secret.length > 24 && supplied.length === secret.length &&
          timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
        if (!valid) return Response.json({ error: "Unauthorized" }, { status: 401 });
        try {
          const result = await dispatchPrayerPush();
          return Response.json(result, { headers: { "Cache-Control": "no-store" } });
        } catch {
          return Response.json({ error: "Push dispatch unavailable" }, { status: 503 });
        }
      },
    },
  },
});
