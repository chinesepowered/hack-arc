// Creates a Circle Wallet Set and prints its id.
//
// Run with:  pnpm circle:create-wallet-set [name]
// Requires:  CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env

import "dotenv/config";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

if (!apiKey) {
  console.error("CIRCLE_API_KEY is not set in .env");
  process.exit(1);
}
if (!entitySecret) {
  console.error("CIRCLE_ENTITY_SECRET is not set in .env (run pnpm circle:register-entity first)");
  process.exit(1);
}

const name = process.argv[2] ?? "stamp-hackathon";

const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

console.log(`Creating wallet set "${name}"...`);

const response = await client.createWalletSet({ name });
const walletSet = response.data?.walletSet;

if (!walletSet?.id) {
  console.error("No walletSet.id in response:", JSON.stringify(response, null, 2));
  process.exit(1);
}

console.log("");
console.log("✔ Wallet set created.");
console.log("");
console.log(`  CIRCLE_WALLET_SET_ID=${walletSet.id}`);
console.log("");
console.log("Paste that line into .env, then continue with deploy.md step 4 (TiDB).");
