# 📬 Stamp — your inbox, finally worth opening

**Strangers stake real money to reach you. Legit messages get their stake back. Spammers fund your coffee.**

Stamp turns the most abused channel on the internet — your inbox — into a tiny marketplace for your attention. Every cold message arrives with a **refundable USDC stake** attached. You decide if it was worth your time.

---

## 💡 The idea in one sentence

> If a stranger really wants you to read this, they can put a quarter on it.

A spammer can't afford to do that 10,000 times. A real founder pitching you, a recruiter with a real role, a customer with a real complaint? They'll happily stake $0.25 to skip the noise — and get every cent back the moment you tap **Refund**.

---

## 🪤 Why your inbox is broken

📨 **The asymmetry**: It costs a spammer $0.0001 to send you a message. It costs *you* 30 seconds to triage it. Multiply by 50 a day. The economics force you to either drown or build aggressive filters that bury the real signal.

🔕 **What we tried**: Spam filters (false positives), unsubscribe links (ignored), CAPTCHA gates (insulting to humans), priority inbox AI (still has to read everything first).

💰 **What actually works**: Make the sender put up collateral. Real intent has skin. Spam doesn't.

This idea isn't new — it was proposed in **1997 as "hashcash"** (proof-of-work postage). It never shipped because the rails to move 25¢ at near-zero cost simply didn't exist. **Now they do.** That's the entire thesis.

---

## ✨ How it feels to use

**As a sender** ✉️
1. Sign up. A USDC wallet is created for you instantly — no seed phrase, no extension, no MetaMask popup.
2. Compose. Pay a $0.25 stamp.
3. Get refunded the second the recipient confirms you weren't wasting their time.

**As a recipient** 👀
1. Your inbox shows only stamped messages — every one is worth at least 25¢ of someone's belief that you'll care.
2. **AI triage** sorts the obvious spam in one tap.
3. **Refund** the keepers. **Forfeit** the spam — that money is now yours.

**As a spammer** 🚫
You don't.

---

## 🎯 Who actually wants this

- 👩‍💼 **Founders & investors** — every "quick 15-min call?" comes with proof of intent. Sort inbox by stake size.
- 📰 **Journalists & researchers** — the tip line that filters itself.
- 🛠️ **Open-source maintainers** — "please review my PR" backed by a token of respect, not entitlement.
- 🤝 **Recruiters & candidates** — both sides demonstrate seriousness in a market full of noise.
- 🤖 **AI agents** — when bots email other bots' humans at scale, stamps become the protocol-level rate limit. (See *Agent-to-agent* below.)

---

## 💸 The business

Stamp keeps **5%** of every forfeited message — the protocol's only fee. There is no subscription, no per-seat pricing, no SaaS dashboard.

**Worked example**: 10,000 messages a day. 10% are spam → forfeited at $0.25 each. Stamp earns **$12.50/day per 10k daily messages**. Linear with usage. Zero customer acquisition cost on the spammer side — they pay for the privilege of being filtered out.

**Margin math** 📊:

| Rail | Cost to move $0.25 | Verdict |
|---|---|---|
| 💳 Stripe | $0.31 fee | ❌ -24% |
| ⛓️ Ethereum L1 | $0.50–$3 in ETH gas | ❌ -200%+ |
| 🦊 Most L2s | $0.02–$0.20, paid in ETH | ⚠️ marginal + UX hell |
| 🟦 **Arc + USDC nanopayments** | **sub-cent, paid in USDC** | ✅ **viable** |

Stamp isn't a clever payments app. **It's the first product where the economics only close because of Arc.** Sub-cent settlement and USDC-as-gas are the load-bearing assumptions — without them this entire category dies in the prototype phase like it has every other time someone tried it since 1997.

---

## 🤖 The agent angle

The same escrow primitive solves a problem that's about to get much worse: **AI agents emailing humans on behalf of other AI agents**. The volume curve is going vertical. Every existing anti-spam mechanism is built around "is this a human?" — useless when 95% of senders are legitimately authorized agents.

Stamp doesn't ask *what* sent the message. It asks *what is it worth to you that I read it?* Agents bid for attention with their principals' USDC. The recipient — human or agent — keeps what wasn't worth reading.

This is what an **agentic economy** actually looks like: programmable wallets, programmable money, programmable consent. All settled per-message, on-chain, in real time.

---

## 🛠️ Built on

- ⛓️ **Arc Testnet** — sub-cent gas, USDC-native settlement
- 🟦 **USDC** — the unit of account, the unit of stake, *and* the unit of gas
- 🔐 **Circle Developer-Controlled Wallets** — every user gets a real wallet on signup, no seed phrase, no extension
- ⚡ **Circle Nanopayments** — what makes a 25¢ atomic transfer economically rational
- 📜 **`StampEscrow.sol`** — ~150 lines of audited-pattern Solidity (OpenZeppelin v5, ReentrancyGuard, SafeERC20). Approve → stake → refund or forfeit. That's it.
- 🧠 **GLM 5.1** — pre-classifies inbound stamps so you triage 25 messages in 5 seconds instead of 5 minutes
- 🚀 **Next.js 16 + React 19** — full-stack TypeScript, deployed in one click

---

## 🔭 What's next

- 🏆 **Reputation (ERC-8004)** — senders build a public refund rate. Sort your inbox by *trustworthiness × stake*.
- 💬 **Reply-pricing (x402)** — bill senders for a written response, not just a read.
- 📥 **Agent inbox MCP** — let autonomous agents triage stamped inbounds on your behalf.
- 🧱 **Anti-griefing** — per-recipient daily caps, per-sender cooldowns, all enforced on-chain.
- 🌐 **Open recipient registry** — point any wallet at `stamp.gg/<handle>` and start receiving.

---

## 🚦 Try it

```bash
pnpm install
pnpm db:create && pnpm db:push
pnpm dev
```

Open http://localhost:3000, sign up, and send your first stamp. (Full setup details in [`deploy.md`](./deploy.md).)

---

## 📨 The tagline

> **Every message in your inbox is worth at least a quarter — or it isn't there.**
