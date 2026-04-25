// Debug: try sending one stamp from the spammer to the founder, dump every
// step. Prints the actual Circle / chain error so we can see why the UI's
// spam-wave shows "0 sent, 25 failed".
//
// Run with:  node scripts/debug-send.mjs <senderHandle> <recipientHandle> [stakeUsdc]
//   default: node scripts/debug-send.mjs spammer founder 0.10

import "dotenv/config";
import mysql from "mysql2/promise";

const [, , senderHandleArg = "spammer", recipientHandleArg = "founder", stakeUsdcArg = "0.10"] =
  process.argv;
const senderHandle = senderHandleArg.toLowerCase();
const recipientHandle = recipientHandleArg.toLowerCase();

function parseDb(url) {
  const u = new URL(url);
  let ssl;
  const sslParam = u.searchParams.get("ssl");
  if (sslParam) {
    try {
      ssl = JSON.parse(sslParam);
    } catch {
      ssl = { rejectUnauthorized: true };
    }
  } else if (u.hostname.endsWith("tidbcloud.com")) {
    ssl = { rejectUnauthorized: true };
  }
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 4000,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    ssl,
  };
}

const conn = await mysql.createConnection(parseDb(process.env.DATABASE_URL));
const [users] = await conn.query(
  "SELECT id, handle, wallet_id AS walletId, wallet_address AS walletAddress FROM users WHERE handle IN (?, ?)",
  [senderHandle, recipientHandle]
);
await conn.end();

const sender = users.find((u) => u.handle === senderHandle);
const recipient = users.find((u) => u.handle === recipientHandle);
if (!sender) throw new Error(`sender '${senderHandle}' not found in DB`);
if (!recipient) throw new Error(`recipient '${recipientHandle}' not found in DB`);

console.log("Sender:   ", sender);
console.log("Recipient:", recipient);
console.log("");

if (!sender.walletId || !sender.walletAddress) {
  console.error("Sender has no wallet provisioned. Visit /onboard to retry.");
  process.exit(1);
}
if (!recipient.walletAddress) {
  console.error("Recipient has no wallet provisioned. Visit /onboard to retry.");
  process.exit(1);
}

// --- Circle calls ---
const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
const blockchain = process.env.CIRCLE_BLOCKCHAIN ?? "ARC-TESTNET";
const escrow = process.env.STAMP_ESCROW_ADDRESS;
const usdcAddr = process.env.USDC_ADDRESS;
if (!apiKey) throw new Error("CIRCLE_API_KEY not set");
if (!entitySecret) throw new Error("CIRCLE_ENTITY_SECRET not set");
if (!escrow) throw new Error("STAMP_ESCROW_ADDRESS not set");
if (!usdcAddr) throw new Error("USDC_ADDRESS not set");

console.log("Blockchain:", blockchain);
console.log("Escrow:    ", escrow);
console.log("USDC:      ", usdcAddr);
console.log("");

const { publicEncrypt, constants, randomUUID } = await import("crypto");

async function circleFetch(path, init = {}) {
  const { body, ...rest } = init;
  const res = await fetch(`https://api.circle.com${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    console.error(`Circle ${init.method ?? "GET"} ${path} → ${res.status}`);
    console.error(JSON.stringify(parsed, null, 2));
    throw new Error(`Circle error ${res.status}`);
  }
  return parsed;
}

async function entityCiphertext() {
  const { data } = await circleFetch("/v1/w3s/config/entity/publicKey");
  const enc = publicEncrypt(
    {
      key: data.publicKey,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(entitySecret, "hex")
  );
  return enc.toString("base64");
}

console.log("→ Reading sender wallet balance...");
const balanceResp = await circleFetch(`/v1/w3s/wallets/${sender.walletId}/balances`);
console.log(JSON.stringify(balanceResp.data, null, 2));
console.log("");

const stakeWei = BigInt(Math.round(Number(stakeUsdcArg) * 1e6));
console.log(`Stake (wei, 6 decimals): ${stakeWei.toString()}`);

// 1) approve
console.log("");
console.log("→ approve(escrow, stake)");
const approve = await circleFetch("/v1/w3s/developer/transactions/contractExecution", {
  method: "POST",
  body: {
    idempotencyKey: randomUUID(),
    entitySecretCiphertext: await entityCiphertext(),
    walletId: sender.walletId,
    contractAddress: usdcAddr,
    abiFunctionSignature: "approve(address,uint256)",
    abiParameters: [escrow, stakeWei.toString()],
    feeLevel: "MEDIUM",
  },
});
console.log("approve tx id:", approve.data?.id, "state:", approve.data?.state);

async function pollTx(id, label) {
  for (let i = 0; i < 40; i++) {
    const r = await circleFetch(`/v1/w3s/transactions/${id}`);
    const tx = r.data?.transaction;
    process.stdout.write(`  [${label}] ${tx.state}${tx.txHash ? " " + tx.txHash : ""}\n`);
    if (tx.state === "CONFIRMED" || tx.state === "COMPLETE") return tx;
    if (["FAILED", "CANCELED", "DENIED"].includes(tx.state)) {
      console.error("  full tx:", JSON.stringify(tx, null, 2));
      throw new Error(`${label} ended in ${tx.state}: ${tx.errorReason ?? ""}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`${label} timed out`);
}

await pollTx(approve.data.id, "approve");

// 2) sendStamp
console.log("");
console.log("→ sendStamp(recipient, stake, hash)");
const { keccak_256 } = await import("@noble/hashes/sha3").catch(() => ({}));
// Fall back: just use a deterministic 32-byte hash via sha256 if noble isn't installed.
const { createHash } = await import("crypto");
const hashHex =
  "0x" +
  createHash("sha256")
    .update(`debug-${Date.now()}`)
    .digest("hex");

const send = await circleFetch("/v1/w3s/developer/transactions/contractExecution", {
  method: "POST",
  body: {
    idempotencyKey: randomUUID(),
    entitySecretCiphertext: await entityCiphertext(),
    walletId: sender.walletId,
    contractAddress: escrow,
    abiFunctionSignature: "sendStamp(address,uint128,bytes32)",
    abiParameters: [recipient.walletAddress, stakeWei.toString(), hashHex],
    feeLevel: "MEDIUM",
  },
});
console.log("sendStamp tx id:", send.data?.id, "state:", send.data?.state);
const final = await pollTx(send.data.id, "sendStamp");
console.log("");
console.log("✔ sendStamp confirmed:", final.txHash);
