import { and, eq } from "drizzle-orm";
import { getDb } from "#/server/db/client";
import { cards } from "#/server/db/schema";
import type { CardChatContextSnapshot } from "#/shared/contracts";
import { getOwnedTopicContext } from "#/server/topics/topic-context";
import { makeCardChatSnapshot } from "./chat-snapshot";

export async function buildCardChatSnapshot(userId: string, cardId: string): Promise<CardChatContextSnapshot | null> {
  const [card] = await getDb()
    .select()
    .from(cards)
    .where(and(eq(cards.id, cardId), eq(cards.userId, userId), eq(cards.status, "published")))
    .limit(1);
  if (!card) return null;
  const topicContext = await getOwnedTopicContext(userId, card.topicId);
  if (!topicContext) return null;
  return makeCardChatSnapshot(card, {
    path: topicContext.path,
    notes: topicContext.topic.context,
    difficulty: topicContext.topic.difficulty
  });
}
