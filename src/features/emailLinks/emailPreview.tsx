import { useLocation } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { useAppSelector } from '@/app/hooks';
import { selectProjectBranding } from '@/features/project/slice';
import { usePreviewEmailNotificationQuery } from '@/services/hub';
import { linkHash, previewLinkRefusal } from './answers';
import { useNoReferrer } from './noReferrer';

/**
 * The email HTML comes from a project's template and is shown to anyone with
 * the link, so it runs in a sandboxed frame: no scripts, no same-origin
 * access, no referrer. Links in the email open in a new tab, outside the
 * sandbox, the way they would from a mail client.
 */
function IsolatedHtml({ html }: { html: string }) {
  const page = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Email</title><base target="_blank">
<style>html,body{margin:0;padding:0;height:100%}.email{padding:20px;box-sizing:border-box}</style>
</head><body><div class="email">${html}</div></body></html>`;

  return (
    <iframe
      srcDoc={page}
      title="Email"
      className="h-[calc(100vh-8rem)] w-full rounded-token border-0 bg-white"
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
    />
  );
}

/** "View in web": the subject and body of one sent email. No sign-in. */
export function EmailPreviewPage() {
  const location = useLocation();
  const hash = linkHash(location.search);
  const branding = useAppSelector(selectProjectBranding);
  useNoReferrer();

  const { data, error, isLoading } = usePreviewEmailNotificationQuery({
    hash,
  });
  const refusal = previewLinkRefusal(error);

  return (
    <div className="min-h-screen bg-app px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-4 flex items-center gap-3">
          {branding?.logoUrl && (
            <img
              src={branding.logoUrl}
              alt={branding.displayName}
              className="h-8"
            />
          )}
          <span className="font-semibold text-fg">{branding?.displayName}</span>
        </header>
        {isLoading ? (
          <Spinner label="Loading…" />
        ) : refusal ? (
          <p
            className="text-sm text-fg-muted"
            data-testid="email-preview-refused"
          >
            {refusal}
          </p>
        ) : (
          <>
            {/* Text, not HTML: the subject is shown as written. */}
            <p
              className="mb-3 text-sm text-fg"
              data-testid="email-preview-subject"
            >
              Subject: {data?.subject ?? ''}
            </p>
            <IsolatedHtml html={data?.body ?? ''} />
          </>
        )}
      </div>
    </div>
  );
}
