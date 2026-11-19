/**
 * One transcript row, dispatched by `kind` — the same registry pattern as the
 * output factory (cloud entries/EntryRenderers.tsx), cut to what an end user
 * sees: their message, the assistant's reply (through the output factory,
 * streaming while `isStreaming`), and notices. Any other kind (developer
 * kinds, `conversation.snapshot`, future kinds) renders nothing — never an
 * error.
 */
import { memo, useState, type ReactElement } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { AssistantOutput } from '../output/OutputBlocks';
import { useSetChatEntryFeedbackMutation } from '../chatApi';
import { feedbackSet, isLocalEntryId } from '../slice';
import type {
  AssistantTextEntry,
  ChatEntry,
  ChatEntryFeedback,
  NoticeEntry,
  UserMessageEntry,
} from '../types';
import { EntryToolbar } from './EntryToolbar';
import { copyTextOf, hasFeedbackAffordance, viewBlockJsonAt } from './copyText';

/** Like / Dislike for one entry: optimistic, rolled back when the call fails. */
const useEntryFeedback = (
  entry: ChatEntry,
): ((next: ChatEntryFeedback | null) => void) | undefined => {
  const dispatch = useAppDispatch();
  const sessionId = useAppSelector((s) => s.aiChat.sessionId);
  const [setFeedback] = useSetChatEntryFeedbackMutation();
  if (
    !sessionId ||
    isLocalEntryId(entry.id) ||
    !hasFeedbackAffordance(entry.kind)
  ) {
    return undefined;
  }
  return (next) => {
    const previous = entry.feedback ?? null;
    dispatch(feedbackSet({ entryId: entry.id, feedback: next }));
    setFeedback({ sessionId, entryId: entry.id, feedback: next })
      .unwrap()
      .catch(() =>
        dispatch(feedbackSet({ entryId: entry.id, feedback: previous })),
      );
  };
};

const UserMessage = ({ entry }: { entry: UserMessageEntry }) => {
  const onFeedback = useEntryFeedback(entry);
  return (
    <div className="group flex flex-col items-end gap-0.5">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-token-lg bg-brand px-3 py-2 text-sm text-brand-fg">
        {entry.text}
      </div>
      <EntryToolbar
        side="user"
        copyText={copyTextOf(entry) ?? ''}
        feedback={entry.feedback}
        onFeedback={onFeedback}
      />
    </div>
  );
};

const AssistantMessage = ({ entry }: { entry: AssistantTextEntry }) => {
  const onFeedback = useEntryFeedback(entry);
  // Copy over a view block takes that block's JSON (the hovered one).
  const [hoveredBlock, setHoveredBlock] = useState<number>();
  const copyText =
    viewBlockJsonAt(entry.text, hoveredBlock) ?? copyTextOf(entry) ?? '';

  return (
    <div className="group flex flex-col items-start gap-0.5">
      <div
        className="max-w-[85%] rounded-token-lg bg-app px-3 py-2 text-sm text-fg"
        onMouseOver={(e) => {
          const block = (e.target as HTMLElement).closest<HTMLElement>(
            '[data-output-index]',
          );
          setHoveredBlock(
            block ? Number(block.dataset.outputIndex) : undefined,
          );
        }}
        onMouseLeave={() => setHoveredBlock(undefined)}
      >
        {entry.text ? (
          <AssistantOutput text={entry.text} />
        ) : (
          <span className="text-fg-subtle">…</span>
        )}
        {entry.isStreaming && (
          <span
            data-testid="chat-streaming"
            aria-label="The assistant is typing"
            className="ml-0.5 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-fg-subtle align-middle"
          />
        )}
      </div>
      {!entry.isStreaming && (
        <EntryToolbar
          side="assistant"
          copyText={copyText}
          feedback={entry.feedback}
          onFeedback={onFeedback}
        />
      )}
    </div>
  );
};

const Notice = ({ entry }: { entry: NoticeEntry }) => (
  <p
    role={entry.level === 'error' ? 'alert' : 'status'}
    className={
      entry.level === 'error'
        ? 'rounded-token bg-error-bg px-3 py-2 text-sm text-error-fg'
        : 'rounded-token bg-info-bg px-3 py-2 text-sm text-info-fg'
    }
  >
    {entry.text}
  </p>
);

export const EntryView = memo(function EntryView({ id }: { id: string }) {
  const entry = useAppSelector((s) => s.aiChat.entries[id]);
  if (!entry) return null;
  let body: ReactElement | null = null;
  switch (entry.kind) {
    case 'user.message':
      body = <UserMessage entry={entry as UserMessageEntry} />;
      break;
    case 'assistant.text':
      body = <AssistantMessage entry={entry as AssistantTextEntry} />;
      break;
    case 'notice':
      body = <Notice entry={entry as NoticeEntry} />;
      break;
    default:
      return null;
  }
  return (
    <div data-entry-seq={entry.seq} data-entry-kind={entry.kind}>
      {body}
    </div>
  );
});
