/**
 * Thin wrapper around Circle's Developer-Controlled Wallets REST API.
 *
 * Docs: https://developers.circle.com/w3s/reference
 *
 * Two prerequisites the dev needs to satisfy once, then the code "just works":
 *   1. CIRCLE_API_KEY        from console.circle.com
 *   2. CIRCLE_ENTITY_SECRET  generated + registered (ciphertext) via console
 *
 * For Entity-Secret-gated endpoints (create wallet, sign/send tx) we require a
 * freshly generated ciphertext each call. Circle exposes the RSA pubkey at
 * /v1/w3s/config/entity/publicKey; we encrypt CIRCLE_ENTITY_SECRET with it.
 */
import { randomUUID, publicEncrypt, constants as cryptoConstants } from "crypto";

const API_BASE = "https://api.circle.com";

function authHeaders() {
  const key = process.env.CIRCLE_API_KEY;
  if (!key) throw new Error("CIRCLE_API_KEY not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function circleFetch<T>(
  path: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {}
): Promise<T> {
  const { body, headers, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: { ...authHeaders(), ...(headers ?? {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Circle ${init.method ?? "GET"} ${path} ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

let cachedPubKey: string | undefined;

async function getEntityPublicKey(): Promise<string> {
  if (cachedPubKey) return cachedPubKey;
  const { data } = await circleFetch<{ data: { publicKey: string } }>(
    "/v1/w3s/config/entity/publicKey"
  );
  cachedPubKey = data.publicKey;
  return cachedPubKey;
}

async function buildEntitySecretCiphertext(): Promise<string> {
  const secretHex = process.env.CIRCLE_ENTITY_SECRET;
  if (!secretHex) throw new Error("CIRCLE_ENTITY_SECRET not set");
  const pubKey = await getEntityPublicKey();
  const encrypted = publicEncrypt(
    {
      key: pubKey,
      oaepHash: "sha256",
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(secretHex, "hex")
  );
  return encrypted.toString("base64");
}

export const CIRCLE_BLOCKCHAIN = process.env.CIRCLE_BLOCKCHAIN ?? "ARC-TESTNET";

export type CircleWallet = {
  id: string;
  address: string;
  blockchain: string;
};

export async function createWallet(refId: string): Promise<CircleWallet> {
  const entitySecretCiphertext = await buildEntitySecretCiphertext();
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID;
  if (!walletSetId) throw new Error("CIRCLE_WALLET_SET_ID not set");

  const body = {
    idempotencyKey: randomUUID(),
    entitySecretCiphertext,
    accountType: "EOA",
    blockchains: [CIRCLE_BLOCKCHAIN],
    count: 1,
    walletSetId,
    refId,
  };

  const { data } = await circleFetch<{
    data: { wallets: Array<{ id: string; address: string; blockchain: string }> };
  }>("/v1/w3s/developer/wallets", { method: "POST", body });

  const w = data.wallets[0];
  return { id: w.id, address: w.address, blockchain: w.blockchain };
}

export async function getWalletBalance(walletId: string): Promise<bigint> {
  const { data } = await circleFetch<{
    data: {
      tokenBalances: Array<{
        amount: string;
        token: { symbol: string; decimals: number };
      }>;
    };
  }>(`/v1/w3s/wallets/${walletId}/balances`);
  const usdc = data.tokenBalances.find((b) => b.token.symbol === "USDC");
  if (!usdc) return 0n;
  return parseDecimalToBaseUnits(usdc.amount, usdc.token.decimals);
}

/**
 * Convert a decimal string like "1.234567" into integer base units without
 * going through floating-point (parseFloat would lose precision for large
 * amounts or high-decimal tokens).
 */
function parseDecimalToBaseUnits(decimal: string, decimals: number): bigint {
  const [whole, frac = ""] = decimal.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

export type ContractExecutionInput = {
  walletId: string;
  contractAddress: `0x${string}`;
  abiFunctionSignature: string; // e.g. "sendStamp(address,uint128,bytes32)"
  abiParameters: unknown[];
  feeLevel?: "LOW" | "MEDIUM" | "HIGH";
};

export type CircleTxSummary = {
  id: string;
  state: string;
  txHash?: string;
};

/**
 * Fires a contract-execution transaction from a Developer-Controlled Wallet.
 * Returns as soon as Circle accepts it; use pollTx to wait for onchain confirmation.
 */
export async function executeContract(
  input: ContractExecutionInput
): Promise<CircleTxSummary> {
  const entitySecretCiphertext = await buildEntitySecretCiphertext();
  const body = {
    idempotencyKey: randomUUID(),
    entitySecretCiphertext,
    walletId: input.walletId,
    contractAddress: input.contractAddress,
    abiFunctionSignature: input.abiFunctionSignature,
    abiParameters: input.abiParameters,
    // Circle's contractExecution endpoint wants feeLevel as a top-level field.
    // The nested { fee: { type: "level", config: {...} } } shape is rejected.
    feeLevel: input.feeLevel ?? "MEDIUM",
  };
  const { data } = await circleFetch<{
    data: { id: string; state: string; txHash?: string };
  }>("/v1/w3s/developer/transactions/contractExecution", {
    method: "POST",
    body,
  });
  return data;
}

export async function getTx(id: string): Promise<CircleTxSummary> {
  const { data } = await circleFetch<{
    data: { transaction: { id: string; state: string; txHash?: string } };
  }>(`/v1/w3s/transactions/${id}`);
  return data.transaction;
}

export async function pollTx(
  id: string,
  { timeoutMs = 60_000, intervalMs = 1_500 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<CircleTxSummary> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tx = await getTx(id);
    if (tx.state === "CONFIRMED" || tx.state === "COMPLETE") return tx;
    if (
      tx.state === "FAILED" ||
      tx.state === "CANCELED" ||
      tx.state === "DENIED"
    ) {
      throw new Error(`Circle tx ${id} ended in state ${tx.state}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Circle tx ${id} timed out`);
}
