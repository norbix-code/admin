/**
 * The conversation body — the entries list and the composer — hosted by the
 * drawer and by the middle column of the full screen. Ported from the
 * dashboard chat (cloud chatPanel.tsx), without attachments, question / plan
 * cards, briefs and work items. The header's memory toggle swaps the body for
 * the memory panel.
 */
import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { loadOpenSession, sendChatMessage } from './chatEffects';
import { EntryView } from './entries/EntryView';
import { ChatMemoryPanel } from './memoryPanel';
import { SendIcon } from './icons';
import { selectAiChat, sessionReset } from './slice';
import { useActiveAssistant } from './hooks';

/** Shown only when the project has more than one assistant; a pick starts a new chat. */
export const AssistantPicker = ({ tone }: { tone: 'dark' | 'light' }) => {
  const dispatch = useAppDispatch();
  const { assistants, active } = useActiveAssistant();
  if (assistants.length < 2) return null;
  return (
    <label className="flex items-center gap-1 text-xs">
      <span className="sr-only">Assistant</span>
      <select
        aria-label="Assistant"
        value={active?.id ?? ''}
        onChange={(e) =>
          dispatch(sessionReset({ assistantId: e.target.value }))
        }
        className={
          tone === 'dark'
            ? 'max-w-40 truncate rounded-token-sm border-0 bg-brand-hover py-0.5 pl-2 pr-6 text-xs text-brand-fg focus:ring-1 focus:ring-brand-fg'
            : 'max-w-40 truncate rounded-token-sm border border-border-token bg-surface py-0.5 pl-2 pr-6 text-xs text-fg'
        }
      >
        {assistants.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
};

export const ChatConversation = ({ showMemory }: { showMemory: boolean }) => {
  const dispatch = useAppDispatch();
  const { sessionId, order, entries, isSending, realtime } =
    useAppSelector(selectAiChat);
  const { active } = useActiveAssistant();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  // Follow the newest entry only while the user is already at the bottom —
  // reading an older answer must not be yanked down by a streaming token.
  const atBottomRef = useRef(true);

  // Opening an existing chat (switch, reload of the list) reads its transcript.
  useEffect(() => {
    if (sessionId) void dispatch(loadOpenSession());
  }, [sessionId, dispatch]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [order, entries]);

  if (showMemory) return <ChatMemoryPanel />;

  const refused = realtime === 'refused';
  const onSend = () => {
    if (!draft.trim() || isSending || refused) return;
    const text = draft;
    setDraft('');
    atBottomRef.current = true;
    void dispatch(sendChatMessage(text));
  };

  return (
    <>
      {refused && (
        <p
          role="alert"
          className="border-b border-border-token bg-error-bg px-3 py-2 text-sm text-error-fg"
        >
          Chat unavailable. Reload the page to try again.
        </p>
      )}

      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          if (el) {
            atBottomRef.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }
        }}
        data-testid="chat-transcript"
        className="flex-1 space-y-3 overflow-y-auto bg-surface p-3"
      >
        {order.length === 0 && (
          <p className="whitespace-pre-wrap pt-8 text-center text-sm text-fg-muted">
            {active?.welcome || 'How can I help?'}
          </p>
        )}
        {order.map((id) => (
          <EntryView key={id} id={id} />
        ))}
      </div>

      <div className="flex items-end gap-1.5 border-t border-border-token bg-app p-2">
        <textarea
          rows={1}
          value={draft}
          aria-label="Message"
          placeholder={
            active ? `Message ${active.name}…` : 'Ask the assistant…'
          }
          disabled={refused}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          className="max-h-28 flex-1 resize-none rounded-token border border-border-token bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
        />
        <button
          type="button"
          title="Send"
          aria-label="Send"
          disabled={isSending || refused || !draft.trim()}
          onClick={onSend}
          className="rounded-token bg-brand p-2 text-brand-fg hover:bg-brand-hover disabled:opacity-50"
        >
          <SendIcon width={20} height={20} />
        </button>
      </div>
    </>
  );
};
