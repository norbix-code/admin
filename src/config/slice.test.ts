import { describe, it, expect } from 'vitest';
import { selectApiRoot, selectApiReady, selectRegions } from './slice';
import type { RootState } from '@/app/store';
import type { EchoResponse } from '@/types/echo';

const echo: EchoResponse = {
  ip: '127.0.0.1',
  release: 'ManagedService',
  runtime: 'Development',
  managedServiceHubUrl: 'https://hub.norbix.ai/v3',
  managedServiceApiUrl: 'https://api.norbix.ai/v3',
  hubUrl: 'http://localhost:5001/v3',
  apiUrl: 'http://localhost:5002/v3',
  apiVersion: 'v3',
  hubVersion: 'v3',
  mjmlUrl: 'https://mjml.norbix.ai/',
  regions: [
    {
      code: 'nb-eu-germany',
      displayName: 'EU — Germany (Frankfurt)',
      apiUrl: 'https://nb-eu-germany.localhost',
      hubUrl: 'https://nb-eu-germany.localhost',
    },
  ],
};

const stateWith = (e: EchoResponse | null) =>
  ({ config: { echo: e } }) as unknown as RootState;

describe('selectApiRoot', () => {
  // The API root is the same-origin BFF proxy — the browser never targets the
  // gateway host. So it is fixed and does NOT depend on echo.
  it('is the same-origin BFF proxy root', () => {
    expect(selectApiRoot(stateWith(echo))).toBe('/api/proxy/api/v3');
  });

  it('is available even before echo resolves (proxy is same-origin)', () => {
    expect(selectApiRoot(stateWith(null))).toBe('/api/proxy/api/v3');
  });

  it('selectApiReady is always true (proxy is same-origin)', () => {
    expect(selectApiReady(stateWith(null))).toBe(true);
    expect(selectApiReady(stateWith(echo))).toBe(true);
  });
});

describe('selectRegions', () => {
  it('returns the echo regions', () => {
    expect(selectRegions(stateWith(echo))).toHaveLength(1);
    expect(selectRegions(stateWith(echo))[0].code).toBe('nb-eu-germany');
  });

  it('returns an empty array when echo has not resolved', () => {
    expect(selectRegions(stateWith(null))).toEqual([]);
  });
});
