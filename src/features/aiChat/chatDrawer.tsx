import { useState } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { fullScreenEntered, panelClosed, sessionReset } from './slice';
import { AssistantPicker, ChatConversation } from './chatPanel';
import { HEADER_BUTTON, useChatTitle } from './hooks';
import { CloseIcon, ExpandIcon, MemoryIcon, PlusIcon } from './icons';

/**
 * The chat side drawer — a right-hand panel that slides in. Not a modal
 * dialog on purpose (same as the dashboard chat): the rest of the portal
 * stays usable while the assistant is open. Only the header X closes it.
 */
export const ChatDrawer = ({ isOpen }: { isOpen: boolean }) => {
  const dispatch = useAppDispatch();
  const [showMemory, setShowMemory] = useState(false);
  const title = useChatTitle();

  return (
    <div
      aria-hidden={!isOpen}
      className="pointer-events-none fixed inset-y-0 right-0 z-40 flex max-w-full pl-10 sm:pl-16"
    >
      <section
        aria-label="Assistant chat"
        className={[
          'w-screen max-w-md transform transition duration-300 ease-in-out',
          isOpen
            ? 'pointer-events-auto translate-x-0'
            : 'pointer-events-none translate-x-full',
        ].join(' ')}
      >
        {isOpen && (
          <div className="flex h-full flex-col overflow-hidden border-l border-border-token bg-surface shadow-xl">
            <div className="flex items-center gap-2 bg-brand px-3 py-2.5">
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
                title="New chat"
                aria-label="New chat"
                onClick={() => {
                  setShowMemory(false);
                  dispatch(sessionReset({}));
                }}
                className={HEADER_BUTTON}
              >
                <PlusIcon />
              </button>
              <button
                type="button"
                title="Expand to full screen"
                aria-label="Expand to full screen"
                onClick={() => dispatch(fullScreenEntered())}
                className={HEADER_BUTTON}
              >
                <ExpandIcon />
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
            <ChatConversation showMemory={showMemory} />
          </div>
        )}
      </section>
    </div>
  );
};
