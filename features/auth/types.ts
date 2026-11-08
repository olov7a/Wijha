/** Shape returned by the auth server actions and consumed by `useActionState`. */
export type AuthState = {
  error?: string;
  success?: string;
};
