import { parseUnits, formatUnits, keccak256, toHex } from "viem";
import { USDC_DECIMALS } from "./arc";

export const STAMP_ESCROW_ABI = [
  {
    type: "function",
    name: "sendStamp",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint128" },
      { name: "messageHash", type: "bytes32" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "forfeit",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "refundBatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "ids", type: "uint256[]" }],
    outputs: [],
  },
  {
    type: "function",
    name: "forfeitBatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "ids", type: "uint256[]" }],
    outputs: [],
  },
  {
    type: "function",
    name: "expire",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "protocolFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
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
  },
  {
    type: "event",
    name: "StampRefunded",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "by", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "StampForfeited",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "feeTaken", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const USDC_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export function usdcToWei(usdc: string | number): bigint {
  return parseUnits(String(usdc), USDC_DECIMALS);
}

export function weiToUsdc(wei: bigint): string {
  return formatUnits(wei, USDC_DECIMALS);
}

export function messageHash(subject: string, body: string): `0x${string}` {
  return keccak256(toHex(`${subject}\n\n${body}`));
}
