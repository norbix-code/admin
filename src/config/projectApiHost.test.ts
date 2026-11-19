import { describe, it, expect } from 'vitest';
import { projectApiBase, sharedApiHostOf } from './projectApiHost';

const TEMPLATE = 'https://{projectHostLabel}.api.norbix.ai/v3';
const PROJECT = 'pr_Igqs1AfB4AZIwIJ7K9xgs';
const LABEL = 'pr-75af6526cea04a7486d4be6198c6e709';

describe('projectApiBase', () => {
  it("builds the project's own API host from the echo template, without the version", () => {
    expect(projectApiBase(TEMPLATE, PROJECT)).toBe(
      `https://${LABEL}.api.norbix.ai`,
    );
  });

  it('keeps a port and a path prefix', () => {
    expect(
      projectApiBase(
        'http://{projectHostLabel}.api.norbix.test:8443/gw/v3',
        PROJECT,
      ),
    ).toBe(`http://${LABEL}.api.norbix.test:8443/gw`);
  });

  it('answers null with no template: the install has one API host', () => {
    expect(projectApiBase(undefined, PROJECT)).toBeNull();
    expect(projectApiBase(null, PROJECT)).toBeNull();
    expect(projectApiBase('', PROJECT)).toBeNull();
  });

  it('answers null for an id that is not a project view id', () => {
    expect(projectApiBase(TEMPLATE, undefined)).toBeNull();
    expect(projectApiBase(TEMPLATE, 'evil.example/')).toBeNull();
    expect(projectApiBase(TEMPLATE, 'pr_abc@evil.example')).toBeNull();
  });

  it('answers null for a template that is not {label}.<host>', () => {
    expect(projectApiBase('https://api.norbix.ai/v3', PROJECT)).toBeNull();
    expect(
      projectApiBase('https://api.norbix.ai/{projectHostLabel}/v3', PROJECT),
    ).toBeNull();
    expect(
      projectApiBase('ftp://{projectHostLabel}.api.norbix.ai', PROJECT),
    ).toBeNull();
    expect(
      projectApiBase(
        'https://{projectHostLabel}.{projectHostLabel}.ai',
        PROJECT,
      ),
    ).toBeNull();
  });
});

describe('sharedApiHostOf', () => {
  it('answers the host the template stands on, with its port', () => {
    expect(sharedApiHostOf(TEMPLATE)).toBe('api.norbix.ai');
    expect(
      sharedApiHostOf('http://{projectHostLabel}.API.norbix.test:8443/v3'),
    ).toBe('api.norbix.test:8443');
  });

  it('answers null for no template or another shape', () => {
    expect(sharedApiHostOf(null)).toBeNull();
    expect(sharedApiHostOf('https://api.norbix.ai/v3')).toBeNull();
  });
});
