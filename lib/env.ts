import { z } from "zod";

/**
 * Public environment shared by the browser and the server.
 * Only values prefixed with NEXT_PUBLIC_ may live here: they are bundled into
 * the client, so they must never contain secrets.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

function emptyToUndefined(value: string | undefined) {
  return value && value.length > 0 ? value : undefined;
}

/**
 * Read every variable explicitly so Next.js can inline the NEXT_PUBLIC_ values
 * at build time. Passing the whole `process.env` object would break that.
 */
const parsedPublicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: emptyToUndefined(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  NEXT_PUBLIC_SITE_URL: emptyToUndefined(process.env.NEXT_PUBLIC_SITE_URL),
});

export const env = parsedPublicEnv;

/**
 * Auth can be disabled locally while the UI is still being built. Callers use
 * this to render a "not configured" state instead of crashing.
 */
export function isSupabaseConfigured() {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function requireSupabaseConfig() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase environment variables are not configured");
  }

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}
