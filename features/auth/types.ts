/** Shape returned by the auth server actions and consumed by `useActionState`. */
export type AuthState = {
  error?: string;
  success?: string;
  /** Field-level errors shown under each input (field name -> message). */
  fieldErrors?: Record<string, string>;
  /** Internal Supabase error code (from the central mapper), never raw SDK text. */
  errorCode?: string;
  /** Email the action was attempted with, so login can offer a resend. */
  email?: string;
  /** True when the user should be offered a confirmation-email resend. */
  needsResend?: boolean;
};
