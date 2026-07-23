CREATE TABLE `card_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`reply_to_message_id` text,
	`status` text NOT NULL,
	`active_slot` integer,
	`model` text,
	`provider_response_id` text,
	`usage_json` text,
	`safe_error_code` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_id`) REFERENCES `card_chat_threads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reply_to_message_id`) REFERENCES `card_chat_messages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `card_chat_messages_thread_time_idx` ON `card_chat_messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `card_chat_messages_user_streaming_uidx` ON `card_chat_messages` (`user_id`) WHERE "card_chat_messages"."role" = 'assistant' and "card_chat_messages"."status" = 'streaming';--> statement-breakpoint
CREATE UNIQUE INDEX `card_chat_messages_reply_streaming_uidx` ON `card_chat_messages` (`reply_to_message_id`) WHERE "card_chat_messages"."role" = 'assistant' and "card_chat_messages"."status" = 'streaming';--> statement-breakpoint
CREATE TABLE `card_chat_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`card_version` integer NOT NULL,
	`context_snapshot_json` text NOT NULL,
	`context_disclosure_version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_activity_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `card_chat_threads_owner_activity_idx` ON `card_chat_threads` (`user_id`,`last_activity_at`);--> statement-breakpoint
CREATE INDEX `card_chat_threads_card_activity_idx` ON `card_chat_threads` (`user_id`,`card_id`,`last_activity_at`);