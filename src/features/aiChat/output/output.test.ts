// Output factory — the same fixtures as the cloud dashboard chat
// (cloud tests/features/aiChatOutput.test.ts), so the port renders the same
// structure the dashboard did. Plus the view-block and YAML cases the cloud
// file does not have.
import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './markdown';
import { parseAssistantOutput } from './blocks';
import { toYaml } from './yaml';

describe('aiChat output factory — parseAssistantOutput', () => {
  it('splits prose and fenced code into typed blocks', () => {
    const text =
      'Here is the query:\n```sql\nSELECT 1;\n```\nRun it in the console.';

    expect(parseAssistantOutput(text)).toEqual([
      { kind: 'markdown', text: 'Here is the query:' },
      { kind: 'code', language: 'sql', code: 'SELECT 1;' },
      { kind: 'markdown', text: 'Run it in the console.' },
    ]);
  });

  it('detects mjml by fence language and by content', () => {
    expect(parseAssistantOutput('```mjml\n<mj-body/>\n```')).toEqual([
      { kind: 'mjml', code: '<mj-body/>' },
    ]);

    expect(parseAssistantOutput('```\n<mjml><mj-body/></mjml>\n```')).toEqual([
      { kind: 'mjml', code: '<mjml><mj-body/></mjml>' },
    ]);
  });

  it('plain text yields a single markdown block', () => {
    expect(parseAssistantOutput('Just a sentence.')).toEqual([
      { kind: 'markdown', text: 'Just a sentence.' },
    ]);
  });

  it('reads the view type from `type=` and from `norbix-view:`', () => {
    expect(
      parseAssistantOutput(
        '```norbix-view type=table\n[{"a":1}]\n```\n```norbix-view:tree\n[]\n```\n```norbix-view\n{}\n```',
      ),
    ).toEqual([
      { kind: 'view', viewType: 'table', raw: '[{"a":1}]' },
      { kind: 'view', viewType: 'tree', raw: '[]' },
      { kind: 'view', viewType: 'json', raw: '{}' },
    ]);
  });
});

describe('aiChat output factory — parseInline', () => {
  it('parses bold, inline code, and text around them', () => {
    expect(parseInline('**Project name:** ProjectX (`en`)')).toEqual([
      { type: 'bold', text: 'Project name:' },
      { type: 'text', text: ' ProjectX (' },
      { type: 'code', text: 'en' },
      { type: 'text', text: ')' },
    ]);
  });

  it('parses italic and links', () => {
    expect(
      parseInline('open *this* [dashboard](https://cloud.norbix.io/p1)'),
    ).toEqual([
      { type: 'text', text: 'open ' },
      { type: 'italic', text: 'this' },
      { type: 'text', text: ' ' },
      { type: 'link', text: 'dashboard', href: 'https://cloud.norbix.io/p1' },
    ]);
  });

  it('leaves unbalanced markers as plain text', () => {
    expect(parseInline('a * b and 2 ** 3')).toEqual([
      { type: 'text', text: 'a * b and 2 ** 3' },
    ]);
  });

  it('never makes a link of a javascript: href', () => {
    expect(parseInline('[x](javascript:alert(1))')).toEqual([
      { type: 'text', text: '[x](javascript:alert(1))' },
    ]);
  });
});

describe('aiChat output factory — parseMarkdown', () => {
  it('parses the field-test shape: heading, bullets with bold, paragraph', () => {
    const text = [
      '## Overview',
      '',
      '- **Project name:** ProjectX',
      '- **Environment:** PROD',
      '',
      'A production project.',
      'One region only.',
    ].join('\n');

    expect(parseMarkdown(text)).toEqual([
      {
        type: 'heading',
        level: 2,
        spans: [{ type: 'text', text: 'Overview' }],
      },
      {
        type: 'list',
        ordered: false,
        items: [
          [
            { type: 'bold', text: 'Project name:' },
            { type: 'text', text: ' ProjectX' },
          ],
          [
            { type: 'bold', text: 'Environment:' },
            { type: 'text', text: ' PROD' },
          ],
        ],
      },
      {
        type: 'paragraph',
        spans: [
          { type: 'text', text: 'A production project.\nOne region only.' },
        ],
      },
    ]);
  });

  it('separates ordered from unordered lists', () => {
    expect(parseMarkdown('1. first\n2. second\n- bullet')).toEqual([
      {
        type: 'list',
        ordered: true,
        items: [
          [{ type: 'text', text: 'first' }],
          [{ type: 'text', text: 'second' }],
        ],
      },
      {
        type: 'list',
        ordered: false,
        items: [[{ type: 'text', text: 'bullet' }]],
      },
    ]);
  });
});

describe('aiChat output factory — toYaml', () => {
  it('dumps nested objects and arrays, quoting what YAML would misread', () => {
    expect(
      toYaml({
        name: 'Anna',
        age: 31,
        tags: ['a', 'b'],
        address: { city: 'Vilnius', zip: '01100' },
        empty: [],
        note: 'yes: really',
      }),
    ).toBe(
      [
        'name: Anna',
        'age: 31',
        'tags:',
        '  - a',
        '  - b',
        'address:',
        '  city: Vilnius',
        '  zip: "01100"',
        'empty: []',
        'note: "yes: really"',
      ].join('\n'),
    );
  });

  it('puts the first field of an object in a list on the dash line', () => {
    expect(toYaml([{ id: 'x', n: 1 }])).toBe(['- id: x', '  n: 1'].join('\n'));
  });
});
