/**
 * Assistant-output block model — the "smart factory" contract.
 *
 * An assistant message is parsed once into a list of typed OutputBlocks;
 * the renderer registry in `OutputBlocks.tsx` maps each kind to a
 * component. Adding a new output kind (mjml live preview, json viewer,
 * diff, table…) = add a kind here, teach `parseAssistantOutput` to
 * detect it, register a renderer. Nothing else changes.
 *
 * Pure module (no React) so detection is unit-testable with vitest.
 */

/** Structured "view block" formats the agent can request (```norbix-view type=…```). */
export type ViewType = 'tree' | 'table' | 'json' | 'yaml';

export type OutputBlock =
  /** Regular prose — rendered as markdown. */
  | { kind: 'markdown'; text: string }
  /** Fenced code block (```lang … ```). */
  | { kind: 'code'; language: string; code: string }
  /**
   * MJML email template source. Detected so a future renderer can show a
   * live preview; for now it renders like a code block.
   */
  | { kind: 'mjml'; code: string }
  /**
   * Structured data the agent asked the UI to render as a component —
   * ```norbix-view type=tree|table|json|yaml``` with JSON inside. Unknown
   * types fall back to a JSON preview in the renderer.
   */
  | { kind: 'view'; viewType: string; raw: string };

// Capture the WHOLE info-string (up to the newline) so params like
// `norbix-view type=tree` survive; the language/kind is its first token.
const FENCE = /```([^\n]*)\r?\n?([\s\S]*?)```/g;

/** Marker that opens a structured view block. */
const VIEW_TAG = 'norbix-view';

const isMjml = (language: string, code: string): boolean =>
  language.toLowerCase() === 'mjml' || code.trimStart().startsWith('<mjml');

const isViewInfo = (info: string): boolean => {
  const first = info.split(/\s+/)[0]?.toLowerCase() ?? '';
  return first === VIEW_TAG || first.startsWith(`${VIEW_TAG}:`);
};

/** Reads the view type from the info-string (`type=tree` or `norbix-view:tree`). */
const parseViewType = (info: string): string => {
  const byParam = info.match(/type\s*=\s*([\w-]+)/i);
  if (byParam) return byParam[1].toLowerCase();
  const byColon = info.match(/norbix-view:([\w-]+)/i);
  if (byColon) return byColon[1].toLowerCase();
  return 'json';
};

/** Splits a raw assistant message into typed output blocks. */
export const parseAssistantOutput = (text: string): OutputBlock[] => {
  const blocks: OutputBlock[] = [];
  let last = 0;

  const pushMarkdown = (chunk: string) => {
    if (chunk.trim() !== '')
      blocks.push({ kind: 'markdown', text: chunk.trim() });
  };

  for (const match of text.matchAll(FENCE)) {
    const index = match.index ?? 0;
    pushMarkdown(text.slice(last, index));

    const info = (match[1] ?? '').trim();
    const body = (match[2] ?? '').replace(/\n$/, '');
    const language = info.split(/\s+/)[0]?.toLowerCase() ?? '';

    if (isViewInfo(info)) {
      blocks.push({ kind: 'view', viewType: parseViewType(info), raw: body });
    } else if (isMjml(language, body)) {
      blocks.push({ kind: 'mjml', code: body });
    } else {
      blocks.push({ kind: 'code', language, code: body });
    }

    last = index + match[0].length;
  }
  pushMarkdown(text.slice(last));

  // A message that is nothing but whitespace still needs one block so the
  // bubble isn't empty.
  if (blocks.length === 0) blocks.push({ kind: 'markdown', text });
  return blocks;
};
