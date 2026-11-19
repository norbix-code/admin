/**
 * Full-screen chat — a fixed sheet over the portal: the caller's chats on
 * the left (pinned first, then newest; pin / archive / delete per row), the
 * conversation in the middle. Ported from the dashboard chat's full screen,
 * without the Progress / Context column (model, env and project rows do not
 * exist for an end user). Escape or "Collapse" returns to the drawer.
 */
import { useEffect, useState } from 'react';
import { ConfirmDialog, DropdownMenu } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  useArchiveChatSessionMutation,
  useDeleteChatSessionMutation,
  useGetChatSessionsQuery,
  usePinChatSessionMutation,
} from './chatApi';
import { AssistantPicker, ChatConversation } from './chatPanel';
import { HEADER_BUTTON, useChatTitle } from './hooks';
import {
  fullScreenExited,
  panelClosed,
  selectAiChat,
  sessionReset,
  sessionSwitched,
} from './slice';
import type { EndUserChatSession } from './types';
import {
  ChatIcon,
  CloseIcon,
  CollapseIcon,
  MemoryIcon,
  MoreIcon,
  PinIcon,
  PlusIcon,
} from './icons';
import { sortChatSessions } from './sortChatSessions';

const untitled = (s: EndUserChatSession) => s.title || 'Untitled chat';

const SessionRow = ({
  session,
  isActive,
  onSelect,
  onTogglePin,
  onToggleArchive,
  onDelete,
}: {
  session: EndUserChatSession;
  isActive: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) => (
  <div
    data-testid="chat-session-row"
    className={[
      'group relative rounded-token',
      isActive ? 'bg-info-bg' : 'hover:bg-surface',
    ].join(' ')}
  >
    <button
      type="button"
      onClick={onSelect}
      aria-current={isActive ? 'true' : undefined}
      className="w-full rounded-token px-2.5 py-2 pr-8 text-left"
    >
      <span
        className={[
          'flex items-center gap-1 text-sm',
          isActive ? 'font-semibold text-brand' : 'text-fg',
          session.isArchived ? 'opacity-60' : '',
        ].join(' ')}
      >
        {session.isPinned && (
          <PinIcon aria-label="Pinned" className="shrink-0 text-fg-subtle" />
        )}
        <span className="truncate">{untitled(session)}</span>
      </span>
    </button>
    <div className="absolute right-1 top-1.5 opacity-0 focus-within:opacity-100 group-hover:opacity-100">
      <DropdownMenu
        align="right"
        trigger={
          <span
            className="block rounded-token-sm p-1 text-fg-subtle hover:text-fg"
            title="Conversation options"
          >
            <span className="sr-only">Conversation options</span>
            <MoreIcon />
          </span>
        }
        actions={[
          { label: session.isPinned ? 'Unpin' : 'Pin', onSelect: onTogglePin },
          {
            label: session.isArchived ? 'Unarchive' : 'Archive',
            onSelect: onToggleArchive,
          },
          { label: 'Delete', onSelect: onDelete, danger: true },
        ]}
      />
    </div>
  </div>
);

/** LEFT column — the caller's own chats. */
const ChatSessionsList = () => {
  const dispatch = useAppDispatch();
  const { sessionId } = useAppSelector(selectAiChat);
  const [showArchived, setShowArchived] = useState(false);
  const { data, isLoading, isError } = useGetChatSessionsQuery(
    { includeArchived: showArchived },
    { refetchOnMountOrArgChange: true },
  );
  const sessions = sortChatSessions(data?.sessions ?? []);
  const [pin] = usePinChatSessionMutation();
  const [archive] = useArchiveChatSessionMutation();
  const [remove] = useDeleteChatSessionMutation();
  const [toDelete, setToDelete] = useState<EndUserChatSession>();

  const resetIfActive = (s: EndUserChatSession) => {
    if (s.id === sessionId) dispatch(sessionReset({}));
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border-token bg-app">
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => dispatch(sessionReset({}))}
          className="flex w-full items-center justify-center gap-1.5 rounded-token border border-border-token bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-sm hover:bg-app"
        >
          <PlusIcon />
          New chat
        </button>
      </div>
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">
          Conversations
        </p>
        <label className="flex items-center gap-1 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Archived
        </label>
      </div>
      <nav
        aria-label="Conversations"
        className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3"
      >
        {isLoading && <p className="px-2.5 text-sm text-fg-muted">Loading…</p>}
        {isError && (
          <p className="px-2.5 text-sm text-error-fg">
            Could not load your conversations.
          </p>
        )}
        {!isLoading && !isError && sessions.length === 0 && (
          <p className="px-2.5 text-sm text-fg-muted">No conversations yet.</p>
        )}
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            isActive={s.id === sessionId}
            onSelect={() => dispatch(sessionSwitched({ sessionId: s.id }))}
            onTogglePin={() =>
              void pin({ sessionId: s.id, pinned: !s.isPinned })
            }
            onToggleArchive={async () => {
              try {
                await archive({
                  sessionId: s.id,
                  archived: !s.isArchived,
                }).unwrap();
                if (!s.isArchived) resetIfActive(s);
              } catch {
                /* the list re-syncs on the next fetch */
              }
            }}
            onDelete={() => setToDelete(s)}
          />
        ))}
      </nav>
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(undefined)}
        title="Delete this conversation?"
        body={
          toDelete
            ? `"${untitled(toDelete)}" and its messages are removed for good.`
            : undefined
        }
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          const s = toDelete;
          setToDelete(undefined);
          if (!s) return;
          try {
            await remove({ sessionId: s.id }).unwrap();
            resetIfActive(s);
          } catch {
            /* the list re-syncs on the next fetch */
          }
        }}
      />
    </aside>
  );
};

export const ChatFullScreen = () => {
  const dispatch = useAppDispatch();
  const [showMemory, setShowMemory] = useState(false);
  const title = useChatTitle();

  // Escape collapses back to the drawer — unless an inner popup (menu,
  // dialog) consumed it first.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setTimeout(() => {
        if (!event.defaultPrevented) dispatch(fullScreenExited());
      }, 0);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);

  return (
    <section
      aria-label="Assistant chat"
      className="fixed inset-0 z-50 flex h-dvh flex-col bg-surface"
    >
      <div className="flex items-center gap-2 bg-brand px-4 py-2.5">
        <ChatIcon width={20} height={20} className="shrink-0 text-brand-fg" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-fg">
          {title}
        </h2>
        <AssistantPicker tone="dark" />
        <button
          type="button"
          title="What the assistant remembers"
          aria-label="What the assistant remembers"
          aria-pressed={showMemory}
          onClick={() => setShowMemory((v) => !v)}
          className={HEADER_BUTTON}
        >
          <MemoryIcon />
        </button>
        <button
          type="button"
          title="Collapse to drawer"
          aria-label="Collapse to drawer"
          onClick={() => dispatch(fullScreenExited())}
          className={HEADER_BUTTON}
        >
          <CollapseIcon />
        </button>
        <button
          type="button"
          title="Close"
          aria-label="Close chat"
          onClick={() => dispatch(panelClosed())}
          className={HEADER_BUTTON}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        <ChatSessionsList />
        <main className="flex min-w-0 flex-1 flex-col">
          <ChatConversation showMemory={showMemory} />
        </main>
      </div>
    </section>
  );
};
