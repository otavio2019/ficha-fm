CREATE TABLE `fm_content_versions` (
	`id` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`targetType` enum('character','homebrew','technique') NOT NULL,
	`targetId` varchar(64) NOT NULL,
	`versionNumber` int NOT NULL,
	`previousVersionId` varchar(64),
	`authorName` varchar(160) NOT NULL,
	`reason` varchar(240) NOT NULL,
	`rulesVersion` varchar(32) NOT NULL DEFAULT '2.5.2',
	`content` json NOT NULL,
	`changes` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fm_content_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `fm_content_versions_target_version_unique` UNIQUE(`targetType`,`targetId`,`versionNumber`)
);
--> statement-breakpoint
CREATE TABLE `fm_content_votes` (
	`id` varchar(64) NOT NULL,
	`targetType` enum('character','homebrew','technique') NOT NULL,
	`targetId` varchar(64) NOT NULL,
	`voterKey` varchar(128) NOT NULL,
	`voterName` varchar(160) NOT NULL,
	`value` enum('support','concern') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fm_content_votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `fm_content_votes_target_voter_unique` UNIQUE(`targetType`,`targetId`,`voterKey`)
);
--> statement-breakpoint
CREATE INDEX `fm_content_versions_target_index` ON `fm_content_versions` (`targetType`,`targetId`,`versionNumber`);--> statement-breakpoint
CREATE INDEX `fm_content_votes_target_index` ON `fm_content_votes` (`targetType`,`targetId`);