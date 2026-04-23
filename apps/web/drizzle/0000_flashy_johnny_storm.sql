CREATE TABLE `stamps` (
	`id` varchar(36) NOT NULL,
	`onchain_id` bigint,
	`sender_id` varchar(36) NOT NULL,
	`sender_address` varchar(42) NOT NULL,
	`recipient_id` varchar(36) NOT NULL,
	`recipient_address` varchar(42) NOT NULL,
	`subject` varchar(256) NOT NULL,
	`body` text NOT NULL,
	`stake_wei` varchar(40) NOT NULL,
	`status` enum('submitting','pending','refunded','forfeited','expired','failed') NOT NULL DEFAULT 'submitting',
	`send_tx_hash` varchar(66),
	`resolve_tx_hash` varchar(66),
	`ai_triage_label` enum('legit','spam','unsure'),
	`ai_triage_reason` text,
	`created_at` datetime NOT NULL,
	`resolved_at` datetime,
	CONSTRAINT `stamps_id` PRIMARY KEY(`id`),
	CONSTRAINT `stamps_onchain_uq` UNIQUE(`onchain_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`handle` varchar(64) NOT NULL,
	`display_name` varchar(128),
	`password_hash` varchar(255) NOT NULL,
	`wallet_id` varchar(64),
	`wallet_address` varchar(42),
	`created_at` datetime NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_handle_uq` UNIQUE(`handle`),
	CONSTRAINT `users_address_uq` UNIQUE(`wallet_address`)
);
--> statement-breakpoint
CREATE INDEX `stamps_recipient_idx` ON `stamps` (`recipient_id`,`status`);--> statement-breakpoint
CREATE INDEX `stamps_sender_idx` ON `stamps` (`sender_id`);