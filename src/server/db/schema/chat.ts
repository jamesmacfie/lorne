import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { cards } from "./learning";

export const cardChatThreads = sqliteTable(
  "card_chat_threads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    cardVersion: integer("card_version").notNull(),
    contextSnapshotJson: text("context_snapshot_json").notNull(),
    contextDisclosureVersion: integer("context_disclosure_version").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => [
    index("card_chat_threads_owner_activity_idx").on(table.userId, table.lastActivityAt),
    index("card_chat_threads_card_activity_idx").on(table.userId, table.cardId, table.lastActivityAt)
  ]
);

export const cardChatMessages = sqliteTable(
  "card_chat_messages",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    threadId: text("thread_id")
      .notNull()
      .references(() => cardChatThreads.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    text: text("text").notNull().default(""),
    replyToMessageId: text("reply_to_message_id").references((): AnySQLiteColumn => cardChatMessages.id, { onDelete: "set null" }),
    status: text("status", { enum: ["streaming", "completed", "failed", "aborted"] }).notNull(),
    activeSlot: integer("active_slot"),
    model: text("model"),
    providerResponseId: text("provider_response_id"),
    usageJson: text("usage_json"),
    safeErrorCode: text("safe_error_code"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" })
  },
  (table) => [
    index("card_chat_messages_thread_time_idx").on(table.threadId, table.createdAt),
    uniqueIndex("card_chat_messages_user_streaming_uidx")
      .on(table.userId)
      .where(sql`${table.role} = 'assistant' and ${table.status} = 'streaming'`),
    uniqueIndex("card_chat_messages_reply_streaming_uidx")
      .on(table.replyToMessageId)
      .where(sql`${table.role} = 'assistant' and ${table.status} = 'streaming'`)
  ]
);
