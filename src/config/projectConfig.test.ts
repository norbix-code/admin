import { describe, expect, it } from 'vitest';
import { DEFAULT_PASSWORD_POLICY } from './projectConfig';

describe('default password policy (project does not expose its auth detail)', () => {
  it('is the Membership default rule: at least 6 characters, nothing else', () => {
    expect(DEFAULT_PASSWORD_POLICY).toEqual({ minLength: 6 });
  });
});
