/**
 * Minimal, dependency-free markdown parser for AI chat output.
 *
 * Pure functions (no React) so the block/span structure is unit-testable
 * with vitest. The renderer lives in `OutputBlocks.tsx`. Scope is the
 * subset LLMs actually emit in chat: headings, bullet/numbered lists,
 * paragraphs, **bold**, *italic*, `inline code`, [links](url).
 * Anything unrecognized degrades gracefully to plain text — never throws.
 *
 * If chat output ever outgrows this subset, swap the implementation for
 * react-markdown behind the same `MdBlock`/`MdSpan` contract.
 */

export type MdSpan =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string };

export type MdBlock =
  | { type: 'heading'; level: number; spans: MdSpan[] }
  | { type: 'paragraph'; spans: MdSpan[] }
  | { type: 'list'; ordered: boolean; items: MdSpan[][] };

// One combined scanner: inline code | bold | italic | [text](href).
// Longest/most-specific alternatives first so `**x**` is not eaten as `*x*`.
// Italic must hug its content (`*word*`, not `a * b`) so stray asterisks
// in prose stay plain text.
const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*(?![\s*])(?:[^*\n]*[^\s*])?\*)|(\[[^\]\n]+\]\((?:https?:\/\/|\/)[^)\s]+\))/g;

/** Splits one line of text into styled spans. */
export const parseInline = (text: string): MdSpan[] => {
  const spans: MdSpan[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last)
      spans.push({ type: 'text', text: text.slice(last, index) });
    const [raw, code, bold, italic, link] = match;
    if (code) spans.push({ type: 'code', text: raw.slice(1, -1) });
    else if (bold) spans.push({ type: 'bold', text: raw.slice(2, -2) });
    else if (italic) spans.push({ type: 'italic', text: raw.slice(1, -1) });
    else if (link) {
      const parts = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(raw)!;
      spans.push({ type: 'link', text: parts[1], href: parts[2] });
    }
    last = index + raw.length;
  }
  if (last < text.length) spans.push({ type: 'text', text: text.slice(last) });
  return spans;
};

const HEADING = /^(#{1,4})\s+(.*)$/;
const BULLET_ITEM = /^\s*[-*]\s+(.*)$/;
const ORDERED_ITEM = /^\s*\d+[.)]\s+(.*)$/;

/** Parses markdown text into renderable blocks. */
export const parseMarkdown = (text: string): MdBlock[] => {
  const blocks: MdBlock[] = [];
  // Consecutive plain lines merge into one paragraph (rendered
  // whitespace-pre-wrap, so line breaks inside it are preserved).
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: MdSpan[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({
        type: 'paragraph',
        spans: parseInline(paragraph.join('\n')),
      });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: 'list', ...list });
      list = null;
    }
  };

  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        spans: parseInline(heading[2]),
      });
      continue;
    }

    const item = BULLET_ITEM.exec(line) ?? ORDERED_ITEM.exec(line);
    if (item) {
      flushParagraph();
      const ordered = !BULLET_ITEM.test(line);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(parseInline(item[1]));
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
};
