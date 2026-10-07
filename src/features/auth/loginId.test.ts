import { describe, it, expect } from 'vitest';
import { loginIdFromToken, resolveLoginId } from './loginId';

// A JWT with the given payload (header and signature do not matter here).
function jwt(payload: Record<string, unknown>): string {
  const b64url = (o: unknown) =>
    btoa(JSON.stringify(o))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;
}

describe('loginIdFromToken', () => {
  it('reads the usr_ id from the cm_auth_id claim, not the numeric sub', () => {
    const token = jwt({ sub: '2', cm_auth_id: 'usr_5R4dlqJeXx943tOzSDEwbS' });
    expect(loginIdFromToken(token)).toBe('usr_5R4dlqJeXx943tOzSDEwbS');
  });

  it('returns null when the claim is missing or not a usr_ id', () => {
    expect(loginIdFromToken(jwt({ sub: '2' }))).toBeNull();
    expect(loginIdFromToken(jwt({ cm_auth_id: '2' }))).toBeNull();
  });

  it('returns null for a token that is not a JWT', () => {
    expect(loginIdFromToken('not-a-jwt')).toBeNull();
    expect(loginIdFromToken('a.%%%.c')).toBeNull();
    expect(loginIdFromToken(null)).toBeNull();
  });
});

describe('resolveLoginId', () => {
  it('prefers the token claim over the /auth response userId', () => {
    const token = jwt({ cm_auth_id: 'usr_abc' });
    expect(resolveLoginId(token, '2')).toBe('usr_abc');
  });

  it('never returns the numeric ServiceStack id', () => {
    expect(resolveLoginId(jwt({ sub: '2' }), '2')).toBeNull();
  });

  it('falls back to a usr_ id the sign-in flow passed', () => {
    expect(resolveLoginId('opaque', 'usr_xyz')).toBe('usr_xyz');
  });
});
