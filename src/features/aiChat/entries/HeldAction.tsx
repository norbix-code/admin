/**
 * A held action: a tool call that changes something, which the chat did not
 * run. It shows what the assistant wants to run, with the exact arguments,
 * and runs only on this user's own Apply — a call the model cannot make
 * (gateway docs/tasks/ai-chat-held-actions.md). Text in a file, an image or a
 * tool result can therefore propose a change here, never make one.
 */
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { friendlyError, useDecideChatActionMutation } from '../chatApi';
import { entryUpserted } from '../slice';
import type { ActionPendingEntry, ChatActionDecision } from '../types';

const STATUS_TEXT: Record<string, string> = {
  applied: 'Applied.',
  skipped: 'Dismissed. Nothing was run.',
  failed: 'Applied, but it did not succeed.',
};

/** The arguments as indented JSON; the raw text when it is not JSON; nothing when empty. */
export const prettyArguments = (json: string | undefined): string => {
  if (!json || json.trim() === '' || json.trim() === '{}') return '';
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
};

export const HeldAction = ({ entry }: { entry: ActionPendingEntry }) => {
  const dispatch = useAppDispatch();
  const sessionId = useAppSelector((s) => s.aiChat.sessionId);
  const [decide, { isLoading }] = useDecideChatActionMutation();
  const [error, setError] = useState<string>();
  const open = entry.status === 'open';
  const args = prettyArguments(entry.argumentsJson);

  const onDecide = (decision: ChatActionDecision) => {
    if (!sessionId || isLoading) return;
    setError(undefined);
    decide({ sessionId, entryId: entry.id, decision })
      .unwrap()
      .then((answer) =>
        dispatch(
          entryUpserted({
            step: 'ai.chat.entry',
            sessionId,
            entry: {
              id: entry.id,
              kind: 'action.pending',
              status:
                answer?.status ??
                (decision === 'apply' ? 'applied' : 'skipped'),
            },
          }),
        ),
      )
      .catch((e: unknown) =>
        setError(friendlyError(e, 'The action could not be decided.')),
      );
  };

  return (
    <div
      role="group"
      aria-label="An action waits for your approval"
      data-testid="chat-held-action"
      className="rounded-token border border-border-token bg-surface px-3 py-2 text-sm text-fg"
    >
      <p>
        The assistant wants to run{' '}
        <span className="font-mono text-xs">{entry.tool}</span>. It runs only if
        you press Apply.
      </p>
      {args && (
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-token-sm bg-app px-2 py-1 font-mono text-xs text-fg-subtle">
          {args}
        </pre>
      )}
      {open ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={isLoading || !sessionId}
            onClick={() => onDecide('apply')}
            className="inline-flex items-center justify-center rounded-token bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg transition hover:bg-brand-hover disabled:opacity-60"
          >
            Apply
          </button>
          <button
            type="button"
            disabled={isLoading || !sessionId}
            onClick={() => onDecide('dismiss')}
            className="inline-flex items-center justify-center rounded-token border border-border-token bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-sm hover:bg-app disabled:opacity-60"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-fg-subtle">
          {STATUS_TEXT[entry.status] ?? entry.status}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-error-fg">
          {error}
        </p>
      )}
    </div>
  );
};
