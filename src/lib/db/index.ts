import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __pool: mysql.Pool | undefined;
}

function buildPool(): mysql.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return mysql.createPool({
    uri: url,
    connectionLimit: 5,
    waitForConnections: true,
    // TiDB Cloud Serverless requires TLS; the `ssl` query param in the URL
    // is honored by mysql2, so we don't need to hard-code it here.
  });
}

const pool = globalThis.__pool ?? buildPool();
if (process.env.NODE_ENV !== "production") globalThis.__pool = pool;

export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
