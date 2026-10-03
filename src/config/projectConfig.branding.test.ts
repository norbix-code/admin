// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyBranding,
  loadProjectConfig,
  PLACEHOLDER_DISPLAY_NAME,
  projectNameOf,
} from './projectConfig';
import type { ProjectConfig } from '@/types/projectConfig';

/** Serve one public-config body from the stubbed fetch; record the request. */
const servePublicConfig = (body: unknown, ok = true) => {
  const fetchMock = vi.fn(
    async () => ({ ok, json: async () => body }) as unknown as Response,
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadProjectConfig — name and branding from the public config', () => {
  it('asks the proxy for the project config with the project headers', async () => {
    const fetchMock = servePublicConfig({ displayName: 'Shop' });
    await loadProjectConfig('pr_a');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Headers },
    ];
    expect(url).toMatch(/\/public\/projects\/pr_a\/config$/);
    expect(init.headers.get('nb-project-id')).toBe('pr_a');
  });

  it('prefers the top-level name over the brand name', async () => {
    servePublicConfig({
      displayName: 'Top Name',
      branding: { displayName: 'Brand Name' },
    });
    const c = await loadProjectConfig('pr_b');
    expect(c.branding.displayName).toBe('Top Name');
  });

  it('falls back to the brand name when the top-level name is empty', async () => {
    servePublicConfig({ displayName: '', branding: { displayName: 'Brand' } });
    const c = await loadProjectConfig('pr_c');
    expect(c.branding.displayName).toBe('Brand');
  });

  it('falls back to the placeholder when no name comes back', async () => {
    servePublicConfig({ branding: null });
    const c = await loadProjectConfig('pr_d');
    expect(c.branding.displayName).toBe(PLACEHOLDER_DISPLAY_NAME);
    expect(projectNameOf(c.branding)).toBeUndefined();
  });

  it('keeps the name but no colours or logo when the brand is not exposed', async () => {
    servePublicConfig({ displayName: 'Plain Shop', branding: null });
    const c = await loadProjectConfig('pr_e');
    expect(c.branding).toEqual({
      displayName: 'Plain Shop',
      mainColor: undefined,
      accentColor: undefined,
      logoUrl: undefined,
      iconUrl: undefined,
    });
  });

  it('maps colours, logo and icon when the brand is exposed', async () => {
    servePublicConfig({
      displayName: 'Brand Shop',
      branding: {
        mainColor: '#aa3300',
        accentColor: '#0055ff',
        logoUrl: 'https://cdn.test/logo.svg',
        iconUrl: 'https://cdn.test/icon.png',
      },
    });
    const c = await loadProjectConfig('pr_f');
    expect(c.branding).toEqual({
      displayName: 'Brand Shop',
      mainColor: '#aa3300',
      accentColor: '#0055ff',
      logoUrl: 'https://cdn.test/logo.svg',
      iconUrl: 'https://cdn.test/icon.png',
    });
  });

  it('turns an empty logo / icon string into "no logo"', async () => {
    servePublicConfig({
      displayName: 'X',
      branding: { logoUrl: '', iconUrl: '' },
    });
    const c = await loadProjectConfig('pr_g');
    expect(c.branding.logoUrl).toBeUndefined();
    expect(c.branding.iconUrl).toBeUndefined();
  });

  it('keeps the neutral defaults when the endpoint fails', async () => {
    servePublicConfig({}, false);
    const c = await loadProjectConfig('pr_h');
    expect(c.branding).toEqual({ displayName: PLACEHOLDER_DISPLAY_NAME });
  });
});

describe('projectNameOf', () => {
  it('is the trimmed name, undefined for the placeholder / blank / absent', () => {
    expect(projectNameOf({ displayName: '  Shop ' })).toBe('Shop');
    expect(projectNameOf({ displayName: PLACEHOLDER_DISPLAY_NAME })).toBe(
      undefined,
    );
    expect(projectNameOf({ displayName: '  ' })).toBeUndefined();
    expect(projectNameOf(null)).toBeUndefined();
  });
});

describe('applyBranding', () => {
  const config = (branding: ProjectConfig['branding']): ProjectConfig => ({
    projectId: 'pr_x',
    branding,
    auth: {
      socialProviders: [],
      passkey: false,
      methods: ['email'],
      passwordPolicy: { minLength: 3 },
      exposed: false,
    },
    links: {},
  });

  beforeEach(() => {
    // The static Next metadata title, as the server-rendered page has it.
    document.head.innerHTML = '<title>Admin Portal</title>';
    document.documentElement.removeAttribute('style');
  });

  it('sets the tab title, the favicon and the colour tokens', () => {
    applyBranding(
      config({
        displayName: 'Brand Shop',
        mainColor: '#aa3300',
        accentColor: '#0055ff',
        iconUrl: 'https://cdn.test/icon.png',
      }),
    );
    const style = document.documentElement.style;
    expect({
      title: document.title,
      favicon: document
        .querySelector<HTMLLinkElement>('link[rel="icon"]')
        ?.getAttribute('href'),
      primary: style.getPropertyValue('--admin-primary'),
      primaryHover: style.getPropertyValue('--admin-primary-hover'),
      accent: style.getPropertyValue('--admin-accent'),
    }).toEqual({
      title: 'Brand Shop',
      favicon: 'https://cdn.test/icon.png',
      primary: '#aa3300',
      // #aa3300 darkened 12 %: 0xaa*0.88 = 150 (0x96), 0x33*0.88 = 45 (0x2d).
      primaryHover: '#962d00',
      accent: '#0055ff',
    });
  });

  it('reuses an existing favicon link instead of adding a second one', () => {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<link rel="icon" href="/favicon.ico">',
    );
    applyBranding(config({ displayName: 'S', iconUrl: '/brand.png' }));
    const links = document.querySelectorAll('link[rel="icon"]');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/brand.png');
  });

  it('leaves the title, favicon and tokens alone when the brand is empty', () => {
    applyBranding(config({ displayName: PLACEHOLDER_DISPLAY_NAME }));
    expect({
      title: document.title,
      favicon: document.querySelector('link[rel="icon"]'),
      style: document.documentElement.getAttribute('style'),
    }).toEqual({ title: 'Admin Portal', favicon: null, style: null });
  });
});
