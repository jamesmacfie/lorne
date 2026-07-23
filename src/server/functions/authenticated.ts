import { env } from "cloudflare:workers";
import { getRequest } from "@tanstack/react-start/server";
import { getSession } from "#/server/auth/auth";
import { isTrustedMutationOrigin } from "#/server/security/http";

export class SessionRequiredError extends Error {}
export class OriginRejectedError extends Error {}

export async function serverUser(options: { mutation?: boolean } = {}) {
  const request = getRequest();
  if (options.mutation && !isTrustedMutationOrigin(request, env.BETTER_AUTH_URL)) throw new OriginRejectedError("Request origin rejected.");
  const session = await getSession(request);
  if (!session?.user) throw new SessionRequiredError("Sign in to continue.");
  return session.user;
}
