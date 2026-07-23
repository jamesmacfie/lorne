import { env } from "cloudflare:workers";
import { getSession } from "./auth";
import { isTrustedMutationOrigin } from "#/server/security/http";

export type AuthenticatedRequest = {
  request: Request;
  user: { id: string; email: string; name: string; image?: string | null };
};

export async function requireSession(request: Request): Promise<AuthenticatedRequest | null> {
  const session = await getSession(request);
  if (!session?.user) return null;
  return { request, user: session.user };
}

export async function requireTrustedMutation(request: Request): Promise<AuthenticatedRequest | null> {
  if (!isTrustedMutationOrigin(request, env.BETTER_AUTH_URL)) return null;
  return requireSession(request);
}
