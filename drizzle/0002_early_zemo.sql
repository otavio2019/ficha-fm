CREATE TABLE `fm_techniques` (
	`id` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`technique` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fm_techniques_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `fm_techniques_owner_index` ON `fm_techniques` (`ownerId`);--> statement-breakpoint
CREATE INDEX `fm_techniques_owner_updated_index` ON `fm_techniques` (`ownerId`,`updatedAt`);