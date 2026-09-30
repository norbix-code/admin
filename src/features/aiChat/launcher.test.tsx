// @vitest-environment jsdom
// Visibility rules of the chat (item prompt, line 3): the launcher renders
// only when the public config says aiChat.enabled; the assistant picker only
// when the project has more than one assistant. Plus the message toolbar.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { api } from '@/services/api';
import auth from '@/features/auth/slice';
import config from '@/config/slice';
import project, { projectConfigResolved } from '@/features/project/slice';
import aiChat from './slice';
import { AiChatLauncher } from './launcher';
import { AssistantPicker } from './chatPanel';
import { EntryToolbar } from './entries/EntryToolbar';
import type { ProjectConfig, PublicAiChat } from '@/types/projectConfig';

const makeStore = (aiChatConfig?: PublicAiChat) => {
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
  store.dispatch(
    projectConfigResolved({
      projectId: 'pr_1',
      branding: { displayName: 'Shop' },
      auth: {
        socialProviders: [],
        passkey: false,
        methods: ['email'],
        passwordPolicy: { minLength: 3 },
        exposed: false,
      },
      links: {},
      aiChat: aiChatConfig,
    } as ProjectConfig),
  );
  return store;
};

const renderWith = (ui: React.ReactElement, aiChatConfig?: PublicAiChat) =>
  render(<Provider store={makeStore(aiChatConfig)}>{ui}</Provider>);

beforeEach(() => {
  // RTK Query logs its (jsdom AbortSignal) fetch failures — not under test.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // No gateway in component tests: every call answers 404 quietly.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 404 })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AiChatLauncher', () => {
  it('renders nothing when the project did not enable the chat', () => {
    const { container } = renderWith(<AiChatLauncher />, {
      enabled: false,
      assistants: [],
    });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing on an older gateway without aiChat', () => {
    const { container } = renderWith(<AiChatLauncher />, undefined);
    expect(container.innerHTML).toBe('');
  });

  it('shows the button when enabled, and the drawer after a click', () => {
    renderWith(<AiChatLauncher />, {
      enabled: true,
      assistants: [{ id: 'ast_1', name: 'Helper', welcome: 'Hi! Ask me.' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask the assistant' }));

    expect(
      screen.queryByRole('button', { name: 'Ask the assistant' }),
    ).toBeNull();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'Helper',
    );
    expect(screen.getByText('Hi! Ask me.')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeTruthy();
  });
});

describe('AssistantPicker', () => {
  it('is hidden with one assistant', () => {
    const { container } = renderWith(<AssistantPicker tone="light" />, {
      enabled: true,
      assistants: [{ id: 'ast_1', name: 'Helper' }],
    });
    expect(container.innerHTML).toBe('');
  });

  it('lists every assistant when there are two or more', () => {
    renderWith(<AssistantPicker tone="light" />, {
      enabled: true,
      assistants: [
        { id: 'ast_1', name: 'Helper' },
        { id: 'ast_2', name: 'Billing' },
      ],
    });
    const options = screen
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).textContent);
    expect(options).toEqual(['Helper', 'Billing']);
  });
});

describe('EntryToolbar', () => {
  it('like sends up; clicking the set like again clears it', () => {
    const onFeedback = vi.fn();
    const { rerender } = render(
      <EntryToolbar side="assistant" copyText="x" onFeedback={onFeedback} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    expect(onFeedback).toHaveBeenLastCalledWith('up');

    rerender(
      <EntryToolbar
        side="assistant"
        copyText="x"
        feedback="up"
        onFeedback={onFeedback}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Like' }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    expect(onFeedback).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole('button', { name: 'Dislike' }));
    expect(onFeedback).toHaveBeenLastCalledWith('down');
  });

  it('shows Copy only when there is no feedback handler', () => {
    render(<EntryToolbar side="user" copyText="x" />);
    expect(
      screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Copy']);
  });
});
