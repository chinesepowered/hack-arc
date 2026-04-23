import {
  mysqlTable,
  varchar,
  int,
  bigint,
  datetime,
  text,
  mysqlEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    handle: varchar("handle", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 128 }),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    walletId: varchar("wallet_id", { length: 64 }),
    walletAddress: varchar("wallet_address", { length: 42 }),
    createdAt: datetime("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("users_handle_uq").on(t.handle),
    uniqueIndex("users_address_uq").on(t.walletAddress),
  ]
);

/**
 * We keep a DB row per onchain stamp so we can show the message body (kept
 * offchain; only its hash is onchain) and render the inbox fast.
 * The authoritative state is the contract — this is a projection.
 */
export const stamps = mysqlTable(
  "stamps",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    onchainId: bigint("onchain_id", { mode: "bigint" }), // null until tx confirmed
    senderId: varchar("sender_id", { length: 36 }).notNull(),
    senderAddress: varchar("sender_address", { length: 42 }).notNull(),
    recipientId: varchar("recipient_id", { length: 36 }).notNull(),
    recipientAddress: varchar("recipient_address", { length: 42 }).notNull(),
    subject: varchar("subject", { length: 256 }).notNull(),
    body: text("body").notNull(),
    // uint256 max is 78 digits; give plenty of headroom
    stakeWei: varchar("stake_wei", { length: 80 }).notNull(),
    status: mysqlEnum("status", [
      "submitting",
      "pending",
      "refunded",
      "forfeited",
      "expired",
      "failed",
    ])
      .notNull()
      .default("submitting"),
    sendTxHash: varchar("send_tx_hash", { length: 66 }),
    resolveTxHash: varchar("resolve_tx_hash", { length: 66 }),
    aiTriageLabel: mysqlEnum("ai_triage_label", ["legit", "spam", "unsure"]),
    aiTriageReason: text("ai_triage_reason"),
    createdAt: datetime("created_at").notNull(),
    resolvedAt: datetime("resolved_at"),
  },
  (t) => [
    index("stamps_recipient_idx").on(t.recipientId, t.status),
    index("stamps_sender_idx").on(t.senderId),
    uniqueIndex("stamps_onchain_uq").on(t.onchainId),
  ]
);

export type User = typeof users.$inferSelect;
export type Stamp = typeof stamps.$inferSelect;
export type NewStamp = typeof stamps.$inferInsert;
