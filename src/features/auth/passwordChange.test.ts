import { describe, expect, it } from 'vitest';
import { passwordChangeRequiredOf } from './passwordChange';

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
