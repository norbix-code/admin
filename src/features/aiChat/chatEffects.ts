// Side effects of the chat: route realtime events into the slice, load the
// transcript of the open session, run a turn. Kept out of the components so
// the flow is testable against a real store.

import type { AppDispatch, RootState } from '@/app/store';
import { resolveProjectId, setProjectHeaders } from '@/config/project';
import { chatApi, friendlyError } from './chatApi';
import {
  entriesLoaded,
  entryUpserted,
  messageSent,
  openSessionRemoved,
  turnCompleted,
  turnFailed,
  turnRejected,
  turnStarted,
  turnTokenReceived,
} from './slice';
import type {
  ChatEntryPayload,
  ChatSessionPayload,
  ChatTurnPayload,
  RealtimeEnvelope,
} from './types';

type GetState = () => RootState;

/** One realtime event → the slice / the cached lists. Unknown names are ignored. */
export const routeChatEvent = (
  dispatch: AppDispatch,
  eventName: string,
  envelope: RealtimeEnvelope,
): void => {
  const payload = envelope.payload;
  if (!payload || typeof payload !== 'object') return;

  switch (eventName) {
    case 'ai.chat.turn.token':
      dispatch(turnTokenReceived(payload as ChatTurnPayload));
      return;
    case 'ai.chat.turn.completed':
      dispatch(turnCompleted(payload as ChatTurnPayload));
      // A turn may have renamed a new chat (its first message) — refresh.
      dispatch(chatApi.util.invalidateTags(['ChatSessions', 'ChatMemory']));
      return;
    case 'ai.chat.turn.failed':
      dispatch(turnFailed(payload as ChatTurnPayload));
      return;
    case 'ai.chat.progress':
      dispatch(entryUpserted(payload as ChatEntryPayload));
      return;
    default:
      break;
  }

  if (eventName.startsWith('ai.chat.session.')) {
    dispatch(chatApi.util.invalidateTags(['ChatSessions']));
    if (eventName === 'ai.chat.session.deleted') {
      dispatch(
        openSessionRemoved({
          sessionId: (payload as ChatSessionPayload).sessionId,
        }),
      );
    }
  }
};

/** Re-read the open session's transcript (the truth) and merge it. */
export const loadOpenSession =
  () => async (dispatch: AppDispatch, getState: GetState) => {
    const sessionId = getState().aiChat.sessionId;
    if (!sessionId) return;
    const request = dispatch(
      chatApi.endpoints.getChatEntries.initiate(
        { sessionId },
        { forceRefetch: true, subscribe: false },
      ),
    );
    try {
      const page = await request.unwrap();
      dispatch(entriesLoaded({ sessionId, entries: page.entries ?? [] }));
    } catch {
      /* the stream / the next open retries; the transcript keeps what it has */
    }
  };

/** Send one message: optimistic entry, POST …/turn, then the stream answers. */
export const sendChatMessage =
  (text: string) => async (dispatch: AppDispatch, getState: GetState) => {
    const message = text.trim();
    const before = getState().aiChat;
    if (!message || before.isSending) return;

    dispatch(messageSent({ text: message }));
    const { epoch, sessionId, assistantId } = getState().aiChat;
    try {
      const res = await dispatch(
        chatApi.endpoints.startChatTurn.initiate({
          sessionId,
          assistantId: sessionId ? undefined : assistantId,
          message,
        }),
      ).unwrap();
      if (res.responseStatus && res.responseStatus.isSuccess === false) {
        dispatch(
          turnRejected({
            epoch,
            notice: friendlyError(
              { data: res },
              'The assistant could not start. Please try again.',
            ),
          }),
        );
        return;
      }
      dispatch(
        turnStarted({
          epoch,
          turnId: res.turnId,
          sessionId: res.sessionId,
          channel: res.channel,
        }),
      );
    } catch (error) {
      dispatch(
        turnRejected({
          epoch,
          notice: friendlyError(
            error,
            'The assistant is unreachable right now. Check your connection and try again.',
          ),
        }),
      );
    }
  };

/** Headers of the realtime stream + heartbeat (the RTK base query adds them for REST). */
export const streamHeaders = (token: string | null): Record<string, string> => {
  const h = setProjectHeaders(new Headers(), resolveProjectId());
  if (token) h.set('Authorization', `Bearer ${token}`);
  return Object.fromEntries(h.entries());
};
