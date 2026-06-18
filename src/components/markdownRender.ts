// Minimal, dependency-free Markdown → safe-HTML renderer for author-controlled
// legal text (Terms & Conditions, Privacy Policy). NOT full CommonMark — it
// covers the subset legal docs use: headings, paragraphs, lists, bold/italic,
// inline code, links. Input is HTML-escaped first, so it is safe to render even
// though the content is developer-authored. Kept tiny on purpose (no markdown
// dependency) per the minimal-deps policy.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(text: string): string {
  let t = escapeHtml(text);
  t = t.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, label: string, url: string) => {
      const safe = /^(https?:\/\/|\/)/i.test(url.trim());
      return safe
        ? `<a href="${url.trim()}" class="text-brand hover:underline">${label}</a>`
        : label;
    },
  );
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  t = t.replace(/`([^`]+)`/g, '<code class="rounded bg-app px-1">$1</code>');
  return t;
}

/** Render a small Markdown subset to safe HTML string. */
export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      html.push(`<p class="mb-4">${inline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+\.\s+(.*)$/.exec(line);

    if (heading) {
      flushPara();
      closeList();
      const level = heading[1].length;
      const size = ['text-2xl', 'text-xl', 'text-lg', 'text-base'][level - 1];
      html.push(
        `<h${level} class="mb-3 mt-6 font-semibold ${size}">${inline(heading[2])}</h${level}>`,
      );
    } else if (ul || ol) {
      flushPara();
      const want = ul ? 'ul' : 'ol';
      if (list !== want) {
        closeList();
        list = want;
        html.push(
          `<${want} class="mb-4 list-inside ${ul ? 'list-disc' : 'list-decimal'}">`,
        );
      }
      html.push(`<li>${inline((ul ?? ol)![1])}</li>`);
    } else if (line === '') {
      flushPara();
      closeList();
    } else {
      para.push(line);
    }
  }
  flushPara();
  closeList();
  return html.join('\n');
}
