// `aiChat` slice — the open conversation of the end-user chat: where it is
// shown (closed / drawer / full screen), which session, the transcript
// (entries by id + order by seq), the running turn, and the realtime status.
//
// Ported from the dashboard chat's slice (cloud src/features/aiChat/slice.ts),
// cut to what an end user has: messages, the streamed reply, notices. The
// transcript is fed from three places, all merging by entry id:
//   1. GET …/entries (the truth — open, switch, reconnect)
//   2. `ai.chat.progress` entry upserts on the caller's channel
//   3. `ai.chat.turn.*` events (token deltas, completed, failed)
// Not persisted (store.ts blacklist): a reload re-reads the entries.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import type {
  ChatEntry,
  ChatEntryFeedback,
  ChatEntryPayload,
  ChatTurnPayload,
} from './types';

export type ChatSurface = 'closed' | 'drawer' | 'fullscreen';

/** Where the realtime stream is: see realtime.ts. `refused` never retries. */
export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'refused';

export interface AiChatState {
  surface: ChatSurface;
  /** The open session; undefined = a new chat (the first turn opens one). */
  sessionId?: string;
  /** The assistant a NEW chat starts with; undefined = the default one. */
  assistantId?: string;
  entries: Record<string, ChatEntry>;
  order: string[];
  lastSeq: number;
  /** A turn was sent and has not completed / failed yet. */
  isSending: boolean;
  turnId?: string;
  /** The caller's SSE channel, learned from the first turn response. */
  channel?: string;
  realtime: RealtimeStatus;
  /** Bumped by every reset / switch: a late answer of an older chat is dropped. */
  epoch: number;
}

const initialState: AiChatState = {
  surface: 'closed',
  entries: {},
  order: [],
  lastSeq: 0,
  isSending: false,
  realtime: 'idle',
  epoch: 0,
};

/** Local (optimistic) entries carry this prefix; the server never uses it. */
const LOCAL_PREFIX = 'local_';
let localCounter = 0;
export const isLocalEntryId = (id: string): boolean =>
  id.startsWith(LOCAL_PREFIX);

const seqOf = (e: ChatEntry | undefined): number =>
  typeof e?.seq === 'number' ? e.seq : 0;

const sortOrder = (state: AiChatState) => {
  state.order.sort((a, b) => {
    const diff = seqOf(state.entries[a]) - seqOf(state.entries[b]);
    // Local entries have seq = lastSeq + 0.5; ties keep insertion order.
    return diff;
  });
};

const putEntry = (state: AiChatState, entry: ChatEntry) => {
  if (!state.entries[entry.id]) state.order.push(entry.id);
  state.entries[entry.id] = entry;
  if (!isLocalEntryId(entry.id)) {
    state.lastSeq = Math.max(state.lastSeq, seqOf(entry));
  }
  sortOrder(state);
};

const removeEntry = (state: AiChatState, id: string) => {
  delete state.entries[id];
  state.order = state.order.filter((x) => x !== id);
};

/** The server's copy of a message we showed optimistically replaces it. */
const dropLocalUserMessage = (state: AiChatState, text: unknown) => {
  const local = state.order.find(
    (id) =>
      isLocalEntryId(id) &&
      state.entries[id]?.kind === 'user.message' &&
      (state.entries[id] as { text?: string }).text === text,
  );
  if (local) removeEntry(state, local);
};

const textOf = (e: ChatEntry | undefined): string =>
  typeof (e as { text?: unknown } | undefined)?.text === 'string'
    ? (e as { text: string }).text
    : '';

/**
 * Merge a patch into an entry. A streaming reply may already hold more text
 * (token deltas) than an entry upsert that was sent earlier — never let the
 * text go backwards while it streams.
 */
const mergeEntry = (
  existing: ChatEntry,
  patch: Partial<ChatEntry>,
): ChatEntry => {
  const merged = { ...existing, ...patch } as ChatEntry;
  const current = textOf(existing);
  const incoming = textOf(patch as ChatEntry);
  if (
    existing.kind === 'assistant.text' &&
    typeof (patch as { text?: unknown }).text === 'string' &&
    (patch as { isStreaming?: boolean }).isStreaming !== false &&
    current.startsWith(incoming) &&
    current.length > incoming.length
  ) {
    (merged as { text: string }).text = current;
  }
  return merged;
};

const acceptsSession = (state: AiChatState, sessionId: string | undefined) =>
  !!sessionId && (!state.sessionId || state.sessionId === sessionId);

const appendNotice = (
  state: AiChatState,
  text: string,
  level: 'info' | 'error',
) => {
  const id = `${LOCAL_PREFIX}notice_${++localCounter}`;
  putEntry(state, {
    id,
    kind: 'notice',
    text,
    level,
    seq: state.lastSeq + 0.9,
    atUtc: new Date().toISOString(),
  });
};

const clearConversation = (state: AiChatState) => {
  state.entries = {};
  state.order = [];
  state.lastSeq = 0;
  state.isSending = false;
  state.turnId = undefined;
  state.epoch += 1;
};

const slice = createSlice({
  name: 'aiChat',
  initialState,
  reducers: {
    panelOpened(state) {
      state.surface = 'drawer';
    },
    panelClosed(state) {
      state.surface = 'closed';
    },
    fullScreenEntered(state) {
      state.surface = 'fullscreen';
    },
    fullScreenExited(state) {
      state.surface = 'drawer';
    },
    /** "New chat" — optionally with another assistant. */
    sessionReset(state, action: PayloadAction<{ assistantId?: string }>) {
      clearConversation(state);
      state.sessionId = undefined;
      state.assistantId = action.payload.assistantId;
    },
    sessionSwitched(state, action: PayloadAction<{ sessionId: string }>) {
      if (state.sessionId === action.payload.sessionId) return;
      clearConversation(state);
      state.sessionId = action.payload.sessionId;
      state.assistantId = undefined;
    },
    /** A page of GET …/entries for the open session (merge by id). */
    entriesLoaded(
      state,
      action: PayloadAction<{ sessionId: string; entries: ChatEntry[] }>,
    ) {
      if (state.sessionId !== action.payload.sessionId) return;
      for (const entry of action.payload.entries) {
        if (entry.kind === 'user.message') {
          dropLocalUserMessage(state, (entry as { text?: string }).text);
        }
        const existing = state.entries[entry.id];
        putEntry(state, existing ? mergeEntry(existing, entry) : entry);
        // A finished reply in the truth ends the turn we were waiting for.
        if (
          state.isSending &&
          (entry.kind === 'assistant.text' || entry.kind === 'notice') &&
          !(entry as { isStreaming?: boolean }).isStreaming &&
          seqOf(entry) > lastUserSeq(state)
        ) {
          state.isSending = false;
          state.turnId = undefined;
        }
      }
    },
    /** The user pressed Send: show the message now (optimistic). */
    messageSent(state, action: PayloadAction<{ text: string }>) {
      putEntry(state, {
        id: `${LOCAL_PREFIX}msg_${++localCounter}`,
        kind: 'user.message',
        text: action.payload.text,
        seq: state.lastSeq + 0.5,
        atUtc: new Date().toISOString(),
      });
      state.isSending = true;
    },
    /** POST …/turn answered: the turn runs; a new chat got its id. */
    turnStarted(
      state,
      action: PayloadAction<{
        epoch: number;
        turnId?: string;
        sessionId?: string;
        channel?: string;
      }>,
    ) {
      if (action.payload.epoch !== state.epoch) return;
      state.turnId = action.payload.turnId;
      if (action.payload.sessionId) state.sessionId = action.payload.sessionId;
      if (action.payload.channel) state.channel = action.payload.channel;
    },
    /** POST …/turn itself failed (validation, chat off, network). */
    turnRejected(
      state,
      action: PayloadAction<{ epoch: number; notice: string }>,
    ) {
      if (action.payload.epoch !== state.epoch) return;
      state.isSending = false;
      state.turnId = undefined;
      appendNotice(state, action.payload.notice, 'error');
    },
    /** `ai.chat.turn.token`: append a delta to the streaming reply. */
    turnTokenReceived(state, action: PayloadAction<ChatTurnPayload>) {
      const { sessionId, entryId, text } = action.payload;
      if (!acceptsSession(state, sessionId) || !entryId || !text) return;
      const entry = state.entries[entryId];
      if (!entry) {
        putEntry(state, {
          id: entryId,
          kind: 'assistant.text',
          text,
          isStreaming: true,
          seq: state.lastSeq + 1,
          atUtc: new Date().toISOString(),
        });
        return;
      }
      if (entry.kind !== 'assistant.text') return;
      // A reply that is already final (read from the entries endpoint, or
      // completed) holds every token — a late delta would double the text.
      if ((entry as { isStreaming?: boolean }).isStreaming === false) return;
      (entry as { text: string }).text = textOf(entry) + text;
      (entry as { isStreaming?: boolean }).isStreaming = true;
    },
    /** `ai.chat.turn.completed`: the whole reply; the turn is over. */
    turnCompleted(state, action: PayloadAction<ChatTurnPayload>) {
      const { sessionId, entryId, text } = action.payload;
      if (!acceptsSession(state, sessionId)) return;
      if (entryId) {
        const existing = state.entries[entryId];
        const reply = {
          id: entryId,
          kind: 'assistant.text',
          text: text ?? textOf(existing),
          isStreaming: false,
        } as ChatEntry;
        putEntry(
          state,
          existing
            ? ({ ...existing, ...reply } as ChatEntry)
            : ({
                ...reply,
                seq: state.lastSeq + 1,
                atUtc: new Date().toISOString(),
              } as ChatEntry),
        );
      }
      state.isSending = false;
      state.turnId = undefined;
    },
    /** `ai.chat.turn.failed`: the friendly error lands in the transcript. */
    turnFailed(state, action: PayloadAction<ChatTurnPayload>) {
      const { sessionId, error } = action.payload;
      if (!acceptsSession(state, sessionId)) return;
      state.isSending = false;
      state.turnId = undefined;
      // The server also appends a `notice` entry; show ours only until then.
      const hasServerNotice = state.order.some(
        (id) =>
          !isLocalEntryId(id) &&
          state.entries[id]?.kind === 'notice' &&
          seqOf(state.entries[id]) > lastUserSeq(state),
      );
      if (!hasServerNotice) {
        appendNotice(
          state,
          error || 'The assistant could not answer. Please try again.',
          'error',
        );
      }
    },
    /** `ai.chat.progress` / `ai.chat.entry`: upsert one entry in place. */
    entryUpserted(state, action: PayloadAction<ChatEntryPayload>) {
      const { sessionId, seq, entry, step } = action.payload;
      if (step !== 'ai.chat.entry' || !entry?.id) return;
      if (!acceptsSession(state, sessionId)) return;
      const existing = state.entries[entry.id];
      if (existing) {
        putEntry(state, mergeEntry(existing, entry));
        return;
      }
      if (entry.kind === 'user.message') {
        dropLocalUserMessage(state, (entry as { text?: string }).text);
      }
      if (entry.kind === 'notice') {
        // The server's notice replaces our local copy of the same failure.
        for (const id of [...state.order]) {
          if (isLocalEntryId(id) && state.entries[id]?.kind === 'notice') {
            removeEntry(state, id);
          }
        }
      }
      putEntry(state, {
        ...entry,
        seq:
          typeof entry.seq === 'number'
            ? entry.seq
            : (seq ?? state.lastSeq + 1),
        atUtc: entry.atUtc ?? new Date().toISOString(),
      } as ChatEntry);
    },
    /** Like / Dislike (optimistic; rolled back by `feedbackSet` with the old value). */
    feedbackSet(
      state,
      action: PayloadAction<{
        entryId: string;
        feedback: ChatEntryFeedback | null;
      }>,
    ) {
      const entry = state.entries[action.payload.entryId];
      if (entry) entry.feedback = action.payload.feedback;
    },
    realtimeStatusChanged(state, action: PayloadAction<RealtimeStatus>) {
      state.realtime = action.payload;
    },
    /** A session event said the open session was deleted / archived elsewhere. */
    openSessionRemoved(state, action: PayloadAction<{ sessionId: string }>) {
      if (state.sessionId !== action.payload.sessionId) return;
      clearConversation(state);
      state.sessionId = undefined;
    },
  },
  extraReducers: (builder) => {
    // Sign-out clears the chat (the root reducer also purges on auth/reset).
    builder.addCase('auth/signedOut', () => initialState);
  },
});

function lastUserSeq(state: AiChatState): number {
  let max = 0;
  for (const id of state.order) {
    const e = state.entries[id];
    if (e?.kind === 'user.message') max = Math.max(max, seqOf(e));
  }
  return max;
}

export const {
  panelOpened,
  panelClosed,
  fullScreenEntered,
  fullScreenExited,
  sessionReset,
  sessionSwitched,
  entriesLoaded,
  messageSent,
  turnStarted,
  turnRejected,
  turnTokenReceived,
  turnCompleted,
  turnFailed,
  entryUpserted,
  feedbackSet,
  realtimeStatusChanged,
  openSessionRemoved,
} = slice.actions;

export const selectAiChat = (state: RootState): AiChatState => state.aiChat;
export const selectChatEntries = (state: RootState) => state.aiChat.entries;
export const selectChatOrder = (state: RootState) => state.aiChat.order;

export const aiChatInitialState = initialState;
export default slice.reducer;
