# Stamp — pay-to-reach inbox on Arc

**Circle "Agentic Economy" hackathon · Arc Testnet · USDC · Nanopayments**

Senders stake USDC to get a stranger's attention. If the recipient decides the
message is legit, the stake is refunded. If it's spam, the recipient keeps it
(minus a small protocol fee). Settled per-message on Arc with sub-cent gas.

## Track alignment

Primary: **🛒 Real-Time Micro-Commerce Flow** — economic activity is triggered
and settled per interaction, not per subscription. Every stamp is an onchain
USDC transfer into escrow, then a second onchain action by the recipient.

Secondary: **🤖 Agent-to-Agent Payment Loop** — the same escrow lets an AI
agent pay for priority triage of another agent's inbox.

## Why this must be Nanopayments

| Rail                   | Cost per $0.25 stamp       | Works? |
| ---------------------- | -------------------------- | ------ |
| Stripe                 | $0.30 + 2.9% = $0.308 fee  | ❌ net-negative |
| Ethereum mainnet       | ~$0.50–$3 gas, paid in ETH | ❌ dominates stake |
| **Arc / Nanopayments** | sub-cent gas, paid in USDC | ✅ viable |

The stake amount (~$0.25) is chosen to be painful for spammers yet trivial for
legitimate senders. Any rail that takes more than a few cents to move $0.25
destroys the unit economics. Arc's USDC-native gas and Circle's programmable
wallet infra are what make this product possible.

## Tech stack

- **Contracts**: Solidity `StampEscrow.sol` — deploy via Remix IDE
- **Chain**: Arc Testnet (chain `5042002`, USDC at `0x3600…0000`)
- **App**: Next.js 16 (App Router, React 19, Turbopack) with `pnpm`
- **Wallets**: Circle Developer-Controlled Wallets (no seed phrases for users)
- **Database**: TiDB Cloud (MySQL) via Drizzle ORM
- **Chain client**: Viem 2 + WebSocket subscriptions
- **Auth**: NextAuth v5 (credentials)
- **LLM triage**: GLM 5.1 via OpenAI-compatible endpoint

## Repo layout

```
contracts/           StampEscrow.sol — paste into Remix and deploy
apps/web/            Next.js 16 app
  src/
    app/             routes (inbox, sent, compose, demo, api/*)
    lib/
      arc.ts         Arc chain + Viem clients
      contract.ts    StampEscrow ABI + helpers
      circle.ts      Circle Dev-Controlled Wallet REST wrapper
      stamp.ts       sendStamp / refund / forfeit orchestration
      db/            Drizzle schema + client
      llm.ts         GLM 5.1 client (OpenAI-compat)
    proxy.ts         Auth guard (Next.js 16 replaces middleware.ts)
  drizzle/           generated SQL migrations
.env.example         all required env vars
```

## Setup (run once)

### 1. Contract

1. Open https://remix.ethereum.org
2. Paste `contracts/StampEscrow.sol` into a new file
3. Add Arc Testnet in MetaMask:
   - RPC: `https://rpc.testnet.arc.network`
   - Chain ID: `5042002`
   - Currency symbol: `USDC`
   - Block explorer: `https://testnet.arcscan.app`
4. Fund the deployer wallet with testnet USDC: https://faucet.circle.com
5. In Remix: Compile → Deploy with constructor args:
   - `_usdc` = `0x3600000000000000000000000000000000000000`
   - `_feeSink` = an address you control (protocol treasury)
6. Copy the deployed contract address into `STAMP_ESCROW_ADDRESS` in `.env`

### 2. Circle Developer-Controlled Wallets

1. Sign in at https://console.circle.com
2. Create a `TEST_API_KEY` — put it in `CIRCLE_API_KEY`
3. Generate + register an **Entity Secret** (hex string) — put it in
   `CIRCLE_ENTITY_SECRET`
4. Create a `WalletSet` — put its ID in `CIRCLE_WALLET_SET_ID`
5. Confirm the blockchain identifier Circle uses for Arc Testnet — set
   `CIRCLE_BLOCKCHAIN` (defaults to `EVM-TESTNET`)

### 3. Database (TiDB Cloud)

1. Create a free Serverless cluster at https://tidbcloud.com
2. Grab the MySQL connection string — paste it into `DATABASE_URL`
3. Run migrations:
   ```bash
   cd apps/web
   pnpm db:push
   ```

### 4. LLM (for auto-triage)

GLM 5.1 via z.ai or any OpenAI-compatible endpoint:
```
LLM_BASE_URL=https://api.z.ai/api/paas/v4
LLM_API_KEY=...
LLM_MODEL=glm-5.1
```

### 5. Run

```bash
cd apps/web
cp ../../.env.example .env
# fill in secrets from steps above
pnpm install
pnpm dev
```

Open http://localhost:3000

## Demo script (produces 50+ onchain tx)

**Before demo**:
1. Deploy contract, set `STAMP_ESCROW_ADDRESS`.
2. Sign up two users: `founder` (the VIP) and `spammer` (the bot).
3. Send each wallet ~$5 of testnet USDC from https://faucet.circle.com so
   they have both gas and stake liquidity.

**Live walkthrough**:

| # | Action | Tx on Arc |
|---|--------|-----------|
| 1 | Sign up a 3rd judge account (passkey-free, wallet auto-provisioned) | 0 |
| 2 | From judge → compose a stamped message to `founder` ($0.25) | 2 (approve + send) |
| 3 | Switch to `founder` inbox — judge sees it with status `pending` | 0 |
| 4 | Founder clicks **Refund** → judge's stake returns | 1 |
| 5 | Open `/demo` as `spammer`, fire 15 stamps at `founder` ($0.10 each) | 30 |
| 6 | Switch to `founder`, click **AI triage (GLM)** → 15 classifications persist | 0 |
| 7 | Click **Select AI-spam** → **Forfeit** (bulk) | 1 |
| 8 | Show ArcScan: all tx visible; spammer balance down, founder balance up | — |

**Total: ~34 tx from this flow; extend to 50+ by running the spam wave twice
or increasing `count`.** `forfeitBatch` and `refundBatch` collapse N resolves
into 1 tx, but a purist demo can triage messages individually for 1 tx each.

## Architecture

```
 Sender UI ──► /api/stamps/send ──► Circle DCW: approve(USDC → escrow)
                                └─► Circle DCW: StampEscrow.sendStamp()
                                └─► decodes StampSent event → stores onchain id

 Recipient UI ──► /api/stamps/triage ──► Circle DCW: refund() | forfeit()
                                    └─► marks stamp resolved in DB

 Recipient UI ──► /api/stamps/suggest ──► GLM 5.1 → {legit,spam,unsure} per stamp

 Background: DB is a projection of onchain state. Arc is the authoritative
 ledger; contract view functions are source of truth on any dispute.
```

## Economics

- `protocolFeeBps = 500` (5% of every forfeit). At 10k daily messages × 10%
  spam × $0.25 × 5% = **$12.50/day protocol revenue per 10k daily messages.**
- Variable cost per stamp lifecycle (approve + send + resolve = 3 onchain tx
  at Arc's sub-cent gas): **~$0.001**. Economic margin is preserved.
- On Stripe this same flow would cost the sender $0.924 in fees to stake
  $0.25 ($0.308 × 3 ops), or ~370% of the stake value. Completely broken.

## Feedback for Circle (hackathon track)

Filed as `FEEDBACK.md` alongside this README — covers our experience with
Nanopayments, Developer-Controlled Wallets, and Arc Testnet during the build.

## What's next

- **ERC-8004 reputation**: senders build a public "refund rate" score; receivers
  sort inbox by reputation × stake.
- **x402 reply-pricing**: recipient can bill senders for a written response.
- **Agent inboxes**: MCP server that lets autonomous agents triage stamped
  inbounds on behalf of a human.
- **Anti-griefing**: cap the damage one spammer can cause a single recipient
  per day via a rate-limited view on the contract.
