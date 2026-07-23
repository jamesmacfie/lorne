UPDATE `cards`
SET
	`status` = 'flagged',
	`updated_at` = CAST(strftime('%s', 'now') AS integer) * 1000
WHERE
	`kind` = 'image'
	AND `asset_id` IS NULL
	AND `status` = 'published';
