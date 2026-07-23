import { and, eq } from "drizzle-orm";
import { getDb } from "#/server/db/client";
import { providerCalls } from "#/server/db/schema";
import { createId } from "#/shared/ids";

const ambiguousProviderMessage = "A provider call may already have been billed; manual retry is required.";

export class AmbiguousProviderCallError extends Error {
  readonly code = "PROVIDER_AMBIGUOUS";

  constructor(message = ambiguousProviderMessage) {
    super(message);
    this.name = "AmbiguousProviderCallError";
  }
}

export function isAmbiguousProviderCallError(error: unknown): boolean {
  if (error instanceof AmbiguousProviderCallError) return true;
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; message?: unknown; name?: unknown };
  return value.code === "PROVIDER_AMBIGUOUS" || value.name === "AmbiguousProviderCallError" || value.message === ambiguousProviderMessage;
}

export type ProviderOperation = "generate_cards" | "verify_cards" | "generate_image";

export async function beginProviderCall(jobId: string, stepKey: string, operation: ProviderOperation): Promise<string> {
  const db = getDb();
  const now = new Date();
  await db
    .insert(providerCalls)
    .values({
      id: createId("call"),
      jobId,
      stepKey,
      operation,
      status: "prepared",
      createdAt: now
    })
    .onConflictDoNothing();

  const [started] = await db
    .update(providerCalls)
    .set({ status: "started", startedAt: now })
    .where(and(eq(providerCalls.jobId, jobId), eq(providerCalls.stepKey, stepKey), eq(providerCalls.status, "prepared")))
    .returning({ id: providerCalls.id });
  if (!started) {
    await db
      .update(providerCalls)
      .set({ status: "ambiguous" })
      .where(and(eq(providerCalls.jobId, jobId), eq(providerCalls.stepKey, stepKey), eq(providerCalls.status, "started")));
    throw new AmbiguousProviderCallError();
  }
  return started.id;
}

export async function completeProviderCall(callId: string, requestId: string | null, usage: unknown): Promise<void> {
  await getDb()
    .update(providerCalls)
    .set({
      status: "completed",
      providerRequestId: requestId,
      usageJson: usage ? JSON.stringify(usage) : null,
      completedAt: new Date()
    })
    .where(and(eq(providerCalls.id, callId), eq(providerCalls.status, "started")));
}
