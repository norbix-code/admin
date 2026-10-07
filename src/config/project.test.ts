import { describe, it, expect } from 'vitest';
import { parseProjectIdFromHost, viewIdFromHex } from './project';

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

describe('parseProjectIdFromHost', () => {
  it('reads the pr-<hex> host label (ProjectId.HostLabel)', () => {
    expect(
      parseProjectIdFromHost(
        'pr-4c0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2.admin.norbix.ai',
      ),
    ).toBe('pr_5R4dlqJeXx943tOzSDEwbS');
  });

  it('accepts any case and a port, like ProjectId.TryParseFromHost', () => {
    expect(
      parseProjectIdFromHost(
        'PR-4C0E7B1A8F9D4E2AA1B3C5D7E9F0A1B2.admin.localhost:3100',
      ),
    ).toBe('pr_5R4dlqJeXx943tOzSDEwbS');
  });

  it('no longer reads the pr_<base62> form (browsers lower-case it)', () => {
    expect(parseProjectIdFromHost('pr_7hk2.admin.norbix.ai')).toBeNull();
  });

  it('rejects a label with the wrong length or non-hex digits', () => {
    expect(parseProjectIdFromHost('pr-4c0e7b1a.admin.norbix.ai')).toBeNull();
    expect(
      parseProjectIdFromHost(
        'pr-zz0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2.admin.norbix.ai',
      ),
    ).toBeNull();
  });

  it('returns null for a bare admin host (no project)', () => {
    expect(parseProjectIdFromHost('admin.norbix.ai')).toBeNull();
  });

  it('handles single-label hosts (localhost) as no project', () => {
    expect(parseProjectIdFromHost('localhost')).toBeNull();
  });
});
