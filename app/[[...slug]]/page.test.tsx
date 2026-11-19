// The page: the app when the portal is set up, the setup screen when
// PROJECT_ID or API_KEY is missing. The address the page is opened at plays
// no part — the page reads only the server environment.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { resetSetupLogForTests } from '../lib/portalSetup';

vi.mock('../SpaShell', () => ({
  default: () => <div data-testid="app">the app</div>,
}));

import CatchAllPage from './page';
import { generateMetadata } from '../layout';

vi.mock('../../src/styles.css', () => ({}));

const PROJECT = 'pr_5R4dlqJeXx943tOzSDEwbS';

beforeEach(() => {
  resetSetupLogForTests();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('the portal page', () => {
  it('shows the app and writes the configured project into the page', () => {
    vi.stubEnv('PROJECT_ID', PROJECT);
    vi.stubEnv('API_KEY', 'svc-key');

    expect(renderToStaticMarkup(<CatchAllPage />)).toContain('the app');
    expect(generateMetadata().other).toEqual({ 'norbix-project': PROJECT });
  });

  it('shows the setup screen naming PROJECT_ID when it is missing', () => {
    vi.stubEnv('PROJECT_ID', '');
    vi.stubEnv('API_KEY', 'svc-key');

    const html = renderToStaticMarkup(<CatchAllPage />);

    expect(html).toContain('This portal is not set up yet');
    expect(html).toContain('data-setup-missing="PROJECT_ID"');
    expect(html).not.toContain('data-setup-missing="API_KEY"');
    expect(html).not.toContain('the app');
    expect(generateMetadata().other).toBeUndefined();
  });

  it('shows the setup screen naming API_KEY when it is missing, and never the key', () => {
    vi.stubEnv('PROJECT_ID', PROJECT);
    vi.stubEnv('API_KEY', '');

    const html = renderToStaticMarkup(<CatchAllPage />);

    expect(html).toContain('data-setup-missing="API_KEY"');
    expect(html).toContain('API_KEY is not set');
    expect(html).not.toContain('data-setup-missing="PROJECT_ID"');
    expect(html).not.toContain('the app');
  });

  it('names both when both are missing', () => {
    vi.stubEnv('PROJECT_ID', '');
    vi.stubEnv('API_KEY', '');

    const html = renderToStaticMarkup(<CatchAllPage />);

    expect(html).toContain('data-setup-missing="PROJECT_ID"');
    expect(html).toContain('data-setup-missing="API_KEY"');
  });

  it('logs one line for many page loads', () => {
    vi.stubEnv('PROJECT_ID', '');
    vi.stubEnv('API_KEY', '');

    renderToStaticMarkup(<CatchAllPage />);
    renderToStaticMarkup(<CatchAllPage />);
    generateMetadata();

    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
