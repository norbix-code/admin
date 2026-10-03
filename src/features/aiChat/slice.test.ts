import { describe, expect, it } from 'vitest';
import type { UnknownAction } from '@reduxjs/toolkit';
import reducer, {
  aiChatInitialState,
  AiChatState,
  entriesLoaded,
  entryUpserted,
  feedbackSet,
  messageSent,
  sessionReset,
  sessionSwitched,
  turnCompleted,
  turnFailed,
  turnRejected,
  turnStarted,
  turnTokenReceived,
} from './slice';
import { routeChatEvent } from './chatEffects';

const run = (
  actions: UnknownAction[],
  from: AiChatState = aiChatInitialState,
) => actions.reduce((s, a) => reducer(s, a), from);

/** The transcript as the user sees it: kind + text, in order. */
const transcript = (s: AiChatState) =>
  s.order.map((id) => {
    const e = s.entries[id] as { kind: string; text?: string };
    return `${e.kind}: ${e.text ?? ''}`;
  });

const turn = { turnId: 'trn_1', sessionId: 'aics_1' };

describe('aiChat slice — a first turn streamed over SSE', () => {
  const afterStream = run([
    messageSent({ text: 'Where is order 42?' }),
    turnStarted({
      epoch: 0,
      turnId: 'trn_1',
      sessionId: 'aics_1',
      channel: 'ai-chat:pr_1:usr_1',
    }),
    entryUpserted({
      step: 'ai.chat.entry',
      sessionId: 'aics_1',
      seq: 1,
      entry: {
        id: 'ent_1',
        kind: 'user.message',
        text: 'Where is order 42?',
        seq: 1,
      },
    }),
    turnTokenReceived({ ...turn, entryId: 'ent_2', text: 'It left ' }),
    // The entry upsert of the first token arrives AFTER more tokens: the
    // streamed text must not go backwards.
    turnTokenReceived({ ...turn, entryId: 'ent_2', text: 'the warehouse' }),
    entryUpserted({
      step: 'ai.chat.entry',
      sessionId: 'aics_1',
      seq: 2,
      entry: {
        id: 'ent_2',
        kind: 'assistant.text',
        text: 'It left ',
        isStreaming: true,
        seq: 2,
      },
    }),
  ]);

  it('replaces the optimistic message with the server copy and streams the reply', () => {
    expect(transcript(afterStream)).toEqual([
      'user.message: Where is order 42?',
      'assistant.text: It left the warehouse',
    ]);
    expect(afterStream).toMatchObject({
      sessionId: 'aics_1',
      channel: 'ai-chat:pr_1:usr_1',
      turnId: 'trn_1',
      isSending: true,
      lastSeq: 2,
    });
  });

  it('completed sets the whole reply and ends the turn', () => {
    const done = run(
      [
        turnCompleted({
          ...turn,
          entryId: 'ent_2',
          text: 'It left the warehouse today.',
        }),
      ],
      afterStream,
    );
    expect(transcript(done)).toEqual([
      'user.message: Where is order 42?',
      'assistant.text: It left the warehouse today.',
    ]);
    expect(done.entries.ent_2).toMatchObject({ isStreaming: false });
    expect(done).toMatchObject({ isSending: false, turnId: undefined });
  });

  it('a late token after the final reply does not double the text', () => {
    const done = run(
      [
        turnCompleted({
          ...turn,
          entryId: 'ent_2',
          text: 'It left the warehouse.',
        }),
        turnTokenReceived({ ...turn, entryId: 'ent_2', text: 'warehouse' }),
      ],
      afterStream,
    );
    expect(transcript(done)).toEqual([
      'user.message: Where is order 42?',
      'assistant.text: It left the warehouse.',
    ]);
  });

  it('ignores events of another session', () => {
    const other = run(
      [
        turnTokenReceived({
          turnId: 't',
          sessionId: 'aics_9',
          entryId: 'x',
          text: 'no',
        }),
      ],
      afterStream,
    );
    expect(other).toBe(afterStream);
  });
});

describe('aiChat slice — failures land in the transcript', () => {
  it('a rejected turn shows a notice and frees the composer', () => {
    const s = run([
      messageSent({ text: 'hi' }),
      turnRejected({
        epoch: 0,
        notice: 'AI chat is turned off for this project.',
      }),
    ]);
    expect(transcript(s)).toEqual([
      'user.message: hi',
      'notice: AI chat is turned off for this project.',
    ]);
    expect(s.isSending).toBe(false);
  });

  it('a failed turn shows its friendly error once, replaced by the server notice', () => {
    const failed = run([
      messageSent({ text: 'hi' }),
      turnStarted({ epoch: 0, ...turn }),
      turnFailed({
        ...turn,
        errorCode: 'CM-ERRORS-AI-CHAT-005',
        error: 'No model is set up.',
      }),
    ]);
    expect(transcript(failed)).toEqual([
      'user.message: hi',
      'notice: No model is set up.',
    ]);

    const withServerNotice = run(
      [
        entryUpserted({
          step: 'ai.chat.entry',
          sessionId: 'aics_1',
          entry: {
            id: 'ent_3',
            kind: 'notice',
            text: 'No model is set up.',
            seq: 3,
          },
        }),
      ],
      failed,
    );
    expect(transcript(withServerNotice)).toEqual([
      'user.message: hi',
      'notice: No model is set up.',
    ]);
    expect(withServerNotice.order).toContain('ent_3');
  });

  it('drops the answer of a chat the user already left (stale epoch)', () => {
    const s = run([
      messageSent({ text: 'first chat' }),
      sessionReset({}),
      turnStarted({ epoch: 0, ...turn, channel: 'c' }),
      turnRejected({ epoch: 0, notice: 'late' }),
    ]);
    expect(s).toMatchObject({ sessionId: undefined, order: [], epoch: 1 });
  });
});

describe('aiChat slice — opening a session', () => {
  it('switching loads the transcript in seq order; a finished reply ends a pending turn', () => {
    const s = run([
      sessionSwitched({ sessionId: 'aics_2' }),
      entriesLoaded({
        sessionId: 'aics_2',
        entries: [
          {
            id: 'b',
            kind: 'assistant.text',
            text: 'Hello!',
            seq: 2,
            atUtc: '',
          },
          { id: 'a', kind: 'user.message', text: 'Hi', seq: 1, atUtc: '' },
        ],
      }),
    ]);
    expect(transcript(s)).toEqual([
      'user.message: Hi',
      'assistant.text: Hello!',
    ]);
    expect(s.lastSeq).toBe(2);
  });

  it('ignores a page of a session that is no longer open', () => {
    const s = run([
      sessionSwitched({ sessionId: 'aics_2' }),
      entriesLoaded({
        sessionId: 'aics_1',
        entries: [
          { id: 'a', kind: 'user.message', text: 'x', seq: 1, atUtc: '' },
        ],
      }),
    ]);
    expect(s.order).toEqual([]);
  });

  it('feedback is stored on the entry (and cleared with null)', () => {
    const loaded = run([
      sessionSwitched({ sessionId: 'aics_2' }),
      entriesLoaded({
        sessionId: 'aics_2',
        entries: [
          { id: 'b', kind: 'assistant.text', text: 'x', seq: 1, atUtc: '' },
        ],
      }),
      feedbackSet({ entryId: 'b', feedback: 'up' }),
    ]);
    expect(loaded.entries.b.feedback).toBe('up');
    expect(
      run([feedbackSet({ entryId: 'b', feedback: null })], loaded).entries.b
        .feedback,
    ).toBeNull();
  });
});

describe('routeChatEvent', () => {
  const route = (name: string, payload: unknown) => {
    const actions: { type: string; payload?: unknown }[] = [];
    routeChatEvent(
      ((a: { type: string; payload?: unknown }) => {
        actions.push(a);
        return a;
      }) as never,
      name,
      { eventName: name, payload },
    );
    return actions.map((a) => a.type);
  };

  it('maps each end-user chat event to its action', () => {
    expect(route('ai.chat.turn.token', turn)).toEqual([
      'aiChat/turnTokenReceived',
    ]);
    expect(route('ai.chat.turn.completed', turn)).toEqual([
      'aiChat/turnCompleted',
      'api/invalidateTags',
    ]);
    expect(route('ai.chat.turn.failed', turn)).toEqual(['aiChat/turnFailed']);
    expect(route('ai.chat.progress', { step: 'ai.chat.entry' })).toEqual([
      'aiChat/entryUpserted',
    ]);
    expect(route('ai.chat.session.renamed', { sessionId: 's' })).toEqual([
      'api/invalidateTags',
    ]);
    expect(route('ai.chat.session.deleted', { sessionId: 's' })).toEqual([
      'api/invalidateTags',
      'aiChat/openSessionRemoved',
    ]);
    expect(route('ai.chat.turn.started', turn)).toEqual([]);
    expect(route('something.else', {})).toEqual([]);
  });
});
