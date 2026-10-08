import { describe, expect, it } from 'vitest';
import { runtimeProjectId } from './runtimeProject';
import { viewIdFromHex } from '@/config/project';

describe('runtimeProjectId', () => {
  it('returns null when unset or blank', () => {
    expect(runtimeProjectId(undefined)).toBeNull();
    expect(runtimeProjectId('')).toBeNull();
    expect(runtimeProjectId('   ')).toBeNull();
  });

  it('keeps a pr_{base62} view id (trimmed)', () => {
    expect(runtimeProjectId(' pr_5R4dlqJeXx943tOzSDEwbS ')).toBe(
      'pr_5R4dlqJeXx943tOzSDEwbS',
    );
  });

  it('converts a pr-{hex} host label to the view id', () => {
    const hex = '4c0e7b1a8f9d4e2aa1b3c5d7e9f0a1b2';
    expect(runtimeProjectId(`pr-${hex}`)).toBe(viewIdFromHex(hex));
  });

  it('rejects anything else', () => {
    expect(runtimeProjectId('my-project')).toBeNull();
    expect(runtimeProjectId('pr_"><script>')).toBeNull();
    expect(runtimeProjectId('pr-1234')).toBeNull();
  });
});
