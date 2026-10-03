import type { EndUserChatSession } from './types';

/**
 * Chats list order (matches the gateway list): pinned first, then the most
 * recently active within each group. Ported from the dashboard chat.
 */
export const sortChatSessions = (
  sessions: EndUserChatSession[],
): EndUserChatSession[] =>
  [...sessions].sort((a, b) => {
    const pinDiff = Number(b.isPinned ?? false) - Number(a.isPinned ?? false);
    if (pinDiff !== 0) return pinDiff;
    return (
      new Date(b.updatedAtUtc).getTime() - new Date(a.updatedAtUtc).getTime()
    );
  });
