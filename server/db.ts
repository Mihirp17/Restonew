import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Optimized connection configuration
const connectionConfig = {
  max: 20, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout
  ssl: process.env.NODE_ENV === "production" 
    ? { rejectUnauthorized: true } 
    : { rejectUnauthorized: false },
  // Performance optimizations
  prepare: true, // Enable prepared statements
  max_lifetime: 60 * 30, // Close connections after 30 minutes
  // Connection health checks
  onnotice: () => {}, // Suppress notice messages
  onparameter: () => {}, // Suppress parameter messages
};

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString, connectionConfig);

// Create drizzle instance with optimized settings
export const db = drizzle(client, { 
  schema,
  logger: process.env.NODE_ENV === 'development'
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  await client.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database connections...');
  await client.end();
  process.exit(0);
});

// Health check function
export const checkDatabaseHealth = async () => {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
};
