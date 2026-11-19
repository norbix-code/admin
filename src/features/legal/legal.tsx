import { useGetLegalDocumentQuery } from '@/services/publicApi';
import { Spinner } from '@/components/ui';
import { Markdown } from '@/components/markdown';

export function LegalDocumentPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const { data, isLoading, isError } = useGetLegalDocumentQuery(kind);
  const fallbackTitle =
    kind === 'terms' ? 'Terms & Conditions' : 'Privacy Policy';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {isLoading ? (
        <Spinner label="Loading…" />
      ) : isError || !data || !data.available ? (
        <p className="text-sm text-fg-muted">This document is not available.</p>
      ) : (
        <article>
          <h1 className="mb-6 text-2xl font-semibold text-fg">
            {data.title ?? fallbackTitle}
          </h1>
          <Markdown source={data.body} />
        </article>
      )}
    </div>
  );
}
