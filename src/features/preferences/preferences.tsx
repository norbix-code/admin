import { PageHeader, Card, Toggle, Spinner, Alert } from '@/components/ui';
import {
  useGetUserPreferencesQuery,
  useUpdateUserPreferencesMutation,
} from '@/services/norbix';
import { useAppSelector } from '@/app/hooks';
import { selectUserId } from '@/features/auth/slice';

export function Preferences() {
  const userId = useAppSelector(selectUserId) ?? '';
  const { data, isLoading } = useGetUserPreferencesQuery({ id: userId });
  const [update, { isError }] = useUpdateUserPreferencesMutation();

  const prefs = data?.preferences;
  const blockAll = prefs?.blockAllMarketingMessages ?? false;

  return (
    <>
      <PageHeader
        title="Marketing preferences"
        subtitle="Choose what messages you want to receive."
      />
      <Card>
        {isLoading || !data ? (
          <Spinner label="Loading preferences…" />
        ) : (
          <div className="flex flex-col gap-4">
            {isError && (
              <Alert kind="error">Could not update preferences.</Alert>
            )}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-fg">
                  Marketing messages
                </div>
                <div className="text-xs text-fg-subtle">
                  Receive promotional emails and announcements. Transactional
                  service messages are always sent.
                </div>
              </div>
              {/* Toggle is "subscribed" = NOT blocked. */}
              <Toggle
                checked={!blockAll}
                onChange={(subscribed) =>
                  update({
                    id: userId,
                    blockAllMarketingMessages: !subscribed,
                    blockedTags: prefs?.blockedTags,
                  })
                }
              />
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
