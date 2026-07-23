import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { reviewSyncInputSchema } from "#/shared/contracts";
import { requireSession } from "#/server/auth/authorization";
import { isTrustedMutationOrigin, jsonError } from "#/server/security/http";
import { syncReviewEvents } from "#/server/study/study-service";

export const Route = createFileRoute("/api/reviews/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isTrustedMutationOrigin(request, env.BETTER_AUTH_URL)) return jsonError(403, "FORBIDDEN", "Request origin rejected.");
        const authenticated = await requireSession(request);
        if (!authenticated) return jsonError(401, "AUTH_REQUIRED", "Sign in to synchronize reviews.");
        if (Number(request.headers.get("content-length") ?? 0) > 96_000)
          return jsonError(413, "INVALID_INPUT", "Review batch is too large.");
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return jsonError(400, "INVALID_INPUT", "Review batch is not valid JSON.");
        }
        const parsed = reviewSyncInputSchema.safeParse(payload);
        if (!parsed.success) return jsonError(400, "INVALID_INPUT", "Review batch is invalid.");
        return Response.json({ ok: true, data: await syncReviewEvents(authenticated.user.id, parsed.data.events) });
      }
    }
  }
});
