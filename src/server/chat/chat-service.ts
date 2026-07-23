import { and, asc, count, desc, eq, inArray, lt, ne } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "#/server/db/client";
import { cardAssets, cardChatMessages, cardChatThreads, cards } from "#/server/db/schema";
import {
  CARD_CHAT_DISCLOSURE_VERSION,
  CARD_CHAT_QUESTION_LIMIT,
  cardChatContextSnapshotSchema,
  type CardChatContextSnapshot,
  type CardChatDetail,
  type CardChatMessage,
  type CardChatStreamRequest,
  type CardChatThreadSummary,
  type SafeErrorCode
} from "#/shared/contracts";
import { createId } from "#/shared/ids";
import { buildCardChatSnapshot } from "./chat-context";

const MAX_CHAT_THREADS = 500;
const STALE_STREAM_MS = 90_000;

export class CardChatError extends Error {
  constructor(
    public readonly code: SafeErrorCode,
    message: string
  ) {
    super(message);
  }
}

function parseSnapshot(value: string): CardChatContextSnapshot {
  return cardChatContextSnapshotSchema.parse(JSON.parse(value));
}

function serializeMessage(row: typeof cardChatMessages.$inferSelect): CardChatMessage {
  return {
    id: row.id,
    threadId: row.threadId,
    role: row.role,
    text: row.text,
    replyToMessageId: row.replyToMessageId,
    status: row.status,
    model: row.model,
    safeErrorCode: row.safeErrorCode,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null
  };
}

export async function listCardChatThreads(userId: string): Promise<CardChatThreadSummary[]> {
  const db = getDb();
  const threads = await db
    .select()
    .from(cardChatThreads)
    .where(eq(cardChatThreads.userId, userId))
    .orderBy(desc(cardChatThreads.lastActivityAt));
  if (!threads.length) return [];
  const messages = await db
    .select()
    .from(cardChatMessages)
    .where(
      and(
        eq(cardChatMessages.userId, userId),
        inArray(
          cardChatMessages.threadId,
          threads.map((thread) => thread.id)
        )
      )
    )
    .orderBy(asc(cardChatMessages.createdAt));
  const byThread = new Map<string, typeof messages>();
  for (const message of messages) byThread.set(message.threadId, [...(byThread.get(message.threadId) ?? []), message]);
  return threads.map((thread) => {
    const snapshot = parseSnapshot(thread.contextSnapshotJson);
    const threadMessages = byThread.get(thread.id) ?? [];
    return {
      id: thread.id,
      cardId: thread.cardId,
      cardVersion: thread.cardVersion,
      topicPath: snapshot.topicPath,
      cardQuestion: snapshot.question,
      firstUserQuestion: threadMessages.find((message) => message.role === "user")?.text ?? "",
      messageCount: threadMessages.length,
      lastActivityAt: thread.lastActivityAt.toISOString()
    };
  });
}

export async function getCardChatDetail(userId: string, threadId: string): Promise<CardChatDetail | null> {
  const db = getDb();
  const [thread] = await db
    .select()
    .from(cardChatThreads)
    .where(and(eq(cardChatThreads.id, threadId), eq(cardChatThreads.userId, userId)))
    .limit(1);
  if (!thread) return null;
  const [messages, currentCard] = await Promise.all([
    db
      .select()
      .from(cardChatMessages)
      .where(and(eq(cardChatMessages.threadId, threadId), eq(cardChatMessages.userId, userId)))
      .orderBy(asc(cardChatMessages.createdAt)),
    db
      .select({ version: cards.version })
      .from(cards)
      .where(and(eq(cards.id, thread.cardId), eq(cards.userId, userId)))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  ]);
  return {
    id: thread.id,
    cardId: thread.cardId,
    cardVersion: thread.cardVersion,
    currentCardVersion: currentCard?.version ?? null,
    contextSnapshot: parseSnapshot(thread.contextSnapshotJson),
    disclosureVersion: thread.contextDisclosureVersion,
    messages: messages.map(serializeMessage),
    createdAt: thread.createdAt.toISOString(),
    lastActivityAt: thread.lastActivityAt.toISOString()
  };
}

export async function getLatestCardChat(userId: string, cardId: string, cardVersion: number): Promise<CardChatDetail | null> {
  const [thread] = await getDb()
    .select({ id: cardChatThreads.id })
    .from(cardChatThreads)
    .where(and(eq(cardChatThreads.userId, userId), eq(cardChatThreads.cardId, cardId), eq(cardChatThreads.cardVersion, cardVersion)))
    .orderBy(desc(cardChatThreads.lastActivityAt))
    .limit(1);
  return thread ? getCardChatDetail(userId, thread.id) : null;
}

export async function hasOlderCardChats(userId: string, cardId: string, cardVersion: number): Promise<boolean> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(cardChatThreads)
    .where(and(eq(cardChatThreads.userId, userId), eq(cardChatThreads.cardId, cardId), ne(cardChatThreads.cardVersion, cardVersion)));
  return Number(row?.total ?? 0) > 0;
}

export async function deleteCardChat(userId: string, threadId: string): Promise<boolean> {
  const [deleted] = await getDb()
    .delete(cardChatThreads)
    .where(and(eq(cardChatThreads.id, threadId), eq(cardChatThreads.userId, userId)))
    .returning({ id: cardChatThreads.id });
  return Boolean(deleted);
}

async function recoverStaleStreams(userId: string, now: Date): Promise<void> {
  await getDb()
    .update(cardChatMessages)
    .set({ status: "aborted", activeSlot: null, safeErrorCode: "CHAT_TIMEOUT", completedAt: now })
    .where(
      and(
        eq(cardChatMessages.userId, userId),
        eq(cardChatMessages.role, "assistant"),
        eq(cardChatMessages.status, "streaming"),
        lt(cardChatMessages.createdAt, new Date(now.getTime() - STALE_STREAM_MS))
      )
    );
}

export type PreparedCardChatSend = {
  assistantMessageId: string;
  snapshot: CardChatContextSnapshot;
  messages: CardChatMessage[];
  duplicateAssistant: CardChatMessage | null;
};

export async function prepareCardChatSend(
  userId: string,
  threadId: string,
  input: CardChatStreamRequest,
  model: string
): Promise<PreparedCardChatSend> {
  const db = getDb();
  const now = new Date();
  await recoverStaleStreams(userId, now);
  const [thread] = await db
    .select()
    .from(cardChatThreads)
    .where(and(eq(cardChatThreads.id, threadId), eq(cardChatThreads.userId, userId)))
    .limit(1);

  if (input.retryOfAssistantMessageId) {
    if (!thread) throw new CardChatError("NOT_FOUND", "That chat no longer exists.");
    const [previous] = await db
      .select()
      .from(cardChatMessages)
      .where(
        and(
          eq(cardChatMessages.id, input.retryOfAssistantMessageId),
          eq(cardChatMessages.threadId, threadId),
          eq(cardChatMessages.userId, userId),
          eq(cardChatMessages.role, "assistant")
        )
      )
      .limit(1);
    if (!previous?.replyToMessageId || (previous.status !== "failed" && previous.status !== "aborted")) {
      throw new CardChatError("INVALID_INPUT", "Only a failed or stopped answer can be retried.");
    }
    const [userMessage] = await db
      .select()
      .from(cardChatMessages)
      .where(and(eq(cardChatMessages.id, previous.replyToMessageId), eq(cardChatMessages.userId, userId)))
      .limit(1);
    if (!userMessage || userMessage.text !== input.message.text) throw new CardChatError("INVALID_INPUT", "Retry message changed.");
    const assistantMessageId = createId("reply");
    try {
      await db.batch([
        db.insert(cardChatMessages).values({
          id: assistantMessageId,
          userId,
          threadId,
          role: "assistant",
          text: "",
          replyToMessageId: userMessage.id,
          status: "streaming",
          activeSlot: 1,
          model,
          createdAt: now
        }),
        db.update(cardChatThreads).set({ updatedAt: now, lastActivityAt: now }).where(eq(cardChatThreads.id, threadId))
      ]);
    } catch {
      throw new CardChatError("CHAT_ACTIVE_RESPONSE", "Another answer is already streaming.");
    }
    const messages = await loadProviderMessages(userId, threadId, assistantMessageId);
    return { assistantMessageId, snapshot: parseSnapshot(thread.contextSnapshotJson), messages, duplicateAssistant: null };
  }

  const [existingUser] = await db
    .select()
    .from(cardChatMessages)
    .where(and(eq(cardChatMessages.id, input.message.id), eq(cardChatMessages.userId, userId)))
    .limit(1);
  if (existingUser) {
    if (existingUser.threadId !== threadId || existingUser.text !== input.message.text || existingUser.role !== "user") {
      throw new CardChatError("INVALID_INPUT", "Message ID was already used.");
    }
    const [reply] = await db
      .select()
      .from(cardChatMessages)
      .where(and(eq(cardChatMessages.replyToMessageId, existingUser.id), eq(cardChatMessages.userId, userId)))
      .orderBy(desc(cardChatMessages.createdAt))
      .limit(1);
    if (!thread) throw new CardChatError("NOT_FOUND", "That chat no longer exists.");
    if (reply?.status === "completed") {
      return {
        assistantMessageId: reply.id,
        snapshot: parseSnapshot(thread.contextSnapshotJson),
        messages: [],
        duplicateAssistant: serializeMessage(reply)
      };
    }
    throw new CardChatError("CHAT_ACTIVE_RESPONSE", "This question already has an answer attempt.");
  }

  let snapshot: CardChatContextSnapshot;
  if (!thread) {
    if (!input.cardId) throw new CardChatError("INVALID_INPUT", "The first question must identify its card.");
    const [threadCount] = await db.select({ total: count() }).from(cardChatThreads).where(eq(cardChatThreads.userId, userId));
    if (Number(threadCount?.total ?? 0) >= MAX_CHAT_THREADS) {
      throw new CardChatError("CHAT_THREAD_LIMIT", "Delete an older chat before starting another.");
    }
    const built = await buildCardChatSnapshot(userId, input.cardId);
    if (!built) throw new CardChatError("NOT_FOUND", "That card is unavailable.");
    snapshot = built;
  } else {
    snapshot = parseSnapshot(thread.contextSnapshotJson);
    if (input.cardId && input.cardId !== thread.cardId) throw new CardChatError("INVALID_INPUT", "Card does not match this chat.");
  }

  const [questionCount] = thread
    ? await db
        .select({ total: count() })
        .from(cardChatMessages)
        .where(and(eq(cardChatMessages.threadId, threadId), eq(cardChatMessages.userId, userId), eq(cardChatMessages.role, "user")))
    : [{ total: 0 }];
  if (Number(questionCount?.total ?? 0) >= CARD_CHAT_QUESTION_LIMIT) {
    throw new CardChatError("CHAT_MESSAGE_LIMIT", "This chat has reached 12 questions. Start a new chat to continue.");
  }

  const assistantMessageId = createId("reply");
  const assistantStartedAt = new Date(now.getTime() + 1);
  const threadInsert = db.insert(cardChatThreads).values({
    id: threadId,
    userId,
    cardId: snapshot.cardId,
    cardVersion: snapshot.version,
    contextSnapshotJson: JSON.stringify(snapshot),
    contextDisclosureVersion: CARD_CHAT_DISCLOSURE_VERSION,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now
  });
  const userInsert = db.insert(cardChatMessages).values({
    id: input.message.id,
    userId,
    threadId,
    role: "user",
    text: input.message.text,
    status: "completed",
    createdAt: now,
    completedAt: now
  });
  const assistantInsert = db.insert(cardChatMessages).values({
    id: assistantMessageId,
    userId,
    threadId,
    role: "assistant",
    text: "",
    replyToMessageId: input.message.id,
    status: "streaming",
    activeSlot: 1,
    model,
    createdAt: assistantStartedAt
  });
  try {
    await db.batch(
      thread
        ? [
            userInsert,
            assistantInsert,
            db.update(cardChatThreads).set({ updatedAt: now, lastActivityAt: now }).where(eq(cardChatThreads.id, threadId))
          ]
        : [threadInsert, userInsert, assistantInsert]
    );
  } catch {
    throw new CardChatError("CHAT_ACTIVE_RESPONSE", "Another answer is already streaming.");
  }
  const messages = await loadProviderMessages(userId, threadId, assistantMessageId);
  return { assistantMessageId, snapshot, messages, duplicateAssistant: null };
}

async function loadProviderMessages(userId: string, threadId: string, excludedAssistantId: string): Promise<CardChatMessage[]> {
  const rows = await getDb()
    .select()
    .from(cardChatMessages)
    .where(and(eq(cardChatMessages.userId, userId), eq(cardChatMessages.threadId, threadId), ne(cardChatMessages.id, excludedAssistantId)))
    .orderBy(asc(cardChatMessages.createdAt));
  return rows.map(serializeMessage);
}

export async function loadSnapshotImage(
  userId: string,
  snapshot: CardChatContextSnapshot
): Promise<{
  bytes: Uint8Array;
  mediaType: string;
} | null> {
  if (snapshot.kind !== "image" || !snapshot.visualAssetId) return null;
  const [asset] = await getDb()
    .select()
    .from(cardAssets)
    .where(and(eq(cardAssets.id, snapshot.visualAssetId), eq(cardAssets.userId, userId), eq(cardAssets.status, "ready")))
    .limit(1);
  if (!asset) return null;
  const object = await env.CARD_IMAGES.get(asset.r2Key);
  if (!object) return null;
  return { bytes: new Uint8Array(await object.arrayBuffer()), mediaType: asset.mimeType };
}

export async function completeCardChatResponse(
  userId: string,
  assistantMessageId: string,
  text: string,
  usage: unknown,
  providerResponseId: string | null
): Promise<void> {
  const now = new Date();
  const db = getDb();
  const [message] = await db
    .update(cardChatMessages)
    .set({
      text,
      status: "completed",
      activeSlot: null,
      usageJson: usage ? JSON.stringify(usage) : null,
      providerResponseId,
      safeErrorCode: null,
      completedAt: now
    })
    .where(and(eq(cardChatMessages.id, assistantMessageId), eq(cardChatMessages.userId, userId), eq(cardChatMessages.status, "streaming")))
    .returning({ threadId: cardChatMessages.threadId });
  if (message)
    await db.update(cardChatThreads).set({ updatedAt: now, lastActivityAt: now }).where(eq(cardChatThreads.id, message.threadId));
}

export async function failCardChatResponse(
  userId: string,
  assistantMessageId: string,
  text: string,
  status: "failed" | "aborted",
  code: SafeErrorCode
): Promise<void> {
  await getDb()
    .update(cardChatMessages)
    .set({ text, status, activeSlot: null, safeErrorCode: code, completedAt: new Date() })
    .where(and(eq(cardChatMessages.id, assistantMessageId), eq(cardChatMessages.userId, userId), eq(cardChatMessages.status, "streaming")));
}
