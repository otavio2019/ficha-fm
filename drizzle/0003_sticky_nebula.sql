CREATE TABLE `fm_change_history` (
	`id` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`targetType` enum('character','homebrew') NOT NULL,
	`targetId` varchar(64) NOT NULL,
	`actorName` varchar(160) NOT NULL,
	`eventType` enum('created','updated','shared','suggested','commented','responded','accepted','rejected','implemented','deleted') NOT NULL,
	`detail` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fm_change_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fm_content_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`targetType` enum('character','homebrew') NOT NULL,
	`targetId` varchar(64) NOT NULL,
	`token` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fm_content_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `fm_content_shares_token_unique` UNIQUE(`token`),
	CONSTRAINT `fm_content_shares_target_unique` UNIQUE(`targetType`,`targetId`)
);
--> statement-breakpoint
CREATE TABLE `fm_homebrews` (
	`id` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`kind` enum('technique','vow','aptitude','race','domain','training','item','rule','other') NOT NULL,
	`name` varchar(160) NOT NULL,
	`summary` text NOT NULL,
	`content` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fm_homebrews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fm_reviews` (
	`id` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`targetType` enum('character','homebrew') NOT NULL,
	`targetId` varchar(64) NOT NULL,
	`reviewerName` varchar(160) NOT NULL,
	`reviewerUserId` int,
	`kind` enum('general','suggestion','comment') NOT NULL,
	`section` varchar(160) NOT NULL,
	`currentValue` text NOT NULL,
	`suggestedValue` text NOT NULL,
	`reason` text NOT NULL,
	`status` enum('pending','accepted','rejected','implemented') NOT NULL DEFAULT 'pending',
	`ownerResponse` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fm_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `fm_change_history_target_index` ON `fm_change_history` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `fm_change_history_owner_index` ON `fm_change_history` (`ownerId`);--> statement-breakpoint
CREATE INDEX `fm_content_shares_owner_index` ON `fm_content_shares` (`ownerId`);--> statement-breakpoint
CREATE INDEX `fm_homebrews_owner_index` ON `fm_homebrews` (`ownerId`);--> statement-breakpoint
CREATE INDEX `fm_homebrews_owner_kind_index` ON `fm_homebrews` (`ownerId`,`kind`);--> statement-breakpoint
CREATE INDEX `fm_homebrews_owner_updated_index` ON `fm_homebrews` (`ownerId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `fm_reviews_target_index` ON `fm_reviews` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `fm_reviews_owner_status_index` ON `fm_reviews` (`ownerId`,`status`);