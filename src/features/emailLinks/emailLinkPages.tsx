import { useLocation } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts';
import { Alert, Button, Spinner } from '@/components/ui';
import { useAppSelector } from '@/app/hooks';
import { selectProjectBranding } from '@/features/project/slice';
import {
  useGetEmailPreferencesByLinkQuery,
  useOneClickUnsubscribeMutation,
} from '@/services/hub';
import {
  UNSUBSCRIBED_MESSAGE,
  emailLinkRefusal,
  linkHash,
  preferencesSummary,
} from './answers';
import { useNoReferrer } from './noReferrer';

// The public pages behind the "Preferences" and "Unsubscribe" links of a sent
// email. No sign-in: the signed `hash` in the link is the only key, and every
// action goes to the gateway with it. The gateway refuses an edited or made-up
// link; the page shows its refusal as a sentence.
//
// Unsubscribing needs a click on purpose: mail scanners open links in emails
// on their own, and opening the page must not unsubscribe anybody.

type Mode = 'preferences' | 'unsubscribe';

const TITLES: Record<Mode, string> = {
  preferences: 'Email preferences',
  unsubscribe: 'Unsubscribe from marketing emails',
};

function EmailLinkPage({ mode }: { mode: Mode }) {
  const location = useLocation();
  const token = linkHash(location.search);
  const branding = useAppSelector(selectProjectBranding);
  useNoReferrer();

  const preferences = useGetEmailPreferencesByLinkQuery(
    { token },
    { refetchOnMountOrArgChange: true },
  );
  const [unsubscribe, unsubscribing] = useOneClickUnsubscribeMutation();

  const readRefusal = emailLinkRefusal(preferences.error, preferences.data);
  const unsubscribeRefusal = emailLinkRefusal(
    unsubscribing.error,
    unsubscribing.data,
  );
  const justUnsubscribed =
    unsubscribing.isSuccess &&
    unsubscribing.data?.responseStatus?.isSuccess !== false;
  const item = preferences.data?.item;

  const onUnsubscribe = async () => {
    await unsubscribe({ token });
    preferences.refetch();
  };

  return (
    <AuthLayout brandName={branding?.displayName} logoUrl={branding?.logoUrl}>
      <h2 className="mb-4 text-center text-xl font-semibold">{TITLES[mode]}</h2>
      {preferences.isLoading ? (
        <Spinner label="Loading…" />
      ) : readRefusal ? (
        <Alert kind="error">{readRefusal}</Alert>
      ) : item ? (
        <div className="flex flex-col gap-4">
          <p data-testid="email-link-summary">{preferencesSummary(item)}</p>
          {justUnsubscribed && (
            <Alert kind="success">{UNSUBSCRIBED_MESSAGE}</Alert>
          )}
          {unsubscribeRefusal && (
            <Alert kind="error">{unsubscribeRefusal}</Alert>
          )}
          {!item.unsubscribedFromMarketing && (
            <Button
              block
              onClick={onUnsubscribe}
              disabled={unsubscribing.isLoading}
            >
              {unsubscribing.isLoading ? (
                <Spinner />
              ) : (
                'Unsubscribe from all marketing emails'
              )}
            </Button>
          )}
          <p className="text-sm text-fg-muted">
            You may still receive emails you need, such as account or security
            messages.
          </p>
        </div>
      ) : null}
    </AuthLayout>
  );
}

export function EmailPreferencesPage() {
  return <EmailLinkPage mode="preferences" />;
}

export function EmailUnsubscribePage() {
  return <EmailLinkPage mode="unsubscribe" />;
}
