import { describe, it, expect } from 'vitest';
import { selectApiRoot, selectRegions } from './slice';
import { API_ROOT_FALLBACK } from './env';
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
  it('uses the apiUrl discovered from echo', () => {
    expect(selectApiRoot(stateWith(echo))).toBe('http://localhost:5002/v3');
  });

  it('strips a trailing slash from the echo apiUrl', () => {
    expect(
      selectApiRoot(
        stateWith({ ...echo, apiUrl: 'http://localhost:5002/v3/' }),
      ),
    ).toBe('http://localhost:5002/v3');
  });

  it('falls back to the env API root when echo has not resolved', () => {
    expect(selectApiRoot(stateWith(null))).toBe(API_ROOT_FALLBACK);
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
