// Shared chat hooks + header style (kept out of the component files so they
// export components only).

import { useAppSelector } from '@/app/hooks';
import { selectPublicAiChat } from '@/features/project/slice';
import {
  useGetChatAvailabilityQuery,
  useGetChatSessionsQuery,
} from './chatApi';
import { selectAiChat } from './slice';

/**
 * The assistant of the open conversation: the session's own, else the one
 * picked for a new chat, else the project's default, else the first.
 */
export const useActiveAssistant = () => {
  const { assistants } = useAppSelector(selectPublicAiChat);
  const { sessionId, assistantId } = useAppSelector(selectAiChat);
  const { data: availability } = useGetChatAvailabilityQuery();
  const { data: sessions } = useGetChatSessionsQuery({});
  const sessionAssistant = sessionId
    ? sessions?.sessions.find((s) => s.id === sessionId)?.assistantId
    : undefined;
  const id =
    sessionAssistant ??
    assistantId ??
    availability?.defaultAssistantId ??
    assistants[0]?.id;
  return {
    assistants,
    active: assistants.find((a) => a.id === id) ?? assistants[0],
  };
};

export const HEADER_BUTTON =
  'rounded-token-sm p-1 text-brand-fg opacity-80 hover:bg-brand-hover hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-fg';

/** The open chat's title, else the assistant's name, else "Assistant". */
export const useChatTitle = (): string => {
  const { sessionId } = useAppSelector(selectAiChat);
  const { data } = useGetChatSessionsQuery({});
  const { active } = useActiveAssistant();
  const title = sessionId
    ? data?.sessions.find((s) => s.id === sessionId)?.title
    : undefined;
  return title || active?.name || 'Assistant';
};
