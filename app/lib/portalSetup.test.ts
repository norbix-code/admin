// The two required settings: PROJECT_ID and API_KEY. Nothing else can stand
// in for either of them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  notSetUpResponse,
  portalSetup,
  readPortalSetup,
  readyPortalSetup,
  resetSetupLogForTests,
} from './portalSetup';

const PROJECT = 'pr_5R4dlqJeXx943tOzSDEwbS';

describe('readPortalSetup', () => {
  it('is complete with a project id and a key', () => {
    expect(readPortalSetup({ PROJECT_ID: PROJECT, API_KEY: 'k' })).toEqual({
      projectId: PROJECT,
      apiKey: 'k',
      problems: [],
    });
  });

  it('accepts PROJECT_ID written as a host label (pr-<hex>)', () => {
    const setup = readPortalSetup({
      PROJECT_ID: 'pr-4c0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2',
      API_KEY: 'k',
    });
    expect(setup.projectId).toBe(PROJECT);
    expect(setup.problems).toEqual([]);
  });

  it('names PROJECT_ID when it is missing or blank', () => {
    for (const value of [undefined, '', '   ']) {
      const setup = readPortalSetup({ PROJECT_ID: value, API_KEY: 'k' });
      expect(setup.projectId).toBeNull();
      expect(setup.problems.map((p) => p.variable)).toEqual(['PROJECT_ID']);
      expect(setup.problems[0].message).toContain('PROJECT_ID is not set');
    }
  });

  it('names PROJECT_ID when it is not a project id, without echoing it', () => {
    const setup = readPortalSetup({
      PROJECT_ID: 'my-project"><script>',
      API_KEY: 'k',
    });
    expect(setup.projectId).toBeNull();
    expect(setup.problems.map((p) => p.variable)).toEqual(['PROJECT_ID']);
    expect(setup.problems[0].message).toContain('is not a project id');
    expect(setup.problems[0].message).not.toContain('script');
  });

  it('names API_KEY when it is missing or blank', () => {
    for (const value of [undefined, '', '  ']) {
      const setup = readPortalSetup({ PROJECT_ID: PROJECT, API_KEY: value });
      expect(setup.apiKey).toBeNull();
      expect(setup.problems.map((p) => p.variable)).toEqual(['API_KEY']);
      expect(setup.problems[0].message).toContain('API_KEY is not set');
    }
  });

  it('names both when both are missing', () => {
    expect(readPortalSetup({}).problems.map((p) => p.variable)).toEqual([
      'PROJECT_ID',
      'API_KEY',
    ]);
  });

  it('has no other source for the project: the old build-time pins are ignored', () => {
    const setup = readPortalSetup({
      NEXT_PUBLIC_ADMIN_PROJECT_ID: PROJECT,
      VITE_ADMIN_PROJECT_ID: PROJECT,
      API_KEY: 'k',
    });
    expect(setup.projectId).toBeNull();
    expect(setup.problems.map((p) => p.variable)).toEqual(['PROJECT_ID']);
  });
});

describe('portalSetup (this server)', () => {
  beforeEach(() => {
    resetSetupLogForTests();
    vi.stubEnv('PROJECT_ID', '');
    vi.stubEnv('API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('logs one clear line, once, however often it is asked', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    portalSetup();
    portalSetup();
    expect(readyPortalSetup()).toBeNull();

    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0][0]);
    expect(line).toContain('[admin-portal] Not set up');
    expect(line).toContain('PROJECT_ID is not set');
    expect(line).toContain('API_KEY is not set');
  });

  it('logs nothing when the portal is set up', () => {
    vi.stubEnv('PROJECT_ID', PROJECT);
    vi.stubEnv('API_KEY', 'svc-key');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(readyPortalSetup()).toEqual({
      projectId: PROJECT,
      apiKey: 'svc-key',
    });
    expect(log).not.toHaveBeenCalled();
  });

  it('answers 503 with the missing variables', async () => {
    vi.stubEnv('PROJECT_ID', PROJECT);
    const res = notSetUpResponse();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: 'portal-not-set-up',
      missing: ['API_KEY'],
      message:
        'API_KEY is not set. Set it to the API key of the Admin Portal service user.',
    });
  });
});
