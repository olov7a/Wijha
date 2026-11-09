"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { mapAuthError } from "@/lib/auth/auth-errors";
import { getClientEmailRedirectTo } from "@/lib/auth/site-url";
import { getCooldownRemainingSeconds } from "@/lib/auth/resend-cooldown";
import { createClient } from "@/lib/supabase/client";

/**
 * "Resend confirmation email" with a 60-second cooldown. Used both on the
 * check-email screen and on login when the account exists but is unconfirmed.
 */
export function ResendConfirmationButton({ email, className }: { email: string; className?: string }) {
  const { t, locale } = useI18n();
  const configured = isSupabaseConfigured();
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Pure cooldown math lives in `lib/auth/resend-cooldown` so it can be
  // unit-tested; this effect only ticks the clock once per second.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = getCooldownRemainingSeconds(lastSentAt, now);

  const disabled = !configured || pending || remaining > 0;

  async function handleResend() {
    if (disabled) return;
    setPending(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: getClientEmailRedirectTo() },
      });
      if (error) {
        const mapped = mapAuthError(error, locale);
        setMessage({ kind: "error", text: mapped.message });
        if (mapped.code === "over_email_send_rate_limit") {
          // Back off immediately when the mail service says stop.
          setLastSentAt(Date.now());
        }
        return;
      }
      setLastSentAt(Date.now());
      setMessage({ kind: "success", text: t.auth.checkEmail.resendSent });
    } finally {
      setPending(false);
    }
  }

  const label = pending
    ? t.auth.checkEmail.resendSending
    : remaining > 0
      ? t.auth.checkEmail.resendCooldown.replace("{seconds}", String(remaining))
      : t.auth.checkEmail.resendButton;

  return (
    <div className={className}>
      <Button type="button" onClick={handleResend} disabled={disabled} className="w-full" aria-disabled={disabled}>
        {label}
      </Button>
      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={
            message.kind === "error"
              ? "mt-3 rounded-2xl bg-rejected-soft px-4 py-3 text-sm leading-6 text-rejected-ink"
              : "mt-3 rounded-2xl bg-approved-soft px-4 py-3 text-sm leading-6 text-approved-ink"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
