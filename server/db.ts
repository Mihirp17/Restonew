import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// In production, use strict SSL (rejectUnauthorized: true) so that self-signed certs are not accepted.
// In development, we disable strict SSL checks (rejectUnauthorized: false) for convenience.
const sslConfig = (process.env.NODE_ENV === "production") ? { ssl: { rejectUnauthorized: true } } : { ssl: { rejectUnauthorized: false } };

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString, sslConfig);
export const db = drizzle(client, { schema });
