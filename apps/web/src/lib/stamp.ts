import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { decodeEventLog, type Hex } from "viem";
import { db, schema } from "./db";
import { executeContract, pollTx } from "./circle";
import { publicClient, STAMP_ESCROW_ADDRESS, USDC_ADDRESS } from "./arc";
import {
  STAMP_ESCROW_ABI,
  messageHash,
  usdcToWei,
  weiToUsdc,
} from "./contract";

function requireEscrowAddress(): `0x${string}` {
  if (!STAMP_ESCROW_ADDRESS) {
    throw new Error(
      "STAMP_ESCROW_ADDRESS is not set — deploy StampEscrow.sol via Remix and set it in .env"
    );
  }
  return STAMP_ESCROW_ADDRESS;
}

export type SendStampInput = {
  senderId: string;
  senderWalletId: string;
  senderAddress: string;
  recipientHandle: string;
  subject: string;
  body: string;
  stakeUsdc: string; // e.g. "0.25"
};

export async function sendStamp(input: SendStampInput) {
  const escrow = requireEscrowAddress();

  // Look up the recipient by handle.
  const [recipient] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.handle, input.recipientHandle.toLowerCase()))
    .limit(1);
  if (!recipient || !recipient.walletAddress) {
    throw new Error("recipient not found or has no wallet yet");
  }

  const stakeWei = usdcToWei(input.stakeUsdc);
  const hash = messageHash(input.subject, input.body);

  // Create the DB row up-front in "submitting" state so the UI can show it.
  const stampId = randomUUID();
  await db.insert(schema.stamps).values({
    id: stampId,
    senderId: input.senderId,
    senderAddress: input.senderAddress.toLowerCase(),
    recipientId: recipient.id,
    recipientAddress: recipient.walletAddress,
    subject: input.subject,
    body: input.body,
    stakeWei: stakeWei.toString(),
    status: "submitting",
    createdAt: new Date(),
  });

  // 1) approve USDC → escrow
  const approveTx = await executeContract({
    walletId: input.senderWalletId,
    contractAddress: USDC_ADDRESS,
    abiFunctionSignature: "approve(address,uint256)",
    abiParameters: [escrow, stakeWei.toString()],
  });
  await pollTx(approveTx.id);

  // 2) sendStamp
  const sendTx = await executeContract({
    walletId: input.senderWalletId,
    contractAddress: escrow,
    abiFunctionSignature: "sendStamp(address,uint128,bytes32)",
    abiParameters: [recipient.walletAddress, stakeWei.toString(), hash],
  });
  const confirmed = await pollTx(sendTx.id);

  // Extract the onchain id by parsing the StampSent event.
  let onchainId: bigint | undefined;
  if (confirmed.txHash) {
    try {
      const receipt = await publicClient.getTransactionReceipt({
        hash: confirmed.txHash as Hex,
      });
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== escrow.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({
            abi: STAMP_ESCROW_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "StampSent") {
            onchainId = decoded.args.id as bigint;
            break;
          }
        } catch {
          /* not our event */
        }
      }
    } catch (err) {
      console.warn("could not decode StampSent event", err);
    }
  }

  await db
    .update(schema.stamps)
    .set({
      status: "pending",
      sendTxHash: confirmed.txHash ?? null,
      onchainId: onchainId ?? null,
    })
    .where(eq(schema.stamps.id, stampId));

  return {
    stampId,
    onchainId: onchainId?.toString(),
    txHash: confirmed.txHash,
    stake: weiToUsdc(stakeWei),
  };
}

export async function triageStamp(params: {
  userId: string;
  walletId: string;
  stampId: string;
  action: "refund" | "forfeit";
}) {
  const escrow = requireEscrowAddress();
  const [stamp] = await db
    .select()
    .from(schema.stamps)
    .where(
      and(
        eq(schema.stamps.id, params.stampId),
        eq(schema.stamps.recipientId, params.userId)
      )
    )
    .limit(1);
  if (!stamp) throw new Error("stamp not found");
  if (stamp.status !== "pending") throw new Error(`stamp is ${stamp.status}`);
  if (!stamp.onchainId) throw new Error("stamp has no onchain id yet");

  const tx = await executeContract({
    walletId: params.walletId,
    contractAddress: escrow,
    abiFunctionSignature:
      params.action === "refund" ? "refund(uint256)" : "forfeit(uint256)",
    abiParameters: [stamp.onchainId.toString()],
  });
  const confirmed = await pollTx(tx.id);

  await db
    .update(schema.stamps)
    .set({
      status: params.action === "refund" ? "refunded" : "forfeited",
      resolveTxHash: confirmed.txHash ?? null,
      resolvedAt: new Date(),
    })
    .where(eq(schema.stamps.id, params.stampId));

  return { txHash: confirmed.txHash };
}

export async function triageBatch(params: {
  userId: string;
  walletId: string;
  stampIds: string[];
  action: "refund" | "forfeit";
}) {
  const escrow = requireEscrowAddress();
  const rows = await db
    .select()
    .from(schema.stamps)
    .where(
      and(
        inArray(schema.stamps.id, params.stampIds),
        eq(schema.stamps.recipientId, params.userId),
        eq(schema.stamps.status, "pending")
      )
    );
  const onchainIds = rows
    .map((r) => r.onchainId)
    .filter((x): x is bigint => x != null)
    .map((x) => x.toString());
  if (!onchainIds.length) return { txHash: null, count: 0 };

  const tx = await executeContract({
    walletId: params.walletId,
    contractAddress: escrow,
    abiFunctionSignature:
      params.action === "refund"
        ? "refundBatch(uint256[])"
        : "forfeitBatch(uint256[])",
    abiParameters: [onchainIds],
  });
  const confirmed = await pollTx(tx.id);

  await db
    .update(schema.stamps)
    .set({
      status: params.action === "refund" ? "refunded" : "forfeited",
      resolveTxHash: confirmed.txHash ?? null,
      resolvedAt: new Date(),
    })
    .where(
      and(
        inArray(
          schema.stamps.id,
          rows.map((r) => r.id)
        ),
        eq(schema.stamps.status, "pending")
      )
    );

  return { txHash: confirmed.txHash, count: rows.length };
}
