import { useMemo, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { PageHeader, Card, Toggle, Spinner, Alert } from '@/components/ui';
import {
  useGetUserPreferencesQuery,
  useUpdateUserPreferencesMutation,
} from '@/services/norbix';
import { useGetBootstrapQuery } from '@/services/portalApi';
import { useAppSelector } from '@/app/hooks';
import { selectUserId } from '@/features/auth/slice';
import { selectSelectedProjectId } from '@/features/project/slice';
import {
  buildCommunicationView,
  isSubscribed,
  setSubscribed,
  CHANNEL_LABEL,
  DELIVERY_LABEL,
  type BlockedTags,
  type TagRow,
} from './communication';

const userLanguage = (): string =>
  typeof navigator !== 'undefined' ? navigator.language : 'en';

/**
 * Communication preferences. Cloud defines the structure for the whole project
 * (channels → groups → tags, Project Settings → Communication Preferences);
 * this page renders it so the user turns topics on or off per delivery channel.
 * With no structure (none defined, or the backend has no service key) only the
 * global marketing switch is shown.
 */
export function Preferences() {
  const userId = useAppSelector(selectUserId);
  const projectId = useAppSelector(selectSelectedProjectId);
  const { data, isLoading } = useGetUserPreferencesQuery(
    userId ? { id: userId } : skipToken,
  );
  const { data: bootstrap, isLoading: structureLoading } = useGetBootstrapQuery(
    projectId ? { projectId } : skipToken,
  );
  const [update, { isError }] = useUpdateUserPreferencesMutation();

  const view = useMemo(
    () =>
      buildCommunicationView(bootstrap?.marketingPreferences, userLanguage()),
    [bootstrap],
  );
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const channel =
    view.channels.find((c) => c.channel === selected) ?? view.channels[0];

  const prefs = data?.preferences;
  const blockAll = prefs?.blockAllMarketingMessages ?? false;
  const blocked = (prefs?.blockedTags ?? {}) as BlockedTags;

  const save = (next: { blockAll?: boolean; blocked?: BlockedTags }) => {
    if (!userId) return;
    void update({
      id: userId,
      blockAllMarketingMessages: next.blockAll ?? blockAll,
      blockedTags: next.blocked ?? blocked,
    });
  };

  const tagRows = (rows: TagRow[], disabled: boolean) =>
    rows.map((row) => (
      <div
        key={row.tag}
        className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="text-sm font-medium text-fg">{row.title}</div>
          {row.description && (
            <div className="text-xs text-fg-subtle">{row.description}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-4">
          {row.deliveries.map((d) => (
            <Toggle
              key={d}
              label={DELIVERY_LABEL[d] ?? d}
              disabled={disabled}
              checked={!disabled && isSubscribed(blocked, d, row.tag)}
              onChange={(on) =>
                save({ blocked: setSubscribed(blocked, d, row.tag, on) })
              }
            />
          ))}
        </div>
      </div>
    ));

  const loading = isLoading || structureLoading || !data;
  const isMarketing = channel?.channel === 'Marketing';

  return (
    <>
      <PageHeader
        title="Communication preferences"
        subtitle="Choose what messages you want to receive, and where."
      />
      {loading ? (
        <Card>
          <Spinner label="Loading preferences…" />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {isError && <Alert kind="error">Could not update preferences.</Alert>}

          {view.channels.length > 1 && (
            <div role="tablist" className="flex gap-2">
              {view.channels.map((c) => (
                <button
                  key={c.channel}
                  role="tab"
                  type="button"
                  aria-selected={c.channel === channel?.channel}
                  onClick={() => setSelected(c.channel)}
                  className={[
                    'rounded-token px-3 py-1.5 text-sm font-medium',
                    c.channel === channel?.channel
                      ? 'bg-brand/10 text-brand'
                      : 'text-fg-muted hover:bg-app',
                  ].join(' ')}
                >
                  {CHANNEL_LABEL[c.channel] ?? c.channel}
                </button>
              ))}
            </div>
          )}

          {(isMarketing || view.channels.length === 0) && (
            <Card>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-fg">
                    All marketing messages
                  </div>
                  <div className="text-xs text-fg-subtle">
                    Turn off to stop every promotional message. Service messages
                    about your account are still sent.
                  </div>
                </div>
                {/* "subscribed" = NOT blocked. */}
                <Toggle
                  checked={!blockAll}
                  onChange={(subscribed) => save({ blockAll: !subscribed })}
                />
              </div>
            </Card>
          )}

          {channel?.groups.map((group) => (
            <Card key={group.tag}>
              <h3 className="text-base font-medium text-fg">{group.title}</h3>
              {group.description && (
                <p className="mt-1 text-sm text-fg-muted">
                  {group.description}
                </p>
              )}
              <div className="mt-2 divide-y divide-border-token">
                {tagRows(group.tags, isMarketing && blockAll)}
              </div>
            </Card>
          ))}

          {view.otherOptions.length > 0 && (
            <Card>
              <h3 className="text-base font-medium text-fg">Other options</h3>
              <div className="mt-2 divide-y divide-border-token">
                {tagRows(view.otherOptions, false)}
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
