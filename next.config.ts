import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";
const isDev = process.env.NODE_ENV !== "production";

// Cloudflare Turnstile loads its script and renders its challenge in an iframe,
// so both origins must be allowed or the CAPTCHA silently fails to render.
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

// Next/React needs 'unsafe-eval' in development for debugging. Never add it to production.
const scriptSrc = isDev
  ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${TURNSTILE_ORIGIN}`
  : `script-src 'self' 'unsafe-inline' ${TURNSTILE_ORIGIN}`;

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseUrl} https://*.supabase.co`,
  `connect-src 'self' ${supabaseUrl} wss://*.supabase.co ${TURNSTILE_ORIGIN}`,
  "font-src 'self' data:",
  `frame-src ${TURNSTILE_ORIGIN}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
  ...(process.env.NEXT_PUBLIC_APP_ENV === "staging"
    ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
