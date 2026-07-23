import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { topics } from "./learning";

export const userAiCredentials = sqliteTable("user_ai_credentials", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["openai"] })
    .notNull()
    .default("openai"),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  keyVersion: integer("key_version").notNull(),
  lastFour: text("last_four").notNull(),
  status: text("status", { enum: ["verified", "limited", "invalid"] }).notNull(),
  capabilitiesJson: text("capabilities_json").notNull().default("[]"),
  validatedAt: integer("validated_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
});

export const generationJobs = sqliteTable(
  "generation_jobs",
  {
    id: text("id").primaryKey(),
    workflowInstanceId: text("workflow_instance_id").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    activeSlot: integer("active_slot"),
    status: text("status", { enum: ["queued", "running", "completed", "partial", "failed", "action_required"] })
      .notNull()
      .default("queued"),
    requestedCount: integer("requested_count").notNull(),
    acceptedCount: integer("accepted_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    imageCount: integer("image_count").notNull().default(0),
    safeErrorCode: text("safe_error_code"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => [
    index("generation_jobs_owner_status_idx").on(table.userId, table.status),
    index("generation_jobs_topic_status_idx").on(table.topicId, table.status),
    uniqueIndex("generation_jobs_one_active_topic_uidx").on(table.topicId).where(sql`${table.status} in ('queued', 'running')`),
    uniqueIndex("generation_jobs_owner_active_slot_uidx")
      .on(table.userId, table.activeSlot)
      .where(sql`${table.status} in ('queued', 'running')`)
  ]
);

export const providerCalls = sqliteTable(
  "provider_calls",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => generationJobs.id, { onDelete: "cascade" }),
    stepKey: text("step_key").notNull(),
    provider: text("provider", { enum: ["openai"] })
      .notNull()
      .default("openai"),
    operation: text("operation", { enum: ["generate_cards", "verify_cards", "generate_image"] }).notNull(),
    status: text("status", { enum: ["prepared", "started", "completed", "ambiguous"] })
      .notNull()
      .default("prepared"),
    providerRequestId: text("provider_request_id"),
    usageJson: text("usage_json"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull()
  },
  (table) => [
    uniqueIndex("provider_calls_job_step_uidx").on(table.jobId, table.stepKey),
    index("provider_calls_status_idx").on(table.status)
  ]
);
