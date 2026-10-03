import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectPublicAiChat } from '@/features/project/slice';
import { ChatDrawer } from './chatDrawer';
import { ChatFullScreen } from './chatFullScreen';
import { ChatIcon } from './icons';
import { panelOpened, selectAiChat } from './slice';
import { useChatRealtime } from './useChatRealtime';

/**
 * Floating chat button + the drawer / full screen it opens. Mounted once in
 * the signed-in layout. Renders NOTHING (and queries nothing) unless the
 * public project config says `aiChat.enabled` with at least one assistant —
 * the chat is invisible when the project did not turn it on.
 */
export const AiChatLauncher = () => {
  const { enabled, assistants } = useAppSelector(selectPublicAiChat);
  if (!enabled || assistants.length === 0) return null;
  return <EnabledChat />;
};

const EnabledChat = () => {
  const dispatch = useAppDispatch();
  const { surface } = useAppSelector(selectAiChat);
  useChatRealtime();

  if (surface === 'fullscreen') return <ChatFullScreen />;

  return (
    <>
      <ChatDrawer isOpen={surface === 'drawer'} />
      {surface === 'closed' && (
        <button
          type="button"
          title="Ask the assistant"
          aria-label="Ask the assistant"
          onClick={() => dispatch(panelOpened())}
          className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-brand-fg shadow-lg hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <ChatIcon width={24} height={24} />
        </button>
      )}
    </>
  );
};
