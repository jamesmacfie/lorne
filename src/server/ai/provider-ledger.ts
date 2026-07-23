import { and, eq } from "drizzle-orm";
import { getDb } from "#/server/db/client";
import { providerCalls } from "#/server/db/schema";
import { createId } from "#/shared/ids";

export class AmbiguousProviderCallError extends Error {}

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
    throw new AmbiguousProviderCallError("A provider call may already have been billed; manual retry is required.");
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
