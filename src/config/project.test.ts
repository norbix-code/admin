import { describe, it, expect } from 'vitest';
import { parseProjectIdFromHost } from './project';

describe('parseProjectIdFromHost', () => {
  it('extracts the base62 id from a pr_ subdomain', () => {
    expect(parseProjectIdFromHost('pr_7Hk2.admin.norbix.ai')).toBe('7Hk2');
  });

  it('returns null for a bare admin host (no project)', () => {
    expect(parseProjectIdFromHost('admin.norbix.ai')).toBeNull();
  });

  it('returns null when the first label is not a pr_ prefix', () => {
    expect(parseProjectIdFromHost('cloud.norbix.ai')).toBeNull();
  });

  it('handles single-label hosts (localhost) as no project', () => {
    expect(parseProjectIdFromHost('localhost')).toBeNull();
  });
});
