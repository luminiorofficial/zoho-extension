import { Pool } from "pg";

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
};

function createPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : false,

    // Your PostgreSQL server has a small connection limit.
    // Keep one reusable connection per Next.js instance.
    max: 1,

    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,

    application_name: "zoho-extension",
  });
}

export const db =
  globalForPg.pgPool ??
  createPool();

globalForPg.pgPool = db;

db.on("error", (error) => {
  console.error(
    "Unexpected PostgreSQL pool error:",
    error,
  );
});