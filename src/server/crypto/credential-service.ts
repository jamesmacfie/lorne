import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "#/server/db/client";
import { userAiCredentials } from "#/server/db/schema";
import { createId } from "#/shared/ids";
import { decryptCredential, encryptCredential, importMasterKey } from "./credential-vault";

export type CredentialCapability = "models:read" | "responses:write" | "images:write";
export type CredentialStatus = "verified" | "limited" | "invalid";

export class CredentialUnavailableError extends Error {
  constructor(public readonly reason: "missing" | "invalid" | "limited") {
    super(`OpenAI credential is ${reason}.`);
  }
}

function activeKeyVersion(): number {
  const version = Number(env.CREDENTIAL_KEY_ACTIVE_VERSION);
  if (!Number.isInteger(version) || version < 1) throw new Error("Invalid active credential key version.");
  return version;
}

function encodedMasterKey(version: number): string {
  if (version === 1) return env.OPENAI_CREDENTIAL_ENCRYPTION_KEY_V1;
  const maybeRotatedEnv = env as Env & { OPENAI_CREDENTIAL_ENCRYPTION_KEY_V2?: string };
  if (version === 2 && maybeRotatedEnv.OPENAI_CREDENTIAL_ENCRYPTION_KEY_V2) return maybeRotatedEnv.OPENAI_CREDENTIAL_ENCRYPTION_KEY_V2;
  throw new Error(`Credential key version ${version} is not configured.`);
}

async function validateOpenAiKey(apiKey: string): Promise<{ status: CredentialStatus; capabilities: CredentialCapability[] }> {
  const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(env.OPENAI_TEXT_MODEL)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000)
  });
  if (response.status === 401) return { status: "invalid", capabilities: [] };
  if (response.status === 403 || response.status === 404) return { status: "limited", capabilities: [] };
  if (!response.ok) throw new Error("OpenAI credential validation is temporarily unavailable.");
  return { status: "verified", capabilities: ["models:read", "responses:write", "images:write"] };
}

export async function saveCredential(userId: string, apiKey: string) {
  const validation = await validateOpenAiKey(apiKey);
  if (validation.status === "invalid") return { saved: false as const, status: "invalid" as const };

  const db = getDb();
  const existing = await db.query.userAiCredentials.findFirst({
    columns: { id: true, createdAt: true },
    where: eq(userAiCredentials.userId, userId)
  });
  const now = new Date();
  const id = existing?.id ?? createId("cred");
  const keyVersion = activeKeyVersion();
  const masterKey = await importMasterKey(encodedMasterKey(keyVersion));
  const envelope = await encryptCredential({ plaintext: apiKey, credentialId: id, userId, keyVersion, masterKey });
  const values = {
    id,
    userId,
    provider: "openai" as const,
    ...envelope,
    lastFour: apiKey.slice(-4),
    status: validation.status,
    capabilitiesJson: JSON.stringify(validation.capabilities),
    validatedAt: now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  await db
    .insert(userAiCredentials)
    .values(values)
    .onConflictDoUpdate({
      target: userAiCredentials.userId,
      set: {
        ciphertext: values.ciphertext,
        iv: values.iv,
        keyVersion: values.keyVersion,
        lastFour: values.lastFour,
        status: values.status,
        capabilitiesJson: values.capabilitiesJson,
        validatedAt: now,
        updatedAt: now
      }
    });
  return { saved: true as const, status: validation.status, lastFour: values.lastFour };
}

export async function deleteCredential(userId: string): Promise<void> {
  await getDb().delete(userAiCredentials).where(eq(userAiCredentials.userId, userId));
}

export async function credentialSummary(userId: string) {
  const credential = await getDb().query.userAiCredentials.findFirst({
    columns: { lastFour: true, status: true, validatedAt: true },
    where: eq(userAiCredentials.userId, userId)
  });
  return credential
    ? {
        configured: true as const,
        lastFour: credential.lastFour,
        status: credential.status,
        validatedAt: credential.validatedAt?.toISOString() ?? null
      }
    : { configured: false as const, lastFour: null, status: null, validatedAt: null };
}

export async function loadPlaintextCredential(userId: string): Promise<string> {
  const db = getDb();
  const credential = await db.query.userAiCredentials.findFirst({ where: eq(userAiCredentials.userId, userId) });
  if (!credential) throw new CredentialUnavailableError("missing");
  if (credential.status === "invalid") throw new CredentialUnavailableError("invalid");
  if (credential.status === "limited") throw new CredentialUnavailableError("limited");

  const masterKey = await importMasterKey(encodedMasterKey(credential.keyVersion));
  const plaintext = await decryptCredential({
    envelope: { ciphertext: credential.ciphertext, iv: credential.iv, keyVersion: credential.keyVersion },
    credentialId: credential.id,
    userId,
    masterKey
  });

  const currentVersion = activeKeyVersion();
  if (currentVersion !== credential.keyVersion) {
    const currentKey = await importMasterKey(encodedMasterKey(currentVersion));
    const rotated = await encryptCredential({
      plaintext,
      credentialId: credential.id,
      userId,
      keyVersion: currentVersion,
      masterKey: currentKey
    });
    await db
      .update(userAiCredentials)
      .set({ ...rotated, updatedAt: new Date() })
      .where(eq(userAiCredentials.id, credential.id));
  }
  return plaintext;
}
