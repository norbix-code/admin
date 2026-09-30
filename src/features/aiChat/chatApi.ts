// RTK Query endpoints of the end-user AI chat (`/{v}/ai/chat/*` on the API
// host, through the same-origin BFF proxy). Injected into the app-owned `api`
// slice, so every call carries the bearer token and the project header the
// API host reads (nb-project-id) — see services/api.ts.
//
// The turn answers at once with a turn id; the reply streams on the caller's
// SSE channel (realtime.ts). The entries endpoint is the truth, the stream is
// the accelerator.

import { api } from '@/services/api';
import type {
  GetChatAvailabilityResponse,
  GetChatEntriesResponse,
  ListChatMemoryResponse,
  ListChatSessionsResponse,
  StartChatTurnRequest,
  StartChatTurnResponse,
  ChatEntryFeedback,
} from './types';

export const chatApi = api
  .enhanceEndpoints({
    addTagTypes: ['ChatAvailability', 'ChatSessions', 'ChatMemory'],
  })
  .injectEndpoints({
    endpoints: (builder) => ({
      getChatAvailability: builder.query<GetChatAvailabilityResponse, void>({
        query: () => ({ url: '/ai/chat/availability', method: 'GET' }),
        providesTags: ['ChatAvailability'],
      }),

      getChatSessions: builder.query<
        ListChatSessionsResponse,
        { includeArchived?: boolean }
      >({
        query: ({ includeArchived }) => ({
          url: '/ai/chat/sessions',
          method: 'GET',
          params: { take: 50, includeArchived: includeArchived ?? false },
        }),
        providesTags: ['ChatSessions'],
      }),

      getChatEntries: builder.query<
        GetChatEntriesResponse,
        { sessionId: string; afterSeq?: number }
      >({
        query: ({ sessionId, afterSeq }) => ({
          url: `/ai/chat/sessions/${encodeURIComponent(sessionId)}/entries`,
          method: 'GET',
          params: { take: 200, ...(afterSeq ? { afterSeq } : {}) },
        }),
        // Always a fresh read: the transcript lives in the chat slice; this
        // query only feeds it (open, switch, reconnect).
        keepUnusedDataFor: 0,
      }),

      startChatTurn: builder.mutation<
        StartChatTurnResponse,
        StartChatTurnRequest
      >({
        query: (body) => ({ url: '/ai/chat/turn', method: 'POST', body }),
        // A first turn opens a new chat — the list must show it.
        invalidatesTags: (_result, _error, arg) =>
          arg.sessionId ? [] : ['ChatSessions'],
      }),

      pinChatSession: builder.mutation<
        void,
        { sessionId: string; pinned: boolean }
      >({
        query: ({ sessionId, pinned }) => ({
          url: `/ai/chat/sessions/${encodeURIComponent(sessionId)}/pin`,
          method: 'PUT',
          body: { pinned },
        }),
        invalidatesTags: ['ChatSessions'],
      }),

      archiveChatSession: builder.mutation<
        void,
        { sessionId: string; archived: boolean }
      >({
        query: ({ sessionId, archived }) => ({
          url: `/ai/chat/sessions/${encodeURIComponent(sessionId)}/archive`,
          method: 'PUT',
          body: { archived },
        }),
        invalidatesTags: ['ChatSessions'],
      }),

      deleteChatSession: builder.mutation<void, { sessionId: string }>({
        query: ({ sessionId }) => ({
          url: `/ai/chat/sessions/${encodeURIComponent(sessionId)}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['ChatSessions'],
      }),

      setChatEntryFeedback: builder.mutation<
        void,
        {
          sessionId: string;
          entryId: string;
          feedback: ChatEntryFeedback | null;
        }
      >({
        query: ({ sessionId, entryId, feedback }) => ({
          url: `/ai/chat/sessions/${encodeURIComponent(
            sessionId,
          )}/entries/${encodeURIComponent(entryId)}/feedback`,
          method: 'PUT',
          // Empty = clear (gateway SetEndUserChatEntryFeedbackRequest).
          body: { feedback: feedback ?? '' },
        }),
      }),

      getChatMemory: builder.query<ListChatMemoryResponse, void>({
        query: () => ({
          url: '/ai/chat/memory',
          method: 'GET',
          params: { take: 100 },
        }),
        providesTags: ['ChatMemory'],
      }),

      forgetChatMemoryNote: builder.mutation<void, { noteId: string }>({
        query: ({ noteId }) => ({
          url: `/ai/chat/memory/${encodeURIComponent(noteId)}`,
          method: 'DELETE',
        }),
        invalidatesTags: ['ChatMemory'],
      }),
    }),
  });

export const {
  useGetChatAvailabilityQuery,
  useGetChatSessionsQuery,
  useStartChatTurnMutation,
  usePinChatSessionMutation,
  useArchiveChatSessionMutation,
  useDeleteChatSessionMutation,
  useSetChatEntryFeedbackMutation,
  useGetChatMemoryQuery,
  useForgetChatMemoryNoteMutation,
} = chatApi;

/** The friendly text of a failed call (the gateway's first error message). */
export const friendlyError = (error: unknown, fallback: string): string => {
  const data = (error as { data?: unknown } | undefined)?.data as
    | { responseStatus?: { errors?: { message?: string }[]; message?: string } }
    | undefined;
  const status = data?.responseStatus;
  const message =
    status?.errors
      ?.map((e) => e.message)
      .filter(Boolean)
      .join('\n') || status?.message;
  return message || fallback;
};
