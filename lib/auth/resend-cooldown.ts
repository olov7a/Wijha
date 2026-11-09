/**
 * Resend cooldown for confirmation emails. Pure functions so the countdown
 * can be unit-tested without rendering React.
 */

export const RESEND_COOLDOWN_SECONDS = 60;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Timestamp (ms) at which the cooldown ends; `null` when never sent. */
export function getCooldownEndsAt(lastSentAtMs: number | null | undefined, cooldownSeconds = RESEND_COOLDOWN_SECONDS) {
  if (typeof lastSentAtMs !== "number" || !Number.isFinite(lastSentAtMs)) return null;
  return lastSentAtMs + cooldownSeconds * 1000;
}

/**
 * Whole seconds left before another resend is allowed (`0` = allowed now).
 * A `lastSentAtMs` in the future (clock skew) counts as the full cooldown.
 */
export function getCooldownRemainingSeconds(
  lastSentAtMs: number | null | undefined,
  nowMs: number,
  cooldownSeconds = RESEND_COOLDOWN_SECONDS,
) {
  const endsAt = getCooldownEndsAt(lastSentAtMs, cooldownSeconds);
  if (endsAt === null) return 0;
  const remaining = Math.ceil((endsAt - nowMs) / 1000);
  return clamp(remaining, 0, cooldownSeconds);
}

export function isResendAllowed(lastSentAtMs: number | null | undefined, nowMs: number, cooldownSeconds = RESEND_COOLDOWN_SECONDS) {
  return getCooldownRemainingSeconds(lastSentAtMs, nowMs, cooldownSeconds) <= 0;
}
