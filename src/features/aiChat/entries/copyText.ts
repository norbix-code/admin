// What "Copy" writes for an entry — the RAW text, never rendered markdown.
// Ported from the dashboard chat's EntryToolbar (copyTextOf / viewBlockJsonAt),
// cut to the end-user kinds. Pure, so it is unit-testable.

import { parseAssistantOutput } from '../output/blocks';
import type { ChatEntry } from '../types';

/** Kinds that get Like / Dislike: the two message kinds. */
export const hasFeedbackAffordance = (kind: string): boolean =>
  kind === 'user.message' || kind === 'assistant.text';

/** `undefined` = no Copy for this kind (a notice is UI chrome, not content). */
export const copyTextOf = (entry: ChatEntry): string | undefined => {
  switch (entry.kind) {
    case 'user.message':
    case 'assistant.text':
      return (entry as { text?: string }).text ?? '';
    default:
      return undefined;
  }
};

const prettyJson = (raw: string): string => {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

/**
 * The JSON of the output block at `index` when it is a view block
 * (```norbix-view …```), pretty-printed; `undefined` for any other block.
 * `index` is the `data-output-index` the renderer stamps on each block.
 */
export const viewBlockJsonAt = (
  text: string,
  index: number | undefined,
): string | undefined => {
  if (index === undefined || index < 0) return undefined;
  const block = parseAssistantOutput(text ?? '')[index];
  if (!block || block.kind !== 'view') return undefined;
  return prettyJson(block.raw);
};
