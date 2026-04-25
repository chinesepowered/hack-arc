# Deploy & Demo Guide

End-to-end instructions to go from a fresh clone to a running demo of Stamp
on Arc Testnet.

**Estimated time:** 30–45 minutes (most of it is waiting on Circle console
steps and faucet drips).

---

## 0. Prerequisites

You need:

- **Node.js ≥ 20.9** (Next.js 16 requirement)
- **pnpm 9+** — `npm i -g pnpm` if missing
- **Git**
- **A browser with MetaMask** — for the one-time Remix deploy step only. End
  users of the app do **not** need MetaMask.
- Accounts at:
  - [console.circle.com](https://console.circle.com) — free
  - [tidbcloud.com](https://tidbcloud.com) — free Serverless tier
  - [z.ai](https://z.ai) or any OpenAI-compatible GLM provider — for the AI
    triage feature (optional; skip if you don't care about that button)

---

## 1. Clone & install

```bash
git clone <this-repo>
cd hack-arc
pnpm install
```

---

## 2. Deploy `StampEscrow.sol` via Remix

### 2a. Add Arc Testnet to MetaMask

In MetaMask → Settings → Networks → Add network → Add a network manually:

| Field | Value |
|---|---|
| Network name | `Arc Testnet` |
| New RPC URL | `https://rpc.testnet.arc.network` |
| Chain ID | `5042002` |
| Currency symbol | `USDC` |
| Block explorer URL | `https://testnet.arcscan.app` |

### 2b. Fund your deployer wallet

Go to https://faucet.circle.com, select **Arc Testnet**, paste your MetaMask
address, and request USDC. USDC is both the gas token and the stake
currency, so you only need one faucet drip.

### 2c. Compile + deploy

1. Open https://remix.ethereum.org
2. Create a new file `StampEscrow.sol`. Paste the full contents of
   `contracts/StampEscrow.sol` from this repo.
3. **Solidity Compiler** tab:
   - Compiler version `0.8.24` (or any 0.8.24+)
   - Click **Compile StampEscrow.sol**
4. **Deploy & run transactions** tab:
   - Environment: **Injected Provider — MetaMask** (confirm Arc Testnet
     shows as the active chain in Remix; the chain ID should read 5042002)
   - Contract: `StampEscrow`
   - Next to the orange **Deploy** button, expand the constructor inputs:
     - `_usdc` = `0x3600000000000000000000000000000000000000`
     - `_feeSink` = any address you control (same MetaMask account is
       fine — this wallet will receive 5% of every forfeit)
   - Click **Deploy**, confirm in MetaMask
5. Once confirmed, scroll to **Deployed Contracts** at the bottom and copy
   the contract address (the string next to the chevron). This is your
   `STAMP_ESCROW_ADDRESS`.

You can verify it worked by pasting the address into
https://testnet.arcscan.app.

---

## 3. Set up Circle Developer-Controlled Wallets

### 3a. API key

1. Sign in to https://console.circle.com
2. **Developer → API Keys → Create a key** — choose `TEST_API_KEY`
3. Copy the key (shown once) — this is `CIRCLE_API_KEY`

### 3b. Entity Secret

The Entity Secret is a 32-byte hex string that gates all wallet-control
operations. You generate it once, register its RSA-encrypted ciphertext
with Circle, then keep the plaintext locally. The app re-encrypts the
plaintext per request.

The Circle console UI for this is buried (it's not under "Keys" — those
are API keys, Client keys, and Kit keys). The fastest path is to run
the included script, which uses the official Circle SDK to generate +
register + save the recovery file in one shot.

```bash
# After putting CIRCLE_API_KEY in .env (from step 3a):
pnpm circle:register-entity
```

The script will:
1. Generate a fresh 32-byte hex Entity Secret
2. Encrypt it with Circle's public key and POST the ciphertext to
   `/v1/w3s/config/entity/entitySecret`
3. Save the recovery file to `./circle-recovery.dat`
4. Print a `CIRCLE_ENTITY_SECRET=...` line for you to paste into `.env`

Then:
- Paste the printed `CIRCLE_ENTITY_SECRET=...` into your `.env`
- Move `circle-recovery.dat` somewhere safe outside the repo (it's
  gitignored, but you'll want it in a password manager — it's the only
  way to reset the Entity Secret if you lose the plaintext)

> If you'd rather use the Circle Console UI: it lives under the
> **Programmable Wallets** section as a setup wizard that appears the
> first time you try to create a wallet (not under the "Keys" page).
> The script avoids hunting for it.

### 3c. Wallet Set

1. Console → **Developer → Wallet Sets → Create Wallet Set**
2. Name it anything (e.g. `stamp-hackathon`)
3. Copy the **Wallet Set ID** → `CIRCLE_WALLET_SET_ID`

### 3d. Blockchain identifier

`CIRCLE_BLOCKCHAIN=ARC-TESTNET` is already the default in
`.env.example` — Circle's public docs confirm this is the canonical
identifier. You don't need to change it.

---

## 4. Set up TiDB Cloud

1. Sign up at https://tidbcloud.com (GitHub SSO is fastest)
2. Create a **Serverless** cluster (free tier, AWS region of choice)
3. Once ready, click **Connect** on the cluster overview
4. Choose **General** → **MySQL CLI**. The dialog shows a connection
   string. Convert it to a URI format for `mysql2`:
   ```
   mysql://<user>:<password>@gateway01.<region>.prod.aws.tidbcloud.com:4000/<db>?ssl={"rejectUnauthorized":true}
   ```
   - Replace `<user>`, `<password>`, `<region>`, `<db>` from the console
   - Create a database in the SQL editor first if none exists:
     `CREATE DATABASE stamp;`
5. Put the full URI into `DATABASE_URL` in `.env`. Because the value
   contains `{"..."}`, wrap the whole thing in single quotes:
   ```
   DATABASE_URL='mysql://user:pass@gateway01...:4000/stamp?ssl={"rejectUnauthorized":true}'
   ```

---

## 5. (Optional) Set up GLM 5.1 for AI triage

Only needed if you want to demo the **AI triage** button.

1. Sign up at https://z.ai
2. Create an API key
3. Set:
   ```
   LLM_BASE_URL=https://api.z.ai/api/paas/v4
   LLM_API_KEY=<your key>
   LLM_MODEL=glm-5.1
   ```

Any OpenAI-compatible endpoint works — Groq, Together, local Ollama with
`OPENAI_BASE_URL`-compatible proxy, etc. Just change `LLM_BASE_URL` and
`LLM_MODEL` accordingly.

---

## 6. Write `.env`

```bash
cp .env.example .env
```

The `.env` lives at the repo root — that's where Next.js and `drizzle-kit`
look for it. Fill in, at minimum:

- `STAMP_ESCROW_ADDRESS` — from step 2c
- `FEE_SINK_ADDRESS` — the address you passed as `_feeSink` in step 2c
- `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `CIRCLE_WALLET_SET_ID`,
  `CIRCLE_BLOCKCHAIN` — from step 3
- `DATABASE_URL` — from step 4
- `AUTH_SECRET` — generate: `openssl rand -base64 32`
- (optional) `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` — from step 5

The other Arc values (`ARC_RPC_URL`, `USDC_ADDRESS`, etc.) are already
correct as defaults.

---

## 7. Push schema & run

```bash
pnpm db:push    # creates `users` and `stamps` tables in TiDB
pnpm dev        # starts Next.js on http://localhost:3000
```

If `db:push` prompts about a schema rename or data loss, answer **No** —
the schema file is authoritative and there should be no ambiguity on a
fresh DB.

---

## 8. Demo walkthrough

Open http://localhost:3000 in **two separate browser profiles / incognito
windows** (so two sessions can be signed in simultaneously). Optionally
open a third for the judge role.

### Setup (pre-demo, ~3 minutes)

1. **Profile A**: Sign up handle `founder`, any password. This is the VIP
   recipient.
2. **Profile B**: Sign up handle `spammer`. This is the cold-outreach bot.
3. For each profile, after signup you land on `/inbox`. Click your wallet
   address in the header — it links to `testnet.arcscan.app`. Copy that
   address, go to https://faucet.circle.com, select Arc Testnet, fund each
   wallet with ~$5 USDC. (They need USDC for both gas and stakes.)

### Live demo (5–8 minutes, produces 50+ onchain tx)

1. **Profile A → `/inbox`**: empty. Share handle: "send stamped messages to
   `founder` to reach me."
2. **Profile B → `/compose`**: recipient=`founder`, preset stake = `$0.25`,
   subject = "Pitch: AI agent for dental clinics", body = anything
   legit-sounding. Click **Stake $0.25 and send**.
   - Watch the arcscan tx feed (open
     `https://testnet.arcscan.app/address/<founder-wallet>` in a tab) —
     two tx appear: `approve`, then `sendStamp`. **2 tx.**
3. **Profile A → `/inbox`**: message appears within ~4s (poll interval).
   Click it, click **Refund**. **1 tx.**
4. **Profile B → `/demo`**: target=`founder`, count=`25`, stake=`0.10`.
   Click **Fire 25 stamps**.
   - Running tally: this fires 25 × 2 = **50 tx**. The log panel streams
     completion; takes ~1–2 minutes total because Circle processes in
     series.
5. **Profile A → `/inbox`**: 25 new stamps. Click **AI triage (GLM)** —
   GLM 5.1 classifies each as legit/spam/unsure. Pills appear on each
   stamp.
6. **Profile A**: click **Select AI-spam**, then **Forfeit**. If you want
   to maximize tx count, instead click each message's row and forfeit
   individually (25 × 1 tx = **25 tx**). For a shorter demo, bulk forfeit
   collapses it into **1 tx**.
7. Show `testnet.arcscan.app`:
   - The `spammer` wallet balance dropped by ~$2.50 in stakes.
   - The `founder` wallet balance rose by ~$2.375 (95% of forfeits after
     the 5% protocol fee).
   - The `feeSink` address accumulated ~$0.125 in fees.
   - A dense cluster of tx in the last few minutes — **78 tx on the
     individual-triage path, 53 on the batch path. Both exceed the 50+
     hackathon requirement.**

### Talking points while the demo runs

- **"Stripe's minimum transaction fee is $0.30 — this entire business model
  is net-negative on traditional rails."**
- **"Ethereum mainnet gas alone would be $0.50–$3 per action, in ETH, with
  a second-long finality window — 10x the stake."**
- **"Arc settles in under a second, in USDC, at sub-cent gas. The unit
  economics only work because USDC is the native gas token on Arc."**
- The `protocolFeeBps = 500` (5%) means: at 10,000 daily stamps, 10% spam
  rate, $0.25 stake → **$12.50/day protocol revenue per 10k daily
  messages.**

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `POST /v1/w3s/developer/wallets 400` on signup | `CIRCLE_BLOCKCHAIN` mismatch (should be `ARC-TESTNET`) or Entity Secret ciphertext not registered | Re-register the Entity Secret ciphertext in the Circle console |
| `CIRCLE_API_KEY not set` | `.env` not loaded | `cp .env.example .env`, fill values, restart `pnpm dev` |
| Signup succeeds but compose says "no wallet provisioned" | Wallet creation silently failed | Navigate to `/onboard` and click **Retry wallet creation** |
| `Circle tx ... timed out` | Arc RPC hiccup or Circle processing slow | Retry the action; the DB row stays in `submitting` and will be reconciled |
| `db:push` prompts "data loss" | Schema drift | Drop the TiDB database (`DROP DATABASE stamp; CREATE DATABASE stamp;`) and re-run |
| `STAMP_ESCROW_ADDRESS is not set` | Forgot to paste deployed address | Update `.env` with the Remix-deployed address, restart |
| Sender sees `Insufficient balance` in Circle tx | Not enough USDC for gas+stake | Faucet more USDC at faucet.circle.com |

---

## 10. (Optional) Deploy to Vercel

```bash
pnpm build   # sanity check locally first
```

1. Push the branch to GitHub
2. Import the repo at https://vercel.com/new
3. Vercel auto-detects Next.js — no Root Directory tweak needed because
   the app lives at the repo root.
4. Add every variable from your `.env` as an environment variable in the
   Vercel project settings. Set `AUTH_TRUST_HOST=true` and
   `AUTH_URL=https://<your-app>.vercel.app`.
5. Deploy.

Caveat: the `/demo` spam-wave route runs serially through 25+ Circle
calls and exceeds Vercel's serverless function timeout (10s on Hobby,
60s on Pro). For the live demo, run locally with `pnpm dev`. Vercel
deploy is fine for everything else (signup, single-message send, triage,
inbox view).

Arc Testnet works identically from localhost and from Vercel — the RPC
is public. The only thing that changes is `AUTH_URL`.

---

## 11. After the demo

- Save screenshots of the arcscan tx list — submission evidence.
- Note the transaction count before/after the demo (use arcscan's
  per-address view) — this is your "50+ tx" proof.
- Fill out `FEEDBACK.md` with anything you hit that isn't already there —
  the feedback track is worth $500 USDC and rewards specificity.
