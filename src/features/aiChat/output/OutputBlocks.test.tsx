// @vitest-environment jsdom
// Component tests for the output renderer port: each block kind renders the
// element the dashboard chat rendered (same fixtures as the cloud tests).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { AssistantOutput } from './OutputBlocks';

afterEach(cleanup);

const kinds = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-output-kind]')].map((el) =>
    el.getAttribute('data-output-kind'),
  );

describe('AssistantOutput', () => {
  it('renders prose as markdown and a fenced block as code with its language', () => {
    const { container } = render(
      <AssistantOutput
        text={
          'Here is the query:\n```sql\nSELECT 1;\n```\nRun it in the console.'
        }
      />,
    );

    expect(kinds(container)).toEqual(['markdown', 'code', 'markdown']);
    expect(container.querySelector('pre')?.textContent).toBe('SELECT 1;');
    expect(container.textContent).toContain('sql');
  });

  it('renders the field-test markdown: heading, bold list items, paragraph', () => {
    const { container } = render(
      <AssistantOutput
        text={[
          '## Overview',
          '',
          '- **Project name:** ProjectX',
          '- **Environment:** PROD',
          '',
          'Open [the docs](https://norbix.ai/docs) or run `norbix login`.',
        ].join('\n')}
      />,
    );

    const items = [...container.querySelectorAll('ul > li')].map(
      (li) => li.textContent,
    );
    expect(items).toEqual(['Project name: ProjectX', 'Environment: PROD']);
    expect(
      [...container.querySelectorAll('strong')].map((s) => s.textContent),
    ).toEqual(['Project name:', 'Environment:']);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://norbix.ai/docs');
    expect(link?.getAttribute('rel')).toBe('noreferrer');
    expect(container.querySelector('code')?.textContent).toBe('norbix login');
  });

  it('renders an ordered list as <ol>', () => {
    const { container } = render(
      <AssistantOutput text={'1. first\n2. second'} />,
    );
    expect(container.querySelectorAll('ol > li')).toHaveLength(2);
  });

  it('renders mjml as code labelled mjml', () => {
    const { container } = render(
      <AssistantOutput text={'```\n<mjml><mj-body/></mjml>\n```'} />,
    );
    expect(kinds(container)).toEqual(['mjml']);
    expect(container.querySelector('pre')?.textContent).toBe(
      '<mjml><mj-body/></mjml>',
    );
    expect(container.textContent).toContain('mjml');
  });

  it('renders a norbix-view table with one column per scalar field', () => {
    const { container } = render(
      <AssistantOutput
        text={
          '```norbix-view type=table\n{"items":[{"name":"Anna","age":31,"tags":["x"]},{"name":"Ben","city":"Riga"}]}\n```'
        }
      />,
    );

    const headers = [...container.querySelectorAll('th')].map(
      (th) => th.textContent,
    );
    expect(headers).toEqual(['name', 'age', 'city']);
    const rows = [...container.querySelectorAll('tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ['Anna', '31', ''],
      ['Ben', '', 'Riga'],
    ]);
  });

  it('renders a norbix-view tree with nested nodes and order badges', () => {
    const { container } = render(
      <AssistantOutput
        text={
          '```norbix-view type=tree\n{"tree":[{"id":"1","name":"Root","order":1,"children":[{"id":"2","name":"Leaf"}]}]}\n```'
        }
      />,
    );

    expect(container.querySelector('summary')?.textContent).toBe('Root#1');
    expect(container.querySelector('details ul li')?.textContent).toBe('Leaf');
  });

  it('renders norbix-view yaml and json as labelled code', () => {
    const { container } = render(
      <AssistantOutput
        text={
          '```norbix-view type=yaml\n{"a":1,"b":["x"]}\n```\n```norbix-view type=json\n{"a":1}\n```'
        }
      />,
    );

    const pres = [...container.querySelectorAll('pre')].map(
      (p) => p.textContent,
    );
    expect(pres).toEqual(['a: 1\nb:\n  - x', '{\n  "a": 1\n}']);
  });

  it('shows the raw payload when a view block is not valid JSON', () => {
    const { container } = render(
      <AssistantOutput text={'```norbix-view type=table\nnot json\n```'} />,
    );
    expect(container.querySelector('pre')?.textContent).toBe('not json');
    expect(container.querySelector('table')).toBeNull();
  });

  it('never renders assistant text as HTML', () => {
    const { container } = render(
      <AssistantOutput text={'<img src=x onerror="alert(1)"> hello'} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x');
  });
});
