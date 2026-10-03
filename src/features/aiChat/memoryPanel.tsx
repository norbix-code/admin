import { Spinner } from '@/components/ui';
import {
  useForgetChatMemoryNoteMutation,
  useGetChatMemoryQuery,
} from './chatApi';
import { TrashIcon } from './icons';

/**
 * "What the assistant remembers" — the caller's own memory notes
 * (GET /ai/chat/memory) with a "forget this" per note. Ported from the
 * dashboard chat's memory panel; there is no project / account split for an
 * end user — every note is theirs.
 */
export const ChatMemoryPanel = () => {
  const { data, isLoading, isError } = useGetChatMemoryQuery();
  const [forget, { isLoading: isForgetting }] =
    useForgetChatMemoryNoteMutation();
  const notes = data?.notes ?? [];

  return (
    <div className="flex-1 overflow-y-auto bg-app p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">
        What the assistant remembers
      </p>
      {isLoading && <Spinner label="Loading…" />}
      {isError && (
        <p className="text-sm text-error-fg">Could not load the memory.</p>
      )}
      {!isLoading && !isError && notes.length === 0 && (
        <p className="text-sm text-fg-muted">Nothing remembered yet.</p>
      )}
      <ul className="space-y-2">
        {notes.map((note) => (
          <li
            key={note.id}
            className="flex items-start justify-between gap-2 rounded-token border border-border-token bg-surface p-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-fg">{note.text}</p>
              <p className="mt-0.5 text-xs text-fg-subtle">{note.kind}</p>
            </div>
            <button
              type="button"
              title="Forget this"
              aria-label="Forget this"
              disabled={isForgetting}
              onClick={() => forget({ noteId: note.id })}
              className="shrink-0 rounded-token-sm p-1 text-fg-subtle hover:bg-error-bg hover:text-error-fg disabled:opacity-50"
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
