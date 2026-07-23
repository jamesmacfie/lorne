import { z } from "zod";
import { nonEmptyIdSchema } from "./common";

export const CARD_CHAT_DISCLOSURE_VERSION = 1 as const;
export const CARD_CHAT_QUESTION_LIMIT = 12;
export const CARD_CHAT_TEXT_LIMIT = 2_000;

export const cardChatContextSnapshotSchema = z.object({
  cardId: nonEmptyIdSchema,
  version: z.number().int().positive(),
  kind: z.enum(["text", "image"]),
  question: z.string().min(1).max(500),
  answer: z.string().min(1).max(1_000),
  hint: z.string().max(300),
  explanation: z.string().max(1_500),
  tags: z.array(z.string().max(80)).max(30),
  visualAssetId: nonEmptyIdSchema.nullable(),
  topicId: nonEmptyIdSchema,
  topicPath: z.array(z.string().min(1).max(160)).min(1).max(20),
  topicNotes: z.string().max(4_000),
  difficulty: z.enum(["beginner", "intermediate", "advanced"])
});

export const cardChatMessageRoleSchema = z.enum(["user", "assistant"]);
export const cardChatMessageStatusSchema = z.enum(["streaming", "completed", "failed", "aborted"]);

export const cardChatMessageSchema = z.object({
  id: nonEmptyIdSchema,
  threadId: nonEmptyIdSchema,
  role: cardChatMessageRoleSchema,
  text: z.string(),
  replyToMessageId: nonEmptyIdSchema.nullable(),
  status: cardChatMessageStatusSchema,
  model: z.string().nullable(),
  safeErrorCode: z.string().nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable()
});

export const cardChatThreadSummarySchema = z.object({
  id: nonEmptyIdSchema,
  cardId: nonEmptyIdSchema,
  cardVersion: z.number().int().positive(),
  topicPath: z.array(z.string()),
  cardQuestion: z.string(),
  firstUserQuestion: z.string(),
  messageCount: z.number().int().nonnegative(),
  lastActivityAt: z.string().datetime()
});

export const cardChatDetailSchema = z.object({
  id: nonEmptyIdSchema,
  cardId: nonEmptyIdSchema,
  cardVersion: z.number().int().positive(),
  currentCardVersion: z.number().int().positive().nullable(),
  contextSnapshot: cardChatContextSnapshotSchema,
  disclosureVersion: z.number().int().positive(),
  messages: z.array(cardChatMessageSchema),
  createdAt: z.string().datetime(),
  lastActivityAt: z.string().datetime()
});

export const cardChatStreamRequestSchema = z.object({
  cardId: nonEmptyIdSchema.optional(),
  message: z.object({
    id: nonEmptyIdSchema,
    text: z.string().trim().min(1).max(CARD_CHAT_TEXT_LIMIT)
  }),
  contextDisclosureVersion: z.literal(CARD_CHAT_DISCLOSURE_VERSION),
  retryOfAssistantMessageId: nonEmptyIdSchema.optional()
});

export const cardChatCardInputSchema = z.object({
  cardId: nonEmptyIdSchema,
  cardVersion: z.number().int().positive()
});

export const cardChatCardIdInputSchema = z.object({ cardId: nonEmptyIdSchema });
export const cardChatThreadInputSchema = z.object({ threadId: nonEmptyIdSchema });

export type CardChatContextSnapshot = z.infer<typeof cardChatContextSnapshotSchema>;
export type CardChatMessage = z.infer<typeof cardChatMessageSchema>;
export type CardChatThreadSummary = z.infer<typeof cardChatThreadSummarySchema>;
export type CardChatDetail = z.infer<typeof cardChatDetailSchema>;
export type CardChatStreamRequest = z.infer<typeof cardChatStreamRequestSchema>;
