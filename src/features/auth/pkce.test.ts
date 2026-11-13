// @vitest-environment jsdom
// PKCE between the portal and the gateway: a fresh S256 pair per start, the
// verifier kept in this tab's sessionStorage under the SDK's key, read once
// and removed; no storage → start without a challenge.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { beginPkce, clearPkceVerifier, takePkceVerifier } from './pkce';

const s256 = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('PKCE verifier storage', () => {
  it('a start keeps a 43-character verifier and answers its S256 challenge', async () => {
    const challenge = await beginPkce('signIn', 'Google');
    const verifier = window.sessionStorage.getItem('norbix:pkce:signIn:google');
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(s256(verifier!));
  });

  it('every start makes a new pair', async () => {
    const a = await beginPkce('link', 'github');
    const b = await beginPkce('link', 'github');
    expect(a).not.toBe(b);
  });

  it('the verifier is read once and removed', async () => {
    await beginPkce('link', 'google');
    const verifier = takePkceVerifier('link', 'google');
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(takePkceVerifier('link', 'google')).toBeUndefined();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('sign-in and link keep separate verifiers', async () => {
    await beginPkce('signIn', 'google');
    expect(takePkceVerifier('link', 'google')).toBeUndefined();
    expect(takePkceVerifier('signIn', 'google')).toBeTruthy();
  });

  it('clear drops a kept verifier', async () => {
    await beginPkce('link', 'google');
    clearPkceVerifier('link', 'google');
    expect(takePkceVerifier('link', 'google')).toBeUndefined();
  });

  it('no usable storage: the start goes without a challenge and no verifier is sent', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(await beginPkce('signIn', 'google')).toBeNull();
    expect(takePkceVerifier('signIn', 'google')).toBeUndefined();
  });
});
