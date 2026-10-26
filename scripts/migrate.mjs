import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set, skipping migrations.");
  process.exit(process.env.VERCEL ? 1 : 0);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  await migrate(drizzle(client), { migrationsFolder: path.join(here, "..", "drizzle") });
  console.log("Database is up to date.");
} catch (error) {
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  await client.end();
}
