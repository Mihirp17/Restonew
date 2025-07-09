import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  schema: './shared/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: (() => {
      const envUrl = process.env.DATABASE_URL ?? '';
      if (envUrl && !envUrl.includes('sslmode')) {
        return envUrl.includes('?') ? `${envUrl}&sslmode=require` : `${envUrl}?sslmode=require`;
      }
      return envUrl || 'postgres://postgres.rpggtsdclokdbobydkcx:7wY9GTjgD7bp1NMB@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x';
    })(),
    ssl: {
      rejectUnauthorized: false
    }
  },
});
