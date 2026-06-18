// Markdown renderer component. The actual conversion lives in ./markdown.ts so
// this file only exports a component (keeps React Fast Refresh happy).

import { renderMarkdown } from './markdownRender';

export function Markdown({ source }: { source: string }) {
  return (
    <div
      className="text-sm leading-relaxed text-fg"
      // Safe: source is HTML-escaped inside renderMarkdown before any markup.
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}
