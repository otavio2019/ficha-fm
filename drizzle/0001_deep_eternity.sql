CREATE TABLE `fm_character_shares` (
	`id` int AUTO_INCREMENT NOT NULL,
	`characterId` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fm_character_shares_id` PRIMARY KEY(`id`),
	CONSTRAINT `fm_character_shares_token_unique` UNIQUE(`token`),
	CONSTRAINT `fm_character_shares_character_unique` UNIQUE(`characterId`)
);
--> statement-breakpoint
CREATE TABLE `fm_characters` (
	`id` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`portraitUrl` text,
	`sheet` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fm_characters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `fm_character_shares_owner_index` ON `fm_character_shares` (`ownerId`);--> statement-breakpoint
CREATE INDEX `fm_characters_owner_index` ON `fm_characters` (`ownerId`);--> statement-breakpoint
CREATE INDEX `fm_characters_owner_updated_index` ON `fm_characters` (`ownerId`,`updatedAt`);