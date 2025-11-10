import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

export default {
  schema: './lib/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config;

