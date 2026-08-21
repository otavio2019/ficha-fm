CREATE TABLE `fm_character_specialization_abilities` (
	`id` varchar(191) NOT NULL,
	`characterId` varchar(64) NOT NULL,
	`abilityId` varchar(160) NOT NULL,
	`specialization` varchar(48) NOT NULL,
	`coreId` varchar(64) NOT NULL DEFAULT '',
	`unlockedAt` timestamp NOT NULL DEFAULT (now()),
	`selected` boolean NOT NULL DEFAULT false,
	`status` enum('unlocked','selected','pending','inactive') NOT NULL DEFAULT 'unlocked',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fm_character_specialization_abilities_id` PRIMARY KEY(`id`),
	CONSTRAINT `fm_character_specialization_abilities_unique` UNIQUE(`characterId`,`abilityId`,`coreId`)
);
--> statement-breakpoint
CREATE TABLE `fm_specialization_abilities` (
	`id` varchar(160) NOT NULL,
	`specialization` varchar(48) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`abilityType` enum('passive','active','choice','evolution','modifier','unlock','special') NOT NULL,
	`unlockLevel` int NOT NULL,
	`requirements` json NOT NULL,
	`modifiers` json NOT NULL,
	`effects` json NOT NULL,
	`status` enum('official','draft','retired') NOT NULL DEFAULT 'official',
	`isAutomatic` boolean NOT NULL DEFAULT false,
	`requiresChoice` boolean NOT NULL DEFAULT false,
	`evolutionOf` varchar(160),
	`displayOrder` int NOT NULL DEFAULT 0,
	`rulesVersion` varchar(32) NOT NULL DEFAULT '2.5.2',
	`source` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fm_specialization_abilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `fm_character_specialization_abilities_character_index` ON `fm_character_specialization_abilities` (`characterId`);--> statement-breakpoint
CREATE INDEX `fm_character_specialization_abilities_character_status_index` ON `fm_character_specialization_abilities` (`characterId`,`status`);--> statement-breakpoint
CREATE INDEX `fm_specialization_abilities_specialization_level_index` ON `fm_specialization_abilities` (`specialization`,`unlockLevel`,`displayOrder`);--> statement-breakpoint
CREATE INDEX `fm_specialization_abilities_status_index` ON `fm_specialization_abilities` (`status`);