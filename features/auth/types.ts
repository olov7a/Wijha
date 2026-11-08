/** Shape returned by the auth server actions and consumed by `useActionState`. */
export type AuthState = {
  error?: string;
  success?: string;
  /** Field-level errors shown under each input (field name -> message). */
  fieldErrors?: Record<string, string>;
};
