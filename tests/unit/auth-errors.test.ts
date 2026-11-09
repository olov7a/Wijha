import { describe, it, expect } from "vitest";
import { mapAuthError } from "@/lib/auth/auth-errors";
import { getDictionary } from "@/lib/i18n/dictionary";

const RAW = "RAW-SDK-SECRET-MESSAGE";

describe("mapAuthError — code mapping (never shows raw text)", () => {
  it("over_email_send_rate_limit -> email rate limit (both locales)", () => {
    for (const locale of ["ar", "en"] as const) {
      const mapped = mapAuthError({ code: "over_email_send_rate_limit", message: RAW }, locale);
      expect(mapped.message).toBe(getDictionary(locale).auth.errors.emailRateLimit);
      expect(mapped.code).toBe("over_email_send_rate_limit");
      expect(mapped.needsResend).toBe(false);
      expect(mapped.message).not.toContain(RAW);
    }
  });

  it("email_address_not_authorized -> friendly unauthorized message", () => {
    const mapped = mapAuthError({ code: "email_address_not_authorized", message: RAW }, "en");
    expect(mapped.message).toBe(getDictionary("en").auth.errors.emailNotAuthorized);
    expect(mapped.message).not.toContain(RAW);
  });

  it("user_already_exists -> already exists message", () => {
    const mapped = mapAuthError({ code: "user_already_exists", message: RAW }, "en");
    expect(mapped.message).toBe(getDictionary("en").auth.errors.userAlreadyExists);
    expect(mapped.message).not.toContain(RAW);
  });

  it("invalid_credentials -> invalid credentials message", () => {
    const mapped = mapAuthError({ code: "invalid_credentials", message: RAW }, "en");
    expect(mapped.message).toBe(getDictionary("en").auth.errors.invalidCredentials);
    expect(mapped.needsResend).toBe(false);
  });

  it("email_not_confirmed -> needsResend = true so login can offer Resend", () => {
    const mapped = mapAuthError({ code: "email_not_confirmed", message: RAW }, "en");
    expect(mapped.message).toBe(getDictionary("en").auth.errors.emailNotConfirmed);
    expect(mapped.needsResend).toBe(true);
    expect(mapped.message).not.toContain(RAW);
  });

  it("weak_password -> weak password message", () => {
    const mapped = mapAuthError({ code: "weak_password", message: RAW }, "en");
    expect(mapped.message).toBe(getDictionary("en").auth.errors.weakPassword);
    expect(mapped.message).not.toContain(RAW);
  });

  it("email_address_invalid -> invalid email message", () => {
    const mapped = mapAuthError({ code: "email_address_invalid", message: RAW }, "en");
    expect(mapped.message).toBe(getDictionary("en").auth.errors.invalidEmail);
  });
});

describe("mapAuthError — message-substring fallback (old SDKs without `code`)", () => {
  it("matches 'User already registered' by message", () => {
    const mapped = mapAuthError({ message: "User already registered" }, "en");
    expect(mapped.code).toBe("user_already_exists");
  });

  it("matches 'Invalid login credentials' by message", () => {
    const mapped = mapAuthError({ message: "Invalid login credentials" }, "en");
    expect(mapped.code).toBe("invalid_credentials");
  });

  it("matches 'Email not confirmed' by message and flags needsResend", () => {
    const mapped = mapAuthError({ message: "Email not confirmed" }, "en");
    expect(mapped.code).toBe("email_not_confirmed");
    expect(mapped.needsResend).toBe(true);
  });
});

describe("mapAuthError — generic fallback", () => {
  it("unknown code -> generic, never leaks the raw message", () => {
    const mapped = mapAuthError({ code: "some_new_code", message: RAW }, "en");
    expect(mapped.code).toBe("generic");
    expect(mapped.message).toBe(getDictionary("en").auth.errors.generic);
    expect(mapped.message).not.toContain(RAW);
    expect(mapped.needsResend).toBe(false);
  });

  it("null / undefined -> generic", () => {
    expect(mapAuthError(null, "ar").code).toBe("generic");
    expect(mapAuthError(undefined, "ar").code).toBe("generic");
    expect(mapAuthError(null, "ar").message).toBe(getDictionary("ar").auth.errors.generic);
  });
});
