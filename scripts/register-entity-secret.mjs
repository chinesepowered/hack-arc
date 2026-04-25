// Generates a fresh Entity Secret, registers its ciphertext with Circle,
// saves the recovery file, and prints the plaintext for your .env.
//
// Run with:  node scripts/register-entity-secret.mjs
// Requires:  CIRCLE_API_KEY in .env (the test API key from console.circle.com)

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";

const apiKey = process.env.CIRCLE_API_KEY;
if (!apiKey) {
  console.error("CIRCLE_API_KEY is not set in .env");
  process.exit(1);
}

const entitySecret = randomBytes(32).toString("hex");

console.log("Generated Entity Secret (save this):");
console.log("");
console.log(`  CIRCLE_ENTITY_SECRET=${entitySecret}`);
console.log("");
console.log("Registering ciphertext with Circle...");

const response = await registerEntitySecretCiphertext({
  apiKey,
  entitySecret,
  // SDK requires a DIRECTORY here (not a file). It writes the recovery
  // file inside, named with its own scheme. KEEP IT SAFE — it's how you
  // reset the Entity Secret if you lose the plaintext.
  recoveryFileDownloadPath: "./",
});

console.log("✔ Registered.");
console.log("✔ Recovery file saved to ./ (look for *.dat next to package.json)");
console.log("");
console.log("Next steps:");
console.log("  1. Paste the CIRCLE_ENTITY_SECRET line above into .env");
console.log("  2. Move circle-recovery.dat somewhere safe (NOT git)");
console.log("  3. Continue with deploy.md step 3c (Wallet Set)");

// Also persist a copy of the registration response to disk for debugging.
writeFileSync(
  "./circle-entity-secret-registration.json",
  JSON.stringify(response.data ?? response, null, 2)
);
