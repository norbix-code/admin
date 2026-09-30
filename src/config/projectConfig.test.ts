import { describe, expect, it } from 'vitest';
import { toAiChat } from './projectConfig';

describe('toAiChat (public config `aiChat`)', () => {
  it('keeps the assistants of an enabled chat (id, name, welcome)', () => {
    expect(
      toAiChat({
        enabled: true,
        assistants: [
          { id: 'ast_1', name: 'Helper', welcome: 'Hi! Ask me anything.' },
          { id: 'ast_2', name: 'Billing', welcome: null },
        ],
      }),
    ).toEqual({
      enabled: true,
      assistants: [
        { id: 'ast_1', name: 'Helper', welcome: 'Hi! Ask me anything.' },
        { id: 'ast_2', name: 'Billing', welcome: undefined },
      ],
    });
  });

  it('is off with no assistants when the project did not enable it', () => {
    expect(
      toAiChat({ enabled: false, assistants: [{ id: 'ast_1', name: 'x' }] }),
    ).toEqual({ enabled: false, assistants: [] });
    expect(toAiChat({})).toEqual({ enabled: false, assistants: [] });
  });

  it('drops an assistant without an id and names a nameless one', () => {
    expect(
      toAiChat({ enabled: true, assistants: [{ name: 'ghost' }, { id: 'a' }] }),
    ).toEqual({
      enabled: true,
      assistants: [{ id: 'a', name: 'Assistant', welcome: undefined }],
    });
  });
});
