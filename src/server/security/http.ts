import type { SafeErrorCode } from "#/shared/contracts";

export function jsonError(status: number, code: SafeErrorCode, message: string): Response {
  return Response.json({ ok: false, code, message }, { status });
}

export function isTrustedMutationOrigin(request: Request, canonicalOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(canonicalOrigin).origin;
  } catch {
    return false;
  }
}

export function addSecurityHeaders(response: Response, production: boolean, noStore = false): Response {
  const headers = new Headers(response.headers);
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' blob: data:",
      "font-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'"
    ].join("; ")
  );
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  if (noStore) headers.set("Cache-Control", "no-store");
  if (production) headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
