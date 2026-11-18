import "server-only"

import { attachDatabasePool } from "@vercel/functions"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

const globalForDatabase = globalThis as typeof globalThis & {
  epicLiDatabasePool?: Pool
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured")
}

export const pool =
  globalForDatabase.epicLiDatabasePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  })

if (!globalForDatabase.epicLiDatabasePool) {
  globalForDatabase.epicLiDatabasePool = pool
  attachDatabasePool(pool)
}

export const db = drizzle(pool, { schema })
