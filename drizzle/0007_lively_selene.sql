ALTER TABLE `fm_change_history` MODIFY COLUMN `targetType` enum('character','homebrew','technique') NOT NULL;--> statement-breakpoint
ALTER TABLE `fm_content_shares` MODIFY COLUMN `targetType` enum('character','homebrew','technique') NOT NULL;--> statement-breakpoint
ALTER TABLE `fm_reviews` MODIFY COLUMN `targetType` enum('character','homebrew','technique') NOT NULL;