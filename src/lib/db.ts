import "server-only";

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

export function isDatabaseEnabled(): boolean {
  return Boolean(DATABASE_URL);
}

export function sql<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  if (!DATABASE_URL) {
    throw new Error("Database is not configured. Set POSTGRES_URL (or DATABASE_URL).");
  }
  const client = neon(DATABASE_URL);
  return client(strings, ...values) as Promise<T[]>;
}

