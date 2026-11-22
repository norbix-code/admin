// @vitest-environment jsdom
// A held action (gateway docs/tasks/ai-chat-held-actions.md): the chat did not
// run a tool that changes something; the user sees what it would run and runs
// it only with their own Apply.
//
// The decide hook is mocked (the starter's convention, see
// signInScreens.test.tsx): RTK Query cannot fetch under jsdom here. What is
// under test is the card: what it shows, what it sends, what it does after.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { api } from '@/services/api';

const gateway = vi.hoisted(() => ({
  sent: [] as unknown[],
  answer: { status: 'applied' } as { status?: string },
  refuse: undefined as unknown,
}));

vi.mock('../chatApi', async (original) => ({
  ...(await original<typeof import('../chatApi')>()),
  useDecideChatActionMutation: () => [
    (arg: unknown) => {
      gateway.sent.push(arg);
      return {
        unwrap: async () => {
          if (gateway.refuse) throw gateway.refuse;
          return gateway.answer;
        },
      };
    },
    { isLoading: false },
  ],
}));
import auth from '@/features/auth/slice';
import config from '@/config/slice';
import project from '@/features/project/slice';
import aiChat, { entriesLoaded, sessionSwitched } from '../slice';
import { EntryView } from './EntryView';
import { prettyArguments } from './HeldAction';
import type { ActionPendingEntry } from '../types';

const held = (status: string): ActionPendingEntry => ({
  id: 'ent_7',
  kind: 'action.pending',
  seq: 7,
  atUtc: '2026-11-22T09:00:00Z',
  tool: 'team_notes__create_note',
  argumentsJson: '{"title":"Ship v2","priority":3}',
  status,
});

const renderHeld = (status: string) => {
  const store = configureStore({
    reducer: combineReducers({
      auth,
      config,
      project,
      aiChat,
      [api.reducerPath]: api.reducer,
    }),
    middleware: (m) => m().concat(api.middleware),
  });
  store.dispatch(sessionSwitched({ sessionId: 'aics_1' }));
  store.dispatch(
    entriesLoaded({ sessionId: 'aics_1', entries: [held(status)] }),
  );
  render(
    <Provider store={store}>
      <EntryView id="ent_7" />
    </Provider>,
  );
  return store;
};

beforeEach(() => {
  gateway.sent = [];
  gateway.answer = { status: 'applied' };
  gateway.refuse = undefined;
});
afterEach(() => {
  cleanup();
});

describe('HeldAction', () => {
  it('shows what would run, with its arguments, and runs nothing by itself', () => {
    renderHeld('open');

    expect(screen.getByTestId('chat-held-action').textContent).toContain(
      'team_notes__create_note',
    );
    expect(screen.getByText(/"title": "Ship v2"/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    expect(gateway.sent).toHaveLength(0);
  });

  it('Apply sends the user decision for this entry and shows the new status', async () => {
    const store = renderHeld('open');

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(screen.getByText('Applied.')).toBeTruthy());
    expect(gateway.sent).toEqual([
      { sessionId: 'aics_1', entryId: 'ent_7', decision: 'apply' },
    ]);
    expect(
      (store.getState().aiChat.entries.ent_7 as ActionPendingEntry).status,
    ).toBe('applied');
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  });

  it('Dismiss runs nothing and says so', async () => {
    gateway.answer = { status: 'skipped' };
    renderHeld('open');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() =>
      expect(screen.getByText('Dismissed. Nothing was run.')).toBeTruthy(),
    );
    expect(gateway.sent).toEqual([
      { sessionId: 'aics_1', entryId: 'ent_7', decision: 'dismiss' },
    ]);
  });

  it('a refusal from the gateway is shown and the buttons stay', async () => {
    gateway.refuse = {
      status: 409,
      data: {
        responseStatus: {
          errors: [{ message: 'This action was already decided (applied).' }],
        },
      },
    };
    renderHeld('open');

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'This action was already decided (applied).',
      ),
    );
    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
  });

  it('a decided action has no buttons', () => {
    renderHeld('failed');

    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(screen.getByText('Applied, but it did not succeed.')).toBeTruthy();
  });

  it('prettyArguments indents JSON, keeps other text, and hides an empty object', () => {
    expect(prettyArguments('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyArguments('not json')).toBe('not json');
    expect(prettyArguments('{}')).toBe('');
  });
});
