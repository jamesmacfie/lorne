import { eq } from "drizzle-orm";
import { getDb } from "#/server/db/client";
import { topics } from "#/server/db/schema";
import { buildTopicPath } from "./topic-path";

export async function getOwnedTopicContext(userId: string, topicId: string) {
  const owned = await getDb().select().from(topics).where(eq(topics.userId, userId));
  const byId = new Map(owned.map((topic) => [topic.id, topic]));
  const topic = byId.get(topicId);
  if (!topic) return null;
  const path = buildTopicPath(owned, topicId);
  if (!path) return null;
  return { topic, path };
}
