import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = ReturnType<typeof createDatabase>;

const globalForDb = globalThis as unknown as { pixelcraftDb?: Database };

function createDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }
  const client = postgres(url, {
    prepare: false,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
  });
  return drizzle(client, { schema });
}

/**
 * Lazily opens the Postgres pool, so builds without a database still work.
 */
export function getDb(): Database {
  if (!globalForDb.pixelcraftDb) {
    globalForDb.pixelcraftDb = createDatabase();
  }
  return globalForDb.pixelcraftDb;
}

export { schema };
