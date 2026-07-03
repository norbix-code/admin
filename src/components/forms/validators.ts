// Field-level validators for React Final Form.
//
// Ported from the Cloud app (`cloud/src/components/forms/validators.ts`) and
// trimmed to what the Admin portal needs. Each validator returns an error
// message string, or `undefined` when the value is valid — the contract
// react-final-form expects from a field-level validator.
//
// Compose several with `composeValidators(requiredValidator, emailValidator)`.

import type { PasswordPolicy } from '@/types/projectConfig';

export type FieldValidator<T = unknown> = (
  value: T | undefined,
) => string | undefined;

export const requiredValidator: FieldValidator<string> = (value) =>
  value ? undefined : 'Required';

/** Like `requiredValidator`, but whitespace-only values also fail. */
export const requiredTrimmedValidator: FieldValidator<string> = (value) =>
  value && value.trim() ? undefined : 'Required';

export const minLengthValidator =
  (minLength: number): FieldValidator<string> =>
  (value) =>
    value && value.length < minLength
      ? `Min length is ${minLength}`
      : undefined;

export const maxLengthValidator =
  (maxLength: number): FieldValidator<string> =>
  (value) =>
    value && value.length > maxLength
      ? `Max length is ${maxLength}`
      : undefined;

// Minimal, forgiving email check — the backend is the source of truth; this
// just stops an obviously-bad value before the round-trip.
export const emailValidator: FieldValidator<string> = (value) =>
  !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? undefined
    : 'Enter a valid email address.';

/**
 * Validates a password against the project's PasswordPolicy
 * (minLength / maxLength / minNumbers / minUpper / minLower / minSpecial).
 * Empty values pass — pair with `requiredValidator` when the field is
 * mandatory.
 */
export const passwordPolicyValidator =
  (policy: PasswordPolicy): FieldValidator<string> =>
  (value) => {
    if (!value) return undefined;
    if (policy.minLength && value.length < policy.minLength) {
      return `Minimum ${policy.minLength} characters`;
    }
    if (policy.maxLength && value.length > policy.maxLength) {
      return `Maximum ${policy.maxLength} characters`;
    }
    const count = (re: RegExp) => (value.match(re) ?? []).length;
    if (policy.minNumbers && count(/\d/g) < policy.minNumbers) {
      return `At least ${policy.minNumbers} number(s)`;
    }
    if (policy.minUpper && count(/[A-Z]/g) < policy.minUpper) {
      return `At least ${policy.minUpper} uppercase letter(s)`;
    }
    if (policy.minLower && count(/[a-z]/g) < policy.minLower) {
      return `At least ${policy.minLower} lowercase letter(s)`;
    }
    if (policy.minSpecial) {
      const special = policy.allowedSpecial
        ? new RegExp(
            `[${policy.allowedSpecial.replace(/[-[\]\\^]/g, '\\$&')}]`,
            'g',
          )
        : /[^a-zA-Z0-9]/g;
      if (count(special) < policy.minSpecial) {
        return `At least ${policy.minSpecial} special character(s)`;
      }
    }
    return undefined;
  };

/** Runs validators left to right; returns the first error found. */
export const composeValidators =
  (...validators: FieldValidator<never>[]): FieldValidator =>
  (value) =>
    validators.reduce<string | undefined>(
      (error, validator) => error || (validator as FieldValidator)(value),
      undefined,
    );
