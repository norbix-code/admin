// A project password sign-in still succeeds when the typed password breaks the
// project's current password rules (the rules got stricter after the password
// was set). The gateway then says so in the answer's `meta` — a string map —
// as `passwordChangeRequired: "true"`; the key is absent otherwise.

/** True when a sign-in answer asks the user to choose a new password. */
export function passwordChangeRequiredOf(answer: unknown): boolean {
  if (!answer || typeof answer !== 'object') return false;
  const meta = (answer as { meta?: unknown }).meta;
  if (!meta || typeof meta !== 'object') return false;
  return (meta as Record<string, unknown>)['passwordChangeRequired'] === 'true';
}

/**
 * What the sign-in screen hands the change-password step (router state). The
 * user name lets the step sign in again with the new password: a password
 * change ends every older session (the gateway refuses a token signed in with
 * the previous credential version).
 */
export interface PasswordChangeState {
  required: true;
  userName: string;
}

export const PASSWORD_CHANGE_REASON =
  "Your password does not meet the project's password rules any more. Please choose a new one.";
