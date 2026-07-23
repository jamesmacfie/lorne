import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { requireSession } from "#/server/auth/authorization";
import { getDb } from "#/server/db/client";
import { cardAssets } from "#/server/db/schema";
import { jsonError } from "#/server/security/http";

export const Route = createFileRoute("/api/assets/$assetId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const authenticated = await requireSession(request);
        if (!authenticated) return jsonError(401, "AUTH_REQUIRED", "Sign in to view this image.");
        const [asset] = await getDb()
          .select()
          .from(cardAssets)
          .where(and(eq(cardAssets.id, params.assetId), eq(cardAssets.userId, authenticated.user.id), eq(cardAssets.status, "ready")))
          .limit(1);
        if (!asset) return jsonError(404, "NOT_FOUND", "Image not found.");
        const object = await env.CARD_IMAGES.get(asset.r2Key);
        if (!object) return jsonError(404, "NOT_FOUND", "Image not found.");
        const etag = `"${asset.contentHash}"`;
        if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
        const headers = new Headers({
          "Content-Type": asset.mimeType,
          "Content-Length": String(asset.byteSize),
          "Cache-Control": "private, max-age=86400",
          ETag: etag,
          "X-Content-Type-Options": "nosniff"
        });
        return new Response(object.body, { headers });
      }
    }
  }
});
