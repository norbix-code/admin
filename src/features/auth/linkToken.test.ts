// Tokens in emailed links: fragment first (never sent to a server, never in
// an access log), query fallback for links sent before, and the token leaves
// the address bar (gateway docs/tasks/link-tokens-in-fragment.md).
import { describe, expect, it } from 'vitest';
import { addressWithout, linkParam, removeFromAddressBar } from './linkToken';

describe('linkParam — fragment first, query fallback', () => {
  it('reads a new link from the fragment (escaped "+" stays "+")', () => {
    expect(
      linkParam({ search: '', hash: '#token=Ab%2Bc%2Fd%3D' }, 'token'),
    ).toBe('Ab+c/d=');
  });

  it('still reads a link sent before from the query', () => {
    expect(linkParam({ search: '?token=old-1', hash: '' }, 'token')).toBe(
      'old-1',
    );
  });

  it('the fragment wins over the query', () => {
    expect(
      linkParam({ search: '?token=old-1', hash: '#token=new-1' }, 'token'),
    ).toBe('new-1');
  });

  it('several names: any name in the fragment beats every name in the query', () => {
    expect(
      linkParam(
        { search: '?token=q', hash: '#access_token=f' },
        'token',
        'access_token',
      ),
    ).toBe('f');
  });

  it('empty when there is none (blank values count as none)', () => {
    expect(linkParam({ search: '?token=', hash: '#token=%20' }, 'token')).toBe(
      '',
    );
  });
});

describe('the token leaves the address bar', () => {
  it('drops the fragment token and keeps the rest', () => {
    expect(
      addressWithout(
        {
          pathname: '/sign-in/reset/confirm',
          search: '?lang=en',
          hash: '#token=t1',
        },
        'token',
      ),
    ).toBe('/sign-in/reset/confirm?lang=en');
  });

  it('drops a query token of an old link, keeps other params', () => {
    expect(
      addressWithout(
        {
          pathname: '/oauth/callback',
          search: '?token=t1&userId=u1',
          hash: '',
        },
        'token',
        'bearerToken',
        'access_token',
      ),
    ).toBe('/oauth/callback?userId=u1');
  });

  it('changes nothing when there is no token', () => {
    expect(
      addressWithout({ pathname: '/x', search: '?a=1', hash: '' }, 'token'),
    ).toBe(undefined);
  });

  it('replaces the history entry (no new one), keeping its state', () => {
    const calls: unknown[][] = [];
    const removed = removeFromAddressBar(
      { pathname: '/sign-in/reset/confirm', search: '', hash: '#token=t1' },
      {
        state: { key: 'k1' },
        replaceState: (...args: unknown[]) => void calls.push(args),
      },
      'token',
    );
    expect(removed).toBe(true);
    expect(calls).toEqual([[{ key: 'k1' }, '', '/sign-in/reset/confirm']]);
  });

  it('does not touch the history when there is nothing to remove', () => {
    const calls: unknown[][] = [];
    const removed = removeFromAddressBar(
      { pathname: '/x', search: '', hash: '' },
      {
        state: null,
        replaceState: (...args: unknown[]) => void calls.push(args),
      },
      'token',
    );
    expect(removed).toBe(false);
    expect(calls).toEqual([]);
  });
});
