import { describe, expect, it } from 'vitest';
import { copyTextOf, hasFeedbackAffordance, viewBlockJsonAt } from './copyText';

describe('copyText', () => {
  it('copies the raw text of the two message kinds, nothing for a notice', () => {
    const base = { id: 'e', seq: 1, atUtc: '' };
    expect(
      copyTextOf({ ...base, kind: 'assistant.text', text: '**bold** `x`' }),
    ).toBe('**bold** `x`');
    expect(copyTextOf({ ...base, kind: 'user.message', text: 'hi' })).toBe(
      'hi',
    );
    expect(
      copyTextOf({ ...base, kind: 'notice', text: 'x', level: 'error' }),
    ).toBeUndefined();
    expect(hasFeedbackAffordance('notice')).toBe(false);
    expect(hasFeedbackAffordance('assistant.text')).toBe(true);
  });

  it('over a view block, copies that block as pretty JSON', () => {
    const text = 'Your orders:\n```norbix-view type=table\n[{"id":1}]\n```';
    expect(viewBlockJsonAt(text, 1)).toBe('[\n  {\n    "id": 1\n  }\n]');
    expect(viewBlockJsonAt(text, 0)).toBeUndefined();
    expect(viewBlockJsonAt(text, undefined)).toBeUndefined();
  });
});
