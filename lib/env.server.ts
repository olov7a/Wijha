import "server-only";

import { z } from "zod";

/**
 * Server-only secrets. Importing this module from a Client Component makes the
 * build fail on purpose, so SUPABASE_SERVICE_ROLE_KEY can never leak to the
 * browser.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /** Optional bootstrap code: required to claim the first admin. Server-only. */
  BOOTSTRAP_ADMIN_SECRET: z.string().min(8).optional(),
  /** Optional cron secret: required to call expiry jobs. Server-only. */
  CRON_SECRET: z.string().min(16).optional(),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;

/**
 * Parse lazily: the key is only required by the few server paths that truly
 * need it, so builds and public pages keep working without it.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    BOOTSTRAP_ADMIN_SECRET: process.env.BOOTSTRAP_ADMIN_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
  });

  if (!parsed.success) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

/** Bootstrap code or null when it was never configured (fail-closed). */
export function getBootstrapSecret(): string | null {
  try {
    return getServerEnv().BOOTSTRAP_ADMIN_SECRET ?? null;
  } catch {
    return null;
  }
}
