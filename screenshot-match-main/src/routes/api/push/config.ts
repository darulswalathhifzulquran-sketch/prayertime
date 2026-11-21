import { createFileRoute } from "@tanstack/react-router";
import { pushConfigured, pushPublicKey } from "@/lib/prayer-push.server";

export const Route = createFileRoute("/api/push/config")({
  server: {
    handlers: {
      GET: async () => Response.json(
        { ready: pushConfigured(), publicKey: pushPublicKey() },
        { headers: { "Cache-Control": "no-store" } },
      ),
    },
  },
});
