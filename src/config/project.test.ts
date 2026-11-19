// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import {
  hostLabelFromViewId,
  resolveProjectId,
  viewIdFromHex,
  viewIdFromHostLabel,
} from './project';

// Reference pairs produced by .NET with the gateway's own steps
// (Guid.ParseExact(hex, "N") → Base62Converter.ToBase62String), so the TS
// conversion is checked against the real encoder, not against itself.
const DOTNET_PAIRS: [string, string][] = [
  ['4c0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2', 'pr_5R4dlqJeXx943tOzSDEwbS'],
  ['0a1b2c3d4e5f40718293a4b5c6d7e8f9', 'pr_7bZUvoXYZY0zZaCbVwzqcX'],
  ['00000000000040008000000000000001', 'pr_1szWVIyZFBV8Hfv8V3Y3c'],
  ['ffffffffffff4fffbfffffffffffffff', 'pr_7n42DGM5TfOoPIflrkH0vv'],
];

describe('viewIdFromHex', () => {
  it.each(DOTNET_PAIRS)('%s → %s (same as the gateway)', (hex, viewId) => {
    expect(viewIdFromHex(hex)).toBe(viewId);
  });
});

describe('hostLabelFromViewId', () => {
  it.each(DOTNET_PAIRS)('%s ← %s (same as the gateway)', (hex, viewId) => {
    expect(hostLabelFromViewId(viewId)).toBe(`pr-${hex}`);
  });

  it('reads the production project the task was checked on', () => {
    expect(hostLabelFromViewId('pr_Igqs1AfB4AZIwIJ7K9xgs')).toBe(
      'pr-75af6526cea04a7486d4be6198c6e709',
    );
  });

  it('refuses anything that is not a view id of a Guid', () => {
    expect(hostLabelFromViewId('pr_abc.evil.example')).toBeNull();
    expect(
      hostLabelFromViewId('pr-4c0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2'),
    ).toBeNull();
    expect(hostLabelFromViewId('acc_5R4dlqJeXx943tOzSDEwbS')).toBeNull();
    expect(hostLabelFromViewId('pr_')).toBeNull();
    // 22 digits, but more than 128 bits.
    expect(hostLabelFromViewId('pr_zzzzzzzzzzzzzzzzzzzzzz')).toBeNull();
  });
});

describe('viewIdFromHostLabel', () => {
  it('reads a pr-<hex> label (ProjectId.HostLabel), any case', () => {
    expect(viewIdFromHostLabel('pr-4c0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2')).toBe(
      'pr_5R4dlqJeXx943tOzSDEwbS',
    );
    expect(viewIdFromHostLabel('PR-4C0E7B1A8F9D4E2AA1B3C5D7E9F0A1B2')).toBe(
      'pr_5R4dlqJeXx943tOzSDEwbS',
    );
  });

  it('is a label, not a host: a whole host name is refused', () => {
    expect(
      viewIdFromHostLabel(
        'pr-4c0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2.admin.norbix.ai',
      ),
    ).toBeNull();
  });

  it('rejects a label with the wrong length or non-hex digits', () => {
    expect(viewIdFromHostLabel('pr-4c0e7b1a')).toBeNull();
    expect(
      viewIdFromHostLabel('pr-zz0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2'),
    ).toBeNull();
    expect(viewIdFromHostLabel('localhost')).toBeNull();
  });
});

// The project comes only from configuration: the server writes PROJECT_ID
// into the page as <meta name="norbix-project">.
describe('resolveProjectId', () => {
  const setMeta = (content: string) => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'norbix-project');
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
  };

  afterEach(() => {
    document.head.innerHTML = '';
    window.history.replaceState(null, '', '/');
  });

  it('reads the configured project from the page', () => {
    setMeta(' pr_5R4dlqJeXx943tOzSDEwbS ');
    expect(resolveProjectId()).toBe('pr_5R4dlqJeXx943tOzSDEwbS');
  });

  it('is null when the page carries no project', () => {
    expect(resolveProjectId()).toBeNull();
    setMeta('  ');
    expect(resolveProjectId()).toBeNull();
  });

  it('takes no argument: a host cannot be handed in', () => {
    expect(resolveProjectId.length).toBe(0);
  });
});
