// Demo: send N stamps from <senderHandle> to <recipientHandle>, each
// performing approve + sendStamp on Arc. Inserts the rows into the
// `stamps` table with `status='pending'` and the decoded onchain id so
// the inbox + triage flows work afterwards.
//
// Also clears any prior failed/submitting rows between this pair so the
// inbox stays clean.
//
// Usage: node scripts/demo-spam-wave.mjs <sender> <recipient> [count] [stakeUsdc]
// Default: node scripts/demo-spam-wave.mjs spammer founder 25 0.10

import "dotenv/config";
import { randomUUID, publicEncrypt, constants as cryptoConstants } from "crypto";
import mysql from "mysql2/promise";
import {
  createPublicClient,
  http,
  keccak256,
  toHex,
  parseUnits,
  decodeEventLog,
  defineChain,
} from "viem";

const [, , senderArg = "spammer", recipientArg = "founder", countArg = "25", stakeArg = "0.10"] =
  process.argv;
const senderHandle = senderArg.toLowerCase();
const recipientHandle = recipientArg.toLowerCase();
const count = Number(countArg);
const stakeUsdc = stakeArg;

const escrow = process.env.STAMP_ESCROW_ADDRESS;
const usdcAddr = process.env.USDC_ADDRESS;
const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
const blockchain = process.env.CIRCLE_BLOCKCHAIN ?? "ARC-TESTNET";
const explorer = process.env.ARC_EXPLORER ?? "https://testnet.arcscan.app";
if (!escrow || !usdcAddr || !apiKey || !entitySecret)
  throw new Error("missing required env (CIRCLE_*, STAMP_ESCROW_ADDRESS, USDC_ADDRESS)");

const arc = defineChain({
  id: Number(process.env.ARC_CHAIN_ID ?? 5042002),
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"] } },
});
const publicClient = createPublicClient({ chain: arc, transport: http() });

const STAMP_SENT_EVENT = {
  type: "event",
  name: "StampSent",
  inputs: [
    { name: "id", type: "uint256", indexed: true },
    { name: "sender", type: "address", indexed: true },
    { name: "recipient", type: "address", indexed: true },
    { name: "amount", type: "uint128", indexed: false },
    { name: "messageHash", type: "bytes32", indexed: false },
  ],
  anonymous: false,
};

// --- DB ---
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
const sender = users.find((u) => u.handle === senderHandle);
const recipient = users.find((u) => u.handle === recipientHandle);
if (!sender || !sender.walletId) throw new Error(`sender '${senderHandle}' has no wallet`);
if (!recipient || !recipient.walletAddress)
  throw new Error(`recipient '${recipientHandle}' has no wallet`);

console.log(`Sender:   ${sender.handle} ${sender.walletAddress} (wallet ${sender.walletId})`);
console.log(`Recipient: ${recipient.handle} ${recipient.walletAddress}`);
console.log("");

// Wipe stale failed/submitting rows between this pair so the inbox is clean.
const [del] = await conn.query(
  "DELETE FROM stamps WHERE sender_id = ? AND recipient_id = ? AND status IN ('failed','submitting')",
  [sender.id, recipient.id]
);
console.log(`Cleared ${del.affectedRows} stale rows`);
console.log("");

// --- Circle helpers ---
async function circleFetch(path, init = {}) {
  const { body, ...rest } = init;
  const res = await fetch(`https://api.circle.com${path}`, {
    ...rest,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    throw new Error(`Circle ${init.method ?? "GET"} ${path} ${res.status}: ${JSON.stringify(parsed)}`);
  }
  return parsed;
}
let cachedPubKey;
async function entityCiphertext() {
  if (!cachedPubKey) {
    const { data } = await circleFetch("/v1/w3s/config/entity/publicKey");
    cachedPubKey = data.publicKey;
  }
  const enc = publicEncrypt(
    { key: cachedPubKey, oaepHash: "sha256", padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING },
    Buffer.from(entitySecret, "hex")
  );
  return enc.toString("base64");
}
async function exec(walletId, contract, sig, params) {
  return circleFetch("/v1/w3s/developer/transactions/contractExecution", {
    method: "POST",
    body: {
      idempotencyKey: randomUUID(),
      entitySecretCiphertext: await entityCiphertext(),
      walletId,
      contractAddress: contract,
      abiFunctionSignature: sig,
      abiParameters: params,
      feeLevel: "MEDIUM",
    },
  });
}
async function pollTx(id, label, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await circleFetch(`/v1/w3s/transactions/${id}`);
    const t = data.transaction;
    if (t.state === "CONFIRMED" || t.state === "COMPLETE") return t;
    if (["FAILED", "CANCELED", "DENIED"].includes(t.state)) {
      throw new Error(`${label} ${t.state}: ${t.errorReason ?? JSON.stringify(t)}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`${label} timed out after ${timeoutMs}ms`);
}

// --- Spam content ---
const SUBJECTS = [
  "Unlock $10K/mo with our AI SDR",
  "I saw your LinkedIn — partnership?",
  "Boost your SEO by 300% this week",
  "Important: regarding your domain",
  "Web3 grant application — your project qualifies",
  "Quick question about your product",
  "Re: our call (never had one)",
  "Crypto airdrop eligibility",
  "You have unclaimed tokens",
  "Exclusive founder invite",
  "Guest post opportunity on DA70 site",
  "Content for your blog?",
  "Get on Forbes — 3 spots left",
  "VIP list for <company> event",
  "Your website has 12 critical issues",
];
const BODIES = [
  "Hi founder, I noticed you're building something cool. We help startups like yours 10x revenue with our AI-powered outbound. Can we hop on a 15-min call?",
  "Hey, I'll be brief. Our platform integrates with your stack in under an hour and typically saves clients 40 hours/week. Interested?",
  "Congrats on the recent traction. We've helped 200+ similar companies scale with our proprietary growth framework. Time for a quick chat?",
  "Hi! I'm reaching out about a partnership opportunity. We have 50K users in your target segment. Reply YES if you want details.",
  "Dear Sir/Madam, We are a Nigerian prince — wait, that's the old script. Our new one: we are a Web3 VC with $50M ready to deploy.",
];

const stakeWei = parseUnits(stakeUsdc, 6);

console.log(`→ firing ${count} stamps (${stakeUsdc} USDC each = ${stakeWei}wei)`);
console.log("");

const results = [];
const batchTag = Date.now();
for (let i = 0; i < count; i++) {
  const subject = SUBJECTS[i % SUBJECTS.length];
  const body = `${BODIES[i % BODIES.length]}\n\n[batch ${batchTag}#${i}]`;
  const hash = keccak256(toHex(`${subject}\n\n${body}`));
  const stampId = randomUUID();

  process.stdout.write(`[${i + 1}/${count}] insert + approve + sendStamp ... `);

  await conn.query(
    `INSERT INTO stamps
       (id, sender_id, sender_address, recipient_id, recipient_address,
        subject, body, stake_wei, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitting', NOW())`,
    [
      stampId,
      sender.id,
      sender.walletAddress.toLowerCase(),
      recipient.id,
      recipient.walletAddress,
      subject,
      body,
      stakeWei.toString(),
    ]
  );

  try {
    const approve = await exec(sender.walletId, usdcAddr, "approve(address,uint256)", [
      escrow,
      stakeWei.toString(),
    ]);
    await pollTx(approve.data.id, `[${i + 1}] approve`);

    const send = await exec(sender.walletId, escrow, "sendStamp(address,uint128,bytes32)", [
      recipient.walletAddress,
      stakeWei.toString(),
      hash,
    ]);
    const final = await pollTx(send.data.id, `[${i + 1}] send`);
    const txHash = final.txHash;

    let onchainId = null;
    if (txHash) {
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 20_000 });
        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== escrow.toLowerCase()) continue;
          try {
            const decoded = decodeEventLog({ abi: [STAMP_SENT_EVENT], data: log.data, topics: log.topics });
            if (decoded.eventName === "StampSent") {
              onchainId = decoded.args.id.toString();
              break;
            }
          } catch {}
        }
      } catch (e) {
        console.warn(`  receipt decode failed: ${e.message}`);
      }
    }

    await conn.query(
      "UPDATE stamps SET status='pending', send_tx_hash=?, onchain_id=? WHERE id=?",
      [txHash, onchainId, stampId]
    );
    results.push({ ok: true, txHash, onchainId });
    console.log(`OK  id=${onchainId ?? "?"}  tx=${txHash}`);
  } catch (err) {
    await conn.query("UPDATE stamps SET status='failed' WHERE id=?", [stampId]);
    results.push({ ok: false, error: err.message });
    console.log(`FAIL  ${err.message}`);
  }
}

await conn.end();

const ok = results.filter((r) => r.ok).length;
console.log("");
console.log(`✔ ${ok}/${count} stamps landed onchain (${ok * 2} total tx incl. approve)`);
if (results.some((r) => r.ok)) {
  console.log("");
  console.log("Latest tx:", `${explorer}/tx/${results.filter((r) => r.ok).at(-1).txHash}`);
}
