import { parsePhoneNumberFromString, type PhoneNumber } from "libphonenumber-js";

/**
 * Single phone validation shared by client and server.
 * Egypt is the default country so `01012345678` is read as a local number,
 * and `+2010...` / `00201...` map to the same E.164.
 */

const AR_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};
const FA_DIGITS: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

function normalize(input: string): string {
  let value = input
    .replace(/[٠-٩]/g, (d) => AR_DIGITS[d] ?? d)
    .replace(/[۰-۹]/g, (d) => FA_DIGITS[d] ?? d)
    .replace(/[\s\-()]/g, "")
    .trim();

  // 00201... -> +201...
  if (value.startsWith("00")) {
    value = "+" + value.slice(2);
  }
  // Some users type the country code without plus: 2010...
  if (
    !value.startsWith("+") &&
    /^20\d{9,11}$/.test(value) &&
    value.startsWith("20")
  ) {
    value = "+" + value;
  }

  return value;
}

export type PhoneResult =
  | { ok: true; e164: string; national: string; country: string }
  | { ok: false };

export function parsePhone(raw: string | null | undefined): PhoneResult {
  if (!raw) return { ok: false };
  const cleaned = normalize(String(raw));
  if (!cleaned) return { ok: false };
  // Reject letters outright: libphonenumber would fail on them anyway, but
  // this gives a deterministic `false` for empty/invalid input.
  if (/[a-zA-Z]/.test(cleaned)) return { ok: false };

  let phone: PhoneNumber | undefined;
  try {
    phone = parsePhoneNumberFromString(cleaned, "EG");
  } catch {
    return { ok: false };
  }
  if (!phone || !phone.isValid()) return { ok: false };
  return {
    ok: true,
    e164: phone.number, // +201012345678
    national: phone.nationalNumber,
    country: phone.country ?? "EG",
  };
}

/** E.164 or null when invalid. */
export function toE164(raw: string | null | undefined): string | null {
  const result = parsePhone(raw);
  return result.ok ? result.e164 : null;
}

/** Zod refine helper: returns the error message key when invalid. */
export function isValidPhone(raw: string | unknown): boolean {
  if (typeof raw !== "string") return false;
  return parsePhone(raw.trim()).ok;
}
