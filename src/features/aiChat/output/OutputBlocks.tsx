/**
 * Renderer registry for assistant output — the presentation half of the
 * output factory (`blocks.ts` is the parsing half). Ported from the cloud
 * dashboard chat (cloud src/features/aiChat/output/OutputBlocks.tsx); only
 * the styling changed — every color comes from the `--admin-*` tokens, so a
 * re-skinned portal re-skins the chat too.
 *
 * To add a new output kind: extend `OutputBlock`, detect it in
 * `parseAssistantOutput`, add a renderer to `outputRenderers`. The chat
 * bubble itself never changes.
 */
import type { ReactElement } from 'react';
import { MdBlock, MdSpan, parseMarkdown } from './markdown';
import { OutputBlock, parseAssistantOutput } from './blocks';
import { toYaml } from './yaml';

const Spans = ({ spans }: { spans: MdSpan[] }) => (
  <>
    {spans.map((span, i) => {
      switch (span.type) {
        case 'bold':
          return (
            <strong key={i} className="font-semibold">
              {span.text}
            </strong>
          );
        case 'italic':
          return <em key={i}>{span.text}</em>;
        case 'code':
          return (
            <code
              key={i}
              className="rounded-token-sm bg-app px-1 py-0.5 font-mono text-[0.85em]"
            >
              {span.text}
            </code>
          );
        case 'link':
          return (
            <a
              key={i}
              href={span.href}
              target="_blank"
              rel="noreferrer"
              className="text-brand underline"
            >
              {span.text}
            </a>
          );
        default:
          return <span key={i}>{span.text}</span>;
      }
    })}
  </>
);

const MarkdownBlockView = ({ block }: { block: MdBlock }) => {
  switch (block.type) {
    case 'heading':
      return (
        <p className={block.level <= 2 ? 'font-semibold' : 'font-medium'}>
          <Spans spans={block.spans} />
        </p>
      );
    case 'list': {
      const ListTag = block.ordered ? 'ol' : 'ul';
      return (
        <ListTag
          className={block.ordered ? 'list-decimal pl-5' : 'list-disc pl-5'}
        >
          {block.items.map((item, i) => (
            <li key={i}>
              <Spans spans={item} />
            </li>
          ))}
        </ListTag>
      );
    }
    default:
      return (
        <p className="whitespace-pre-wrap">
          <Spans spans={block.spans} />
        </p>
      );
  }
};

const MarkdownOutput = ({ text }: { text: string }) => (
  <div className="flex flex-col gap-1.5">
    {parseMarkdown(text).map((block, i) => (
      <MarkdownBlockView key={i} block={block} />
    ))}
  </div>
);

const CodeOutput = ({ code, label }: { code: string; label?: string }) => (
  <div>
    {label && (
      <p className="mb-0.5 text-xs uppercase tracking-wide text-fg-subtle">
        {label}
      </p>
    )}
    <pre className="overflow-x-auto rounded-token bg-fg p-3 font-mono text-xs leading-relaxed text-surface">
      {code}
    </pre>
  </div>
);

// ───────────────────────── Structured "view" blocks ─────────────────────────

type Json = unknown;
type JsonObject = Record<string, Json>;

const isObject = (v: Json): v is JsonObject =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const isScalar = (v: Json): boolean =>
  v === null || ['string', 'number', 'boolean'].includes(typeof v);

const cell = (v: Json): string =>
  v === null || v === undefined ? '' : String(v);

type TreeNode = {
  id?: string;
  name?: string;
  order?: number;
  children?: TreeNode[] | null;
};

const TreeNodes = ({ nodes }: { nodes: TreeNode[] }) => (
  <ul className="list-none pl-4">
    {nodes.map((n, i) => {
      const label = n.name ?? n.id ?? '(item)';
      const kids = Array.isArray(n.children) ? n.children : [];
      const badge =
        typeof n.order === 'number' ? (
          <span className="ml-1 text-xs text-fg-subtle">#{n.order}</span>
        ) : null;
      return (
        <li key={n.id ?? i} className="py-0.5">
          {kids.length > 0 ? (
            <details open>
              <summary className="cursor-pointer">
                {label}
                {badge}
              </summary>
              <TreeNodes nodes={kids} />
            </details>
          ) : (
            <span>
              {label}
              {badge}
            </span>
          )}
        </li>
      );
    })}
  </ul>
);

const TreeOutput = ({ data }: { data: Json }) => {
  const nodes = Array.isArray(data)
    ? data
    : isObject(data)
      ? (data.tree ?? data.Tree ?? [])
      : [];
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return <CodeOutput code={JSON.stringify(data, null, 2)} label="tree" />;
  }
  return (
    <div className="rounded-token p-3 text-sm ring-1 ring-inset ring-border-token">
      <TreeNodes nodes={nodes as TreeNode[]} />
    </div>
  );
};

const rowsOf = (data: Json): Json[] => {
  if (Array.isArray(data)) return data;
  if (!isObject(data)) return [];
  if (Array.isArray(data.items)) return data.items;
  if (isObject(data.list) && Array.isArray(data.list.items)) {
    return data.list.items;
  }
  return [];
};

const TableOutput = ({ data }: { data: Json }) => {
  const rows = rowsOf(data);
  if (rows.length === 0) {
    return <CodeOutput code={JSON.stringify(data, null, 2)} label="table" />;
  }

  const cols: string[] = [];
  rows.forEach((r) => {
    if (isObject(r)) {
      Object.keys(r).forEach((k) => {
        if (isScalar(r[k]) && !cols.includes(k)) cols.push(k);
      });
    }
  });
  if (cols.length === 0) {
    return <CodeOutput code={JSON.stringify(data, null, 2)} label="table" />;
  }

  return (
    <div className="overflow-x-auto rounded-token ring-1 ring-inset ring-border-token">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-app">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border-token">
              {cols.map((c) => (
                <td key={c} className="px-3 py-1.5">
                  {cell(isObject(r) ? r[c] : undefined)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Dispatches a view block to its renderer; JSON preview is the safe fallback. */
const ViewOutput = ({
  block,
}: {
  block: Extract<OutputBlock, { kind: 'view' }>;
}) => {
  let data: Json;
  try {
    data = JSON.parse(block.raw);
  } catch {
    // Not valid JSON — show the raw payload rather than nothing.
    return <CodeOutput code={block.raw} label={block.viewType || 'view'} />;
  }

  switch (block.viewType) {
    case 'tree':
      return <TreeOutput data={data} />;
    case 'table':
      return <TableOutput data={data} />;
    case 'yaml':
      return <CodeOutput code={toYaml(data)} label="yaml" />;
    case 'json':
    default:
      return <CodeOutput code={JSON.stringify(data, null, 2)} label="json" />;
  }
};

/** kind → renderer. Future kinds (mjml live preview, citation…) register here. */
const outputRenderers: {
  [K in OutputBlock['kind']]: (
    block: Extract<OutputBlock, { kind: K }>,
  ) => ReactElement;
} = {
  markdown: (block) => <MarkdownOutput text={block.text} />,
  code: (block) => (
    <CodeOutput code={block.code} label={block.language || undefined} />
  ),
  // Template source shows as code until a live MJML preview renderer lands.
  mjml: (block) => <CodeOutput code={block.code} label="mjml" />,
  // Structured data the agent asked to render (tree / table / json / yaml).
  view: (block) => <ViewOutput block={block} />,
};

/** Renders a raw assistant message through the output factory. */
export const AssistantOutput = ({ text }: { text: string }) => (
  <div className="flex flex-col gap-2">
    {parseAssistantOutput(text).map((block, i) => (
      // `data-output-index` lets the entry toolbar find the view block under
      // the pointer (Copy takes that block's JSON — EntryToolbar.tsx).
      <div key={i} data-output-index={i} data-output-kind={block.kind}>
        {(outputRenderers[block.kind] as (b: OutputBlock) => ReactElement)(
          block,
        )}
      </div>
    ))}
  </div>
);
