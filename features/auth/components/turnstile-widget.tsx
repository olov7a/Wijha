"use client";

import { useEffect, useRef } from "react";
import { env } from "@/lib/env";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileLoader: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (turnstileLoader) return turnstileLoader;

  turnstileLoader = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");

    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("turnstile failed to load")), { once: true });

    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

  return turnstileLoader;
}

/**
 * Cloudflare Turnstile widget (Supabase CAPTCHA provider).
 *
 * Renders nothing until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, so local
 * development keeps working. `resetKey` resets the widget after a failed auth
 * attempt: Turnstile tokens are single-use and Supabase rejects a re-used one.
 */
export function TurnstileWidget({
  onToken,
  resetKey = 0,
}: {
  onToken: (token: string | null) => void;
  resetKey?: number;
}) {
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const holderRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<string | null>(null);
  const callbackRef = useRef(onToken);

  useEffect(() => {
    callbackRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !window.turnstile || !holderRef.current || widgetRef.current) return;
        widgetRef.current = window.turnstile.render(holderRef.current, {
          sitekey: siteKey,
          theme: "auto",
          callback: (token) => callbackRef.current(token),
          "expired-callback": () => callbackRef.current(null),
          "error-callback": () => callbackRef.current(null),
        });
      })
      .catch(() => callbackRef.current(null));

    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) {
        window.turnstile.remove(widgetRef.current);
        widgetRef.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (!resetKey) return;
    callbackRef.current(null);
    if (widgetRef.current && window.turnstile) {
      window.turnstile.reset(widgetRef.current);
    }
  }, [resetKey]);

  // Turnstile tokens are single-use, so reset after every form submission to
  // leave a fresh one ready for a retry. The timeout lets the browser capture
  // the submitted value first.
  useEffect(() => {
    const form = holderRef.current?.closest("form");
    if (!form || !siteKey) return;

    function handleSubmit() {
      window.setTimeout(() => {
        callbackRef.current(null);
        if (widgetRef.current && window.turnstile) {
          window.turnstile.reset(widgetRef.current);
        }
      }, 0);
    }

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [siteKey]);

  if (!siteKey) return null;

  return <div ref={holderRef} className="min-h-[65px]" data-testid="turnstile" />;
}
