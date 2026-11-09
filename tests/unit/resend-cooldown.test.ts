import { describe, it, expect } from "vitest";
import {
  RESEND_COOLDOWN_SECONDS,
  getCooldownEndsAt,
  getCooldownRemainingSeconds,
  isResendAllowed,
} from "@/lib/auth/resend-cooldown";

const SENT = 1_000_000;

describe("resend cooldown", () => {
  it("defaults to a 60-second cooldown", () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
  });

  it("never sent -> allowed immediately", () => {
    expect(getCooldownRemainingSeconds(null, SENT)).toBe(0);
    expect(getCooldownRemainingSeconds(undefined, SENT)).toBe(0);
    expect(isResendAllowed(null, SENT)).toBe(true);
    expect(getCooldownEndsAt(null)).toBeNull();
  });

  it("just sent -> full cooldown remains, resend blocked", () => {
    expect(getCooldownRemainingSeconds(SENT, SENT)).toBe(60);
    expect(isResendAllowed(SENT, SENT)).toBe(false);
    expect(getCooldownEndsAt(SENT)).toBe(SENT + 60_000);
  });

  it("30 seconds later -> 30 seconds remain", () => {
    expect(getCooldownRemainingSeconds(SENT, SENT + 30_000)).toBe(30);
    expect(isResendAllowed(SENT, SENT + 30_000)).toBe(false);
  });

  it("1 second before expiry -> still blocked with 1 second left", () => {
    expect(getCooldownRemainingSeconds(SENT, SENT + 59_000)).toBe(1);
    expect(isResendAllowed(SENT, SENT + 59_000)).toBe(false);
  });

  it("exactly 60 seconds later -> allowed again", () => {
    expect(getCooldownRemainingSeconds(SENT, SENT + 60_000)).toBe(0);
    expect(isResendAllowed(SENT, SENT + 60_000)).toBe(true);
  });

  it("long after -> clamped to 0, never negative", () => {
    expect(getCooldownRemainingSeconds(SENT, SENT + 5 * 60_000)).toBe(0);
  });

  it("clock skew (sent in the future) -> full cooldown, never negative", () => {
    expect(getCooldownRemainingSeconds(SENT + 10_000, SENT)).toBe(60);
  });

  it("honours a custom cooldown window", () => {
    expect(getCooldownRemainingSeconds(SENT, SENT + 10_000, 30)).toBe(20);
    expect(isResendAllowed(SENT, SENT + 30_000, 30)).toBe(true);
  });
});
