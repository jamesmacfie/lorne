ALTER TABLE `user_preferences` ADD `onboarding_step` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_preferences` ADD `onboarding_completed_at` integer;--> statement-breakpoint
UPDATE `user_preferences`
SET
	`onboarding_step` = 4,
	`onboarding_completed_at` = CAST(strftime('%s', 'now') AS integer) * 1000;
