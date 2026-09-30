/**
 * Message affordances: Copy, Like / Dislike — one small row under a message.
 * Ported from the dashboard chat (cloud entries/EntryToolbar.tsx).
 *
 * - Copy writes raw text (copyText.ts); over a view block the renderer hands
 *   in that block's JSON instead.
 * - Like / Dislike show a filled icon when set; clicking the set one again
 *   clears it (`next = null`). The call to the feedback endpoint and the
 *   rollback live in the caller (EntryView) — this row only reports `next`.
 * - Quiet until the message is hovered or a button has focus; a set thumb
 *   keeps the row visible. Every control is a real <button> with an
 *   aria-label and a focus ring.
 */
import { useEffect, useRef, useState } from 'react';
import type { ChatEntryFeedback } from '../types';
import { CheckIcon, CopyIcon, ThumbDownIcon, ThumbUpIcon } from '../icons';

const cx = (...p: Array<string | false | undefined>) =>
  p.filter(Boolean).join(' ');

const TOOL_BUTTON =
  'rounded-token-sm p-1 text-fg-subtle hover:bg-app hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50';

const COPIED_FOR_MS = 1500;

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), COPIED_FOR_MS);
    } catch {
      /* clipboard blocked (permissions / insecure origin) — nothing to show */
    }
  };

  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : 'Copy'}
      title={copied ? 'Copied' : 'Copy'}
      onClick={onCopy}
      className={cx(TOOL_BUTTON, copied && 'text-success-fg')}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
};

export interface EntryToolbarProps {
  copyText: string;
  feedback?: ChatEntryFeedback | null;
  /** Absent = the row shows Copy only. */
  onFeedback?: (next: ChatEntryFeedback | null) => void;
  side: 'user' | 'assistant';
}

export const EntryToolbar = ({
  copyText,
  feedback,
  onFeedback,
  side,
}: EntryToolbarProps) => {
  const liked = feedback === 'up';
  const disliked = feedback === 'down';

  return (
    <div
      role="toolbar"
      aria-label="Message actions"
      className={cx(
        'flex items-center gap-0.5 transition-opacity',
        side === 'user' ? 'justify-end' : 'justify-start',
        liked || disliked
          ? 'opacity-100'
          : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
      )}
    >
      <CopyButton text={copyText} />
      {onFeedback && (
        <>
          <button
            type="button"
            aria-label="Like"
            aria-pressed={liked}
            title={liked ? 'Liked — click to clear' : 'Like'}
            onClick={() => onFeedback(liked ? null : 'up')}
            className={cx(TOOL_BUTTON, liked && 'text-brand')}
          >
            <ThumbUpIcon filled={liked} />
          </button>
          <button
            type="button"
            aria-label="Dislike"
            aria-pressed={disliked}
            title={disliked ? 'Disliked — click to clear' : 'Dislike'}
            onClick={() => onFeedback(disliked ? null : 'down')}
            className={cx(TOOL_BUTTON, disliked && 'text-brand')}
          >
            <ThumbDownIcon filled={disliked} />
          </button>
        </>
      )}
    </div>
  );
};
