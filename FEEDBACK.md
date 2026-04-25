# Feedback for Circle — Agentic Economy on Arc hackathon

## What worked

- **USDC-as-gas is a genuinely new DX.** Not having to think in two
  currencies (ETH for gas + USDC for value) removes an entire class of
  onboarding questions and makes "app wallet only holds USDC" finally viable.
- **Developer-Controlled Wallets** let us skip MetaMask entirely. A user
  signs up with a handle+password and has an Arc wallet one API call later.
  This is exactly the UX ceiling we need to hit for non-crypto consumers.
- Arc testnet RPC was stable throughout our build; sub-second finality is
  real and makes the "fire 15 stamps, see them all appear" demo feel
  instant.

## Friction we hit

- **Entity Secret ciphertext flow** is non-obvious. Documentation could
  include a copy-pasteable Node/Python snippet for the RSA-OAEP encryption
  that happens on every Entity-Secret-gated call. Our working version is in
  `src/lib/circle.ts`.
- **Circle blockchain identifier for Arc testnet**: we couldn't find a
  definitive string (we used `EVM-TESTNET`). A canonical table on
  developers.circle.com → Arc page would save hours.
- **Nanopayments / x402 on Arc**: we ended up implementing our own
  escrow contract because we couldn't locate a public x402 facilitator for
  Arc testnet. Having a Circle-hosted facilitator documented in the Arc
  quickstart would let teams skip custody design entirely.
- **Faucet UX**: users need both gas and stake-capable USDC. Because USDC
  is both, this is fine in practice, but the distinction (gas vs balance)
  is confusing in docs that still mention "gas tokens" generically.
- **Circle wallet balance endpoint** returns decimal strings for USDC
  amounts — safer to return base units as a bigint-compatible string so
  integrators don't lose precision.

## Things we'd pay for

- A **webhook** from Circle when a contractExecution confirms onchain
  (currently we poll `/transactions/:id`). This would eliminate the
  polling loop in our send/triage flows.
- **Fee sponsoring / gasless submitter** for Developer-Controlled
  Wallets so the app can pay gas on behalf of a recipient-triaging-spam
  flow where the recipient has 0 USDC balance.
- **Native ERC-8004 registry address** on Arc testnet so agent-reputation
  apps don't each deploy their own.

## Ideas for the Arc roadmap

- A first-class **subgraph-equivalent** (hosted indexer) for Arc testnet so
  teams don't have to run their own event pollers.
- **x402 facilitator SaaS tier** with a free quota — would remove the last
  excuse for an indie team to ship a pay-per-request API.
- **SDK that unifies** Circle Wallets + Viem reads + receipt parsing into a
  single "call contract, get receipt" method. We wrote ~150 lines to
  assemble this plumbing in `stamp.ts` that should be 3 lines of SDK.
