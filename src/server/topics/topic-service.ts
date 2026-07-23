import { and, eq, sql } from "drizzle-orm";
import { getDb } from "#/server/db/client";
import { cards, topics } from "#/server/db/schema";
import { cardFingerprint } from "#/server/domain/cards";
import type { TopicInput } from "#/shared/contracts";
import { createId } from "#/shared/ids";

export class TopicDomainError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_HIERARCHY",
    message: string
  ) {
    super(message);
  }
}

async function assertParentAllowed(userId: string, topicId: string | null, parentTopicId: string | null): Promise<void> {
  if (!parentTopicId) return;
  if (parentTopicId === topicId) throw new TopicDomainError("INVALID_HIERARCHY", "A topic cannot be its own parent.");
  const ownedTopics = await getDb()
    .select({ id: topics.id, parentTopicId: topics.parentTopicId })
    .from(topics)
    .where(eq(topics.userId, userId));
  const byId = new Map(ownedTopics.map((topic) => [topic.id, topic.parentTopicId]));
  if (!byId.has(parentTopicId)) throw new TopicDomainError("FORBIDDEN", "The parent topic is unavailable.");
  let cursor: string | null | undefined = parentTopicId;
  while (cursor) {
    if (cursor === topicId) throw new TopicDomainError("INVALID_HIERARCHY", "That change would create a topic cycle.");
    cursor = byId.get(cursor);
  }
}

export async function listTopics(userId: string) {
  return getDb().select().from(topics).where(eq(topics.userId, userId)).orderBy(topics.createdAt);
}

export async function createTopics(userId: string, inputs: TopicInput[]) {
  const db = getDb();
  const now = new Date();
  const created = [];
  for (const input of inputs) {
    await assertParentAllowed(userId, null, input.parentTopicId);
    const value = { id: createId("topic"), userId, ...input, status: "active" as const, createdAt: now, updatedAt: now };
    await db.insert(topics).values(value);
    created.push(value);
  }
  return created;
}

export async function updateTopic(userId: string, topicId: string, input: TopicInput & { status?: "active" | "archived" }) {
  const db = getDb();
  const [existing] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
    .limit(1);
  if (!existing) throw new TopicDomainError("NOT_FOUND", "Topic not found.");
  await assertParentAllowed(userId, topicId, input.parentTopicId);
  const [updated] = await db
    .update(topics)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
    .returning();
  return updated;
}

export async function archiveTopic(userId: string, topicId: string) {
  const [updated] = await getDb()
    .update(topics)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
    .returning();
  if (!updated) throw new TopicDomainError("NOT_FOUND", "Topic not found.");
  return updated;
}

export async function deleteTopic(userId: string, topicId: string): Promise<void> {
  const [deleted] = await getDb()
    .delete(topics)
    .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
    .returning({ id: topics.id });
  if (!deleted) throw new TopicDomainError("NOT_FOUND", "Topic not found.");
}

export async function listTopicCards(userId: string, topicId: string) {
  return getDb()
    .select()
    .from(cards)
    .where(and(eq(cards.userId, userId), eq(cards.topicId, topicId)))
    .orderBy(cards.createdAt);
}

export async function updateCard(
  userId: string,
  input: {
    id: string;
    front: string;
    back: string;
    hint: string;
    explanation: string;
    status: "published" | "archived" | "flagged";
  }
) {
  const fingerprint = await cardFingerprint(input.front, input.back);
  const [updated] = await getDb()
    .update(cards)
    .set({
      front: input.front,
      back: input.back,
      hint: input.hint,
      explanation: input.explanation,
      status: input.status,
      source: "edited",
      fingerprint,
      version: sql`${cards.version} + 1`,
      updatedAt: new Date()
    })
    .where(and(eq(cards.id, input.id), eq(cards.userId, userId)))
    .returning();
  if (!updated) throw new TopicDomainError("NOT_FOUND", "Card not found.");
  return updated;
}
