CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `generation_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_instance_id` text NOT NULL,
	`user_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`requested_count` integer NOT NULL,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`safe_error_code` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generation_jobs_workflow_instance_id_unique` ON `generation_jobs` (`workflow_instance_id`);--> statement-breakpoint
CREATE INDEX `generation_jobs_owner_status_idx` ON `generation_jobs` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `generation_jobs_topic_status_idx` ON `generation_jobs` (`topic_id`,`status`);--> statement-breakpoint
CREATE TABLE `provider_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`step_key` text NOT NULL,
	`provider` text DEFAULT 'openai' NOT NULL,
	`operation` text NOT NULL,
	`status` text DEFAULT 'prepared' NOT NULL,
	`provider_request_id` text,
	`usage_json` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `generation_jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_calls_job_step_uidx` ON `provider_calls` (`job_id`,`step_key`);--> statement-breakpoint
CREATE INDEX `provider_calls_status_idx` ON `provider_calls` (`status`);--> statement-breakpoint
CREATE TABLE `user_ai_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'openai' NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`key_version` integer NOT NULL,
	`last_four` text NOT NULL,
	`status` text NOT NULL,
	`capabilities_json` text DEFAULT '[]' NOT NULL,
	`validated_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_ai_credentials_user_id_unique` ON `user_ai_credentials` (`user_id`);--> statement-breakpoint
CREATE TABLE `beta_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by` text,
	`accepted_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `beta_invites_email_unique` ON `beta_invites` (`email`);--> statement-breakpoint
CREATE TABLE `card_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`source` text NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`byte_size` integer NOT NULL,
	`content_hash` text NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_assets_r2_key_unique` ON `card_assets` (`r2_key`);--> statement-breakpoint
CREATE INDEX `card_assets_owner_idx` ON `card_assets` (`user_id`);--> statement-breakpoint
CREATE TABLE `card_schedules` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`state` integer DEFAULT 0 NOT NULL,
	`step` integer,
	`stability` real DEFAULT 0 NOT NULL,
	`difficulty` real DEFAULT 0 NOT NULL,
	`due_at` integer NOT NULL,
	`last_review_at` integer,
	`scheduled_days` integer DEFAULT 0 NOT NULL,
	`elapsed_days` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `card_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `card_schedules_owner_due_idx` ON `card_schedules` (`user_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`asset_id` text,
	`generation_job_id` text,
	`kind` text NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`hint` text DEFAULT '' NOT NULL,
	`explanation` text DEFAULT '' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`fingerprint` text NOT NULL,
	`source` text DEFAULT 'generated' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `card_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `cards_owner_status_idx` ON `cards` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `cards_topic_status_idx` ON `cards` (`topic_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `cards_topic_fingerprint_uidx` ON `cards` (`topic_id`,`fingerprint`);--> statement-breakpoint
CREATE TABLE `daily_progress` (
	`user_id` text NOT NULL,
	`local_date` text NOT NULL,
	`review_count` integer DEFAULT 0 NOT NULL,
	`correct_count` integer DEFAULT 0 NOT NULL,
	`elapsed_seconds` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `local_date`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `review_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`session_id` text,
	`rating` integer NOT NULL,
	`reviewed_at` integer NOT NULL,
	`device_id` text NOT NULL,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `study_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `review_events_card_time_idx` ON `review_events` (`card_id`,`reviewed_at`,`id`);--> statement-breakpoint
CREATE INDEX `review_events_owner_time_idx` ON `review_events` (`user_id`,`reviewed_at`);--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`review_count` integer DEFAULT 0 NOT NULL,
	`elapsed_seconds` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `study_sessions_owner_started_idx` ON `study_sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`parent_topic_id` text,
	`title` text NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`difficulty` text NOT NULL,
	`visual_mix` text DEFAULT 'balanced' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `topics_owner_status_idx` ON `topics` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `topics_parent_idx` ON `topics` (`parent_topic_id`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`timezone` text DEFAULT 'Pacific/Auckland' NOT NULL,
	`daily_goal` integer DEFAULT 10 NOT NULL,
	`text_card_percent` integer DEFAULT 70 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
