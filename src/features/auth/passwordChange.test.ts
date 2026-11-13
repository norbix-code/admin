import { describe, expect, it } from 'vitest';
import {
  changePasswordErrorMessage,
  passwordChangeRequiredOf,
} from './passwordChange';

describe('passwordChangeRequiredOf (sign-in answer meta)', () => {
  it('is true when meta.passwordChangeRequired is "true"', () => {
    expect(
      passwordChangeRequiredOf({
        bearerToken: 't',
        meta: { credentialVersion: 'v1', passwordChangeRequired: 'true' },
      }),
    ).toBe(true);
  });

  it('is false when the key is absent, not "true", or there is no meta', () => {
    expect(
      passwordChangeRequiredOf({ meta: { credentialVersion: 'v1' } }),
    ).toBe(false);
    expect(
      passwordChangeRequiredOf({ meta: { passwordChangeRequired: 'false' } }),
    ).toBe(false);
    expect(passwordChangeRequiredOf({ bearerToken: 't' })).toBe(false);
    expect(passwordChangeRequiredOf(undefined)).toBe(false);
  });
});

describe('changePasswordErrorMessage (refused password change)', () => {
  const refused = (errorCode: string, message: string) => ({
    status: 400,
    data: { responseStatus: { errors: [{ errorCode, message }] } },
  });

  it('USERS-023 names the parts of the rule in plain words', () => {
    expect(
      changePasswordErrorMessage(
        refused(
          'CM-ERRORS-MEMBERSHIP-USERS-023',
          'Password does not meet complexity requirements: MinLength, MinUpper, MinSpecial',
        ),
      ),
    ).toBe(
      "The new password does not meet the project's password rules: it must be longer, have more uppercase letters, have more symbols.",
    );
  });

  it('USERS-023 without known rule names still says it is the rule', () => {
    expect(
      changePasswordErrorMessage(
        refused(
          'CM-ERRORS-MEMBERSHIP-USERS-023',
          'Password does not meet complexity requirements',
        ),
      ),
    ).toBe("The new password does not meet the project's password rules.");
  });

  it('USERS-024 means the current password is wrong (SDK error shape too)', () => {
    expect(
      changePasswordErrorMessage({
        code: 'CM-ERRORS-MEMBERSHIP-USERS-024',
        message: 'Email or current password is invalid',
      }),
    ).toBe('The current password is not right.');
  });

  it('429 and anything else get their own plain sentence', () => {
    expect(changePasswordErrorMessage({ status: 429 })).toBe(
      'Too many attempts. Please wait a while and try again.',
    );
    expect(changePasswordErrorMessage(new Error('boom'))).toBe(
      'Could not change the password. Please try again.',
    );
  });
});
