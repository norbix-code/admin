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

// ---- Why a password change was refused ------------------------------------

/** Gateway error codes a password change can answer. */
const RULES_NOT_MET = 'CM-ERRORS-MEMBERSHIP-USERS-023';
const WRONG_CURRENT = 'CM-ERRORS-MEMBERSHIP-USERS-024';

/** The plain words for each rule name the gateway lists in USERS-023. */
const RULE_WORDS: Record<string, string> = {
  MinLength: 'be longer',
  MaxLength: 'be shorter',
  MinNumbers: 'have more numbers',
  MinUpper: 'have more uppercase letters',
  MinLower: 'have more lowercase letters',
  MinSpecial: 'have more symbols',
};

interface GatewayErrorShape {
  status?: unknown;
  code?: unknown;
  message?: unknown;
  fieldErrors?: { errorCode?: string; message?: string }[];
  raw?: { responseStatus?: ResponseStatusShape };
  data?: { responseStatus?: ResponseStatusShape };
}

interface ResponseStatusShape {
  errorCode?: string;
  message?: string;
  errors?: { errorCode?: string; message?: string }[];
}

/** Every (code, message) pair a failed call carries, in any of its shapes. */
function errorEntries(err: unknown): { code?: string; message?: string }[] {
  if (!err || typeof err !== 'object') return [];
  const e = err as GatewayErrorShape;
  const fromStatus = (rs?: ResponseStatusShape) => [
    ...(rs?.errors ?? []).map((x) => ({
      code: x.errorCode,
      message: x.message,
    })),
    { code: rs?.errorCode, message: rs?.message },
  ];
  return [
    ...(e.fieldErrors ?? []).map((x) => ({
      code: x.errorCode,
      message: x.message,
    })),
    ...fromStatus(e.raw?.responseStatus),
    ...fromStatus(e.data?.responseStatus),
    {
      code: typeof e.code === 'string' ? e.code : undefined,
      message: typeof e.message === 'string' ? e.message : undefined,
    },
  ];
}

/**
 * The plain message for a refused password change (the change-password step
 * after sign-in and the Security card). The gateway knows the project's
 * stored rule even when the portal was not given it, so its answer is the
 * source of truth: USERS-023 names the parts of the rule the new password
 * breaks ("…: MinLength, MinNumbers"), USERS-024 means the current password
 * is wrong.
 */
export function changePasswordErrorMessage(err: unknown): string {
  if ((err as { status?: unknown } | null)?.status === 429) {
    return 'Too many attempts. Please wait a while and try again.';
  }
  const entries = errorEntries(err);
  const rules = entries.find((x) => x.code === RULES_NOT_MET);
  if (rules) {
    const names = (rules.message ?? '')
      .split(':')
      .slice(1)
      .join(':')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s in RULE_WORDS);
    const words = [...new Set(names.map((n) => RULE_WORDS[n]))];
    return words.length > 0
      ? `The new password does not meet the project's password rules: it must ${words.join(', ')}.`
      : "The new password does not meet the project's password rules.";
  }
  if (entries.some((x) => x.code === WRONG_CURRENT)) {
    return 'The current password is not right.';
  }
  return 'Could not change the password. Please try again.';
}

/** The hint under "New password" when the portal does not know the rule. */
export const PASSWORD_RULES_UNKNOWN_HINT =
  "Use a password that meets the project's password rules.";
