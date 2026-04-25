import { createPublicClient, defineChain, http, webSocket } from "viem";

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: {
    // USDC is the native gas token on Arc. We keep 18 decimals here because
    // that's what the chain reports for `eth_*` RPC calls; the USDC ERC-20
    // interface itself uses 6 decimals (see USDC_DECIMALS below).
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"],
      webSocket: [process.env.ARC_WS_URL ?? "wss://rpc.testnet.arc.network"],
    },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const USDC_DECIMALS = 6;

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(process.env.ARC_RPC_URL),
});

export const wsClient = createPublicClient({
  chain: arcTestnet,
  transport: webSocket(process.env.ARC_WS_URL),
});

export const USDC_ADDRESS =
  (process.env.USDC_ADDRESS as `0x${string}`) ??
  "0x3600000000000000000000000000000000000000";

export const STAMP_ESCROW_ADDRESS = process.env
  .STAMP_ESCROW_ADDRESS as `0x${string}` | undefined;

export function explorerTx(hash: string): string {
  return `${process.env.ARC_EXPLORER ?? "https://testnet.arcscan.app"}/tx/${hash}`;
}

export function explorerAddress(addr: string): string {
  return `${process.env.ARC_EXPLORER ?? "https://testnet.arcscan.app"}/address/${addr}`;
}
