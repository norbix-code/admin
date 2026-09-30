/**
 * Wire shapes of the end-user AI chat on the API host (`/{v}/ai/chat/*`,
 * gateway item api-chat-endpoints). JSON is camelCase; absent = null.
 *
 * Only what the end-user surface uses is typed. The developer-only entry
 * kinds of the dashboard chat (plan, run.step, question cards, work items,
 * briefs, delegations) never reach an end user and are not ported — an
 * unknown kind renders as a quiet fallback, never an error.
 */

export interface ResponseStatus {
  isSuccess?: boolean;
  errors?: { message?: string; errorCode?: string }[];
}

export interface EndUserChatAssistant {
  id: string;
  name: string;
  welcomeMessage?: string | null;
  isDefault: boolean;
  memoryEnabled: boolean;
}

export interface GetChatAvailabilityResponse {
  enabled: boolean;
  available: boolean;
  /** When not available: the CM-ERRORS-AI-CHAT-… code a turn would fail with. */
  reason?: string | null;
  defaultAssistantId?: string | null;
  assistants: EndUserChatAssistant[];
  responseStatus?: ResponseStatus;
}

export interface EndUserChatSession {
  id: string;
  assistantId?: string | null;
  title?: string | null;
  isPinned: boolean;
  isArchived: boolean;
  lastSeq: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ListChatSessionsResponse {
  sessions: EndUserChatSession[];
}

export type ChatEntryFeedback = 'up' | 'down';

export interface ChatEntryBase {
  id: string;
  kind: string;
  seq: number;
  atUtc: string;
  feedback?: ChatEntryFeedback | null;
}

export interface UserMessageEntry extends ChatEntryBase {
  kind: 'user.message';
  text: string;
  attachments?: { id: string; name: string }[];
}

export interface AssistantTextEntry extends ChatEntryBase {
  kind: 'assistant.text';
  text: string;
  isStreaming?: boolean;
}

export interface NoticeEntry extends ChatEntryBase {
  kind: 'notice';
  text: string;
  level: 'info' | 'warning' | 'error' | string;
}

/** A kind this build does not render (developer kinds, future kinds). */
export interface UnknownEntry extends ChatEntryBase {
  [field: string]: unknown;
}

export type ChatEntry =
  | UserMessageEntry
  | AssistantTextEntry
  | NoticeEntry
  | UnknownEntry;

export interface GetChatEntriesResponse {
  sessionId?: string;
  entries: ChatEntry[];
  lastSeq: number;
  hasMore: boolean;
}

export interface StartChatTurnRequest {
  sessionId?: string;
  assistantId?: string;
  message: string;
}

export interface StartChatTurnResponse {
  turnId?: string;
  sessionId?: string;
  /** The caller's own SSE channel, `ai-chat:{projectId}:{authId}`. */
  channel?: string;
  responseStatus?: ResponseStatus;
}

export interface EndUserChatMemoryNote {
  id: string;
  sessionId: string;
  kind: string;
  text: string;
  createdAtUtc: string;
}

export interface ListChatMemoryResponse {
  notes: EndUserChatMemoryNote[];
}

/* ───────────────────────── Realtime (SSE) ─────────────────────────
 *
 * Every event is a ServiceStack frame `data: cmd.{eventName} {envelope}`;
 * the envelope is `{ channel, eventName, projectId, createdAtUtc, payload }`.
 */

export interface RealtimeEnvelope<P = unknown> {
  channel?: string;
  eventName: string;
  projectId?: string;
  createdAtUtc?: string;
  payload?: P;
}

/** `ai.chat.turn.started | token | tool | completed | failed`. */
export interface ChatTurnPayload {
  turnId: string;
  sessionId: string;
  /** token / completed: the assistant.text entry. */
  entryId?: string | null;
  /** token: the delta; completed: the whole reply. */
  text?: string | null;
  tool?: string | null;
  status?: string | null;
  errorCode?: string | null;
  /** failed: the friendly message. */
  error?: string | null;
}

/** `ai.chat.session.created | renamed | pinned | … | deleted`. */
export interface ChatSessionPayload {
  sessionId: string;
  assistantId?: string | null;
  title?: string | null;
  isPinned: boolean;
  isArchived: boolean;
}

/** `ai.chat.progress` with step `ai.chat.entry`: upsert one entry in place. */
export interface ChatEntryPayload {
  step: string;
  sessionId: string;
  seq?: number | null;
  /** A full wire entry, or a patch: id + kind + only the changed fields. */
  entry?: (Partial<ChatEntry> & { id: string; kind: string }) | null;
}
