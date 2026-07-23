import { env } from "cloudflare:workers";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "#/server/db/client";
import { generationJobs, topics, userAiCredentials } from "#/server/db/schema";
import { sha256Hex } from "#/shared/ids";

export class GenerationStartError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "CREDENTIAL_REQUIRED"
      | "CREDENTIAL_INVALID"
      | "CREDENTIAL_LIMITED"
      | "RATE_LIMITED"
      | "ACTIVE_JOB_LIMIT"
      | "TOPIC_JOB_ACTIVE"
  ) {
    super(code);
  }
}

export async function startGeneration(userId: string, input: { topicId: string; count: 20 | 30 | 50; idempotencyKey: string }) {
  const db = getDb();
  const limit = Math.min(Number(env.MAX_GENERATION_CARD_COUNT), 50);
  if (input.count > limit) throw new GenerationStartError("ACTIVE_JOB_LIMIT");

  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.id, input.topicId), eq(topics.userId, userId), eq(topics.status, "active")))
    .limit(1);
  if (!topic) throw new GenerationStartError("NOT_FOUND");

  const jobId = `job_${(await sha256Hex(`${userId}\u0000${input.idempotencyKey}`)).slice(0, 40)}`;
  const existing = await db.query.generationJobs.findFirst({ where: and(eq(generationJobs.id, jobId), eq(generationJobs.userId, userId)) });
  if (existing) return existing;

  const rate = await env.GENERATION_RATE_LIMITER.limit({ key: userId });
  if (!rate.success) throw new GenerationStartError("RATE_LIMITED");

  const credential = await db.query.userAiCredentials.findFirst({ where: eq(userAiCredentials.userId, userId) });
  if (!credential) throw new GenerationStartError("CREDENTIAL_REQUIRED");
  if (credential.status === "invalid") throw new GenerationStartError("CREDENTIAL_INVALID");
  if (credential.status === "limited") throw new GenerationStartError("CREDENTIAL_LIMITED");

  const active = await db
    .select({ slot: generationJobs.activeSlot })
    .from(generationJobs)
    .where(and(eq(generationJobs.userId, userId), inArray(generationJobs.status, ["queued", "running"])));
  const maxActive = Math.max(1, Number(env.MAX_ACTIVE_GENERATION_JOBS));
  const usedSlots = new Set(active.map((row) => row.slot).filter((slot): slot is number => slot !== null));
  const availableSlots = Array.from({ length: maxActive }, (_, index) => index + 1).filter((slot) => !usedSlots.has(slot));
  if (availableSlots.length === 0) throw new GenerationStartError("ACTIVE_JOB_LIMIT");

  const workflowInstanceId = jobId;
  const now = new Date();
  let inserted = false;
  let lastInsertError: unknown;
  for (const activeSlot of availableSlots) {
    try {
      await db.insert(generationJobs).values({
        id: jobId,
        workflowInstanceId,
        userId,
        topicId: input.topicId,
        activeSlot,
        status: "queued",
        requestedCount: input.count,
        createdAt: now,
        updatedAt: now
      });
      inserted = true;
      break;
    } catch (error) {
      lastInsertError = error;
      const idempotentJob = await db.query.generationJobs.findFirst({
        where: and(eq(generationJobs.id, jobId), eq(generationJobs.userId, userId))
      });
      if (idempotentJob) return idempotentJob;
      const activeTopic = await db.query.generationJobs.findFirst({
        where: and(eq(generationJobs.topicId, input.topicId), inArray(generationJobs.status, ["queued", "running"]))
      });
      if (activeTopic) throw new GenerationStartError("TOPIC_JOB_ACTIVE");
    }
  }
  if (!inserted) {
    const activeAfterRace = await db
      .select({ slot: generationJobs.activeSlot })
      .from(generationJobs)
      .where(and(eq(generationJobs.userId, userId), inArray(generationJobs.status, ["queued", "running"])));
    if (activeAfterRace.length >= maxActive) throw new GenerationStartError("ACTIVE_JOB_LIMIT");
    throw lastInsertError;
  }

  try {
    await env.CARD_GENERATION_WORKFLOW.create({ id: workflowInstanceId, params: { jobId, userId, topicId: input.topicId } });
  } catch (error) {
    await db
      .update(generationJobs)
      .set({ status: "failed", safeErrorCode: "INTERNAL_ERROR", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));
    throw error;
  }
  return db.query.generationJobs.findFirst({ where: eq(generationJobs.id, jobId) });
}

export async function listGenerationJobs(userId: string, topicId?: string) {
  const filters = [eq(generationJobs.userId, userId)];
  if (topicId) filters.push(eq(generationJobs.topicId, topicId));
  return getDb()
    .select()
    .from(generationJobs)
    .where(and(...filters))
    .orderBy(generationJobs.createdAt)
    .limit(50);
}

export async function getGenerationJob(userId: string, jobId: string) {
  return getDb().query.generationJobs.findFirst({ where: and(eq(generationJobs.id, jobId), eq(generationJobs.userId, userId)) });
}
