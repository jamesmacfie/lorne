import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getDb } from "#/server/db/client";
import * as schema from "#/server/db/schema";
import { betaInvites, userPreferences } from "#/server/db/schema";
import { hashInviteCode, isValidUsername, normalizeInviteEmail } from "./invites";

export function getAuth() {
  const db = getDb();
  const production = env.APP_ENV === "production" || env.APP_ENV === "staging";

  return betterAuth({
    appName: "Lorne",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
      transaction: false
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: true
    },
    account: { accountLinking: { enabled: false } },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 60 * 5 }
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/username": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 }
      }
    },
    advanced: {
      useSecureCookies: production,
      cookiePrefix: "lorne",
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip"]
      }
    },
    trustedOrigins: [env.BETTER_AUTH_URL],
    databaseHooks: {
      user: {
        create: {
          before: async (candidate, context) => {
            const email = normalizeInviteEmail(candidate.email);
            const inviteCode = typeof context?.body?.inviteCode === "string" ? context.body.inviteCode : "";
            const codeHash = inviteCode ? await hashInviteCode(inviteCode) : "";
            const [invite] = await db
              .select({ id: betaInvites.id })
              .from(betaInvites)
              .where(and(eq(betaInvites.email, email), eq(betaInvites.codeHash, codeHash), eq(betaInvites.status, "pending")))
              .limit(1);
            if (!invite) {
              throw APIError.from("FORBIDDEN", {
                code: "INVALID_INVITE",
                message: "That invite email or code was not accepted."
              });
            }
            return { data: { ...candidate, email } };
          },
          after: async (createdUser) => {
            const now = new Date();
            const email = normalizeInviteEmail(createdUser.email);
            await db.update(betaInvites).set({ status: "accepted", acceptedAt: now }).where(eq(betaInvites.email, email));
            await db
              .insert(userPreferences)
              .values({
                userId: createdUser.id,
                timezone: "Pacific/Auckland",
                dailyGoal: 10,
                textCardPercent: 70,
                updatedAt: now
              })
              .onConflictDoNothing();
          }
        }
      }
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 120,
        usernameValidator: isValidUsername
      }),
      tanstackStartCookies()
    ]
  });
}

export type Auth = ReturnType<typeof getAuth>;

export async function getSession(request: Request) {
  return getAuth().api.getSession({ headers: request.headers });
}
