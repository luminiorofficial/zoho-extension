import { Pool } from "pg";

const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
};

export const db =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : false,

    max: process.env.NODE_ENV === "production" ? 2 : 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

globalForPg.pgPool = db;
