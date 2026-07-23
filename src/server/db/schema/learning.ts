import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const betaInvites = sqliteTable("beta_invites", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  codeHash: text("code_hash"),
  status: text("status", { enum: ["pending", "accepted", "revoked"] })
    .notNull()
    .default("pending"),
  invitedBy: text("invited_by"),
  acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
});

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("Pacific/Auckland"),
  dailyGoal: integer("daily_goal").notNull().default(10),
  textCardPercent: integer("text_card_percent").notNull().default(70),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const topics = sqliteTable(
  "topics",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentTopicId: text("parent_topic_id").references((): AnySQLiteColumn => topics.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    context: text("context").notNull().default(""),
    difficulty: text("difficulty", { enum: ["beginner", "intermediate", "advanced"] }).notNull(),
    visualMix: text("visual_mix", { enum: ["mostly_text", "balanced", "mostly_visual"] })
      .notNull()
      .default("balanced"),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => [index("topics_owner_status_idx").on(table.userId, table.status), index("topics_parent_idx").on(table.parentTopicId)]
);

export const cardAssets = sqliteTable(
  "card_assets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull().unique(),
    source: text("source", { enum: ["diagram", "generated"] }).notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    byteSize: integer("byte_size").notNull(),
    contentHash: text("content_hash").notNull(),
    status: text("status", { enum: ["ready", "failed", "deleted"] })
      .notNull()
      .default("ready"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => [index("card_assets_owner_idx").on(table.userId)]
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    assetId: text("asset_id").references(() => cardAssets.id, { onDelete: "set null" }),
    generationJobId: text("generation_job_id"),
    kind: text("kind", { enum: ["text", "image"] }).notNull(),
    front: text("front").notNull(),
    back: text("back").notNull(),
    hint: text("hint").notNull().default(""),
    explanation: text("explanation").notNull().default(""),
    tagsJson: text("tags_json").notNull().default("[]"),
    fingerprint: text("fingerprint").notNull(),
    source: text("source", { enum: ["generated", "edited", "manual"] })
      .notNull()
      .default("generated"),
    status: text("status", { enum: ["published", "archived", "flagged"] })
      .notNull()
      .default("published"),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => [
    index("cards_owner_status_idx").on(table.userId, table.status),
    index("cards_topic_status_idx").on(table.topicId, table.status),
    uniqueIndex("cards_topic_fingerprint_uidx").on(table.topicId, table.fingerprint)
  ]
);

export const studySessions = sqliteTable(
  "study_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    reviewCount: integer("review_count").notNull().default(0),
    elapsedSeconds: integer("elapsed_seconds").notNull().default(0)
  },
  (table) => [index("study_sessions_owner_started_idx").on(table.userId, table.startedAt)]
);

export const reviewEvents = sqliteTable(
  "review_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => studySessions.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }).notNull(),
    deviceId: text("device_id").notNull(),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => [
    index("review_events_card_time_idx").on(table.cardId, table.reviewedAt, table.id),
    index("review_events_owner_time_idx").on(table.userId, table.reviewedAt)
  ]
);

export const cardSchedules = sqliteTable(
  "card_schedules",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    state: integer("state").notNull().default(0),
    step: integer("step"),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    dueAt: integer("due_at", { mode: "timestamp_ms" }).notNull(),
    lastReviewAt: integer("last_review_at", { mode: "timestamp_ms" }),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => [primaryKey({ columns: [table.userId, table.cardId] }), index("card_schedules_owner_due_idx").on(table.userId, table.dueAt)]
);

export const dailyProgress = sqliteTable(
  "daily_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    localDate: text("local_date").notNull(),
    reviewCount: integer("review_count").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => [primaryKey({ columns: [table.userId, table.localDate] })]
);
