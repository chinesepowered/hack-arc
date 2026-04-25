// Creates the `stamp` database on the TiDB cluster pointed to by DATABASE_URL.
//
// Run with:  pnpm db:create
// Requires:  DATABASE_URL in .env

import "dotenv/config";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set in .env");
  process.exit(1);
}

const parsed = new URL(url);
const dbName = parsed.pathname.replace(/^\//, "");
if (!dbName) {
  console.error("DATABASE_URL has no database name in its path");
  process.exit(1);
}

// Parse the ?ssl=... query param the same way Drizzle/mysql2 do.
let ssl;
const sslParam = parsed.searchParams.get("ssl");
if (sslParam) {
  try {
    ssl = JSON.parse(sslParam);
  } catch {
    ssl = { rejectUnauthorized: true };
  }
} else if (parsed.hostname.endsWith("tidbcloud.com")) {
  ssl = { rejectUnauthorized: true };
}

console.log(`Connecting to ${parsed.hostname}:${parsed.port || 4000} as ${decodeURIComponent(parsed.username)}...`);

const conn = await mysql.createConnection({
  host: parsed.hostname,
  port: parsed.port ? Number(parsed.port) : 4000,
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  ssl,
  // No `database` — we're about to create it.
});

console.log(`Creating database \`${dbName}\` if it doesn't exist...`);
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

const [rows] = await conn.query("SHOW DATABASES");
const exists = rows.some((r) => Object.values(r)[0] === dbName);

await conn.end();

if (exists) {
  console.log(`✔ Database \`${dbName}\` is ready.`);
  console.log("");
  console.log("Next: pnpm db:push");
} else {
  console.error(`Database \`${dbName}\` was not created — check TiDB permissions.`);
  process.exit(1);
}
