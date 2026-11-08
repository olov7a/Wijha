import type { ErrorCode } from "@/lib/errors";

/**
 * Every server action returns this shape. `E` lets a feature narrow the error
 * codes it can produce while still defaulting to the shared set.
 */
export type Result<T, E extends string = ErrorCode> =
  | { ok: true; data: T }
  | { ok: false; error: E };
