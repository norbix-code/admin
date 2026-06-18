import { FormEvent, useMemo, useState } from 'react';
import {
  PageHeader,
  Card,
  Button,
  TextField,
  Alert,
  Spinner,
} from '@/components/ui';
import { useGetUserQuery, useUpdateUserMutation } from '@/services/norbix';
import { useAppSelector } from '@/app/hooks';
import { selectUserId } from '@/features/auth/slice';

interface Editable {
  firstName: string;
  lastName: string;
  primaryEmail: string;
  phone: string;
}

export function Profile() {
  const userId = useAppSelector(selectUserId) ?? '';
  const { data, isLoading, isError } = useGetUserQuery({ id: userId });
  const generalInfo = data?.user?.generalInfo;

  return (
    <>
      <PageHeader title="Profile" subtitle="Your contact information." />
      <Card>
        {isLoading ? (
          <Spinner label="Loading profile…" />
        ) : isError || !data ? (
          <Alert kind="error">Could not load your profile. Please retry.</Alert>
        ) : (
          // Re-mount when the loaded record changes so the form initializes
          // from data without a setState-in-effect sync.
          <ProfileForm
            key={data.user?.id ?? userId}
            userId={userId}
            base={generalInfo}
            initial={{
              firstName: generalInfo?.firstName ?? '',
              lastName: generalInfo?.lastName ?? '',
              primaryEmail: generalInfo?.primaryEmail ?? data.user?.email ?? '',
              phone: generalInfo?.phone ?? '',
            }}
          />
        )}
      </Card>
    </>
  );
}

// The general-info shape from the SDK query result (avoids importing the
// SDK's internal CodeMashApi2 namespace, which isn't re-exported).
type GeneralInfo = NonNullable<
  NonNullable<ReturnType<typeof useGetUserQuery>['data']>['user']
>['generalInfo'];

// Minimal, forgiving email check — the backend is the source of truth; this
// just stops an obviously-bad value before the round-trip.
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function ProfileForm({
  userId,
  base,
  initial,
}: {
  userId: string;
  base: GeneralInfo;
  initial: Editable;
}) {
  const [update, { isLoading: saving, isSuccess, isError, reset }] =
    useUpdateUserMutation();
  const [form, setForm] = useState<Editable>(initial);

  // "Dirty" = the form differs from what we loaded. Save stays disabled until
  // the user actually changes something, and after a successful save the form
  // value becomes the new baseline so the button disables again.
  const dirty = useMemo(
    () => (Object.keys(form) as (keyof Editable)[]).some((k) => form[k] !== initial[k]),
    [form, initial],
  );

  const emailValid = isValidEmail(form.primaryEmail);
  const canSave = dirty && emailValid && !saving;

  const set = (key: keyof Editable) => (e: { target: { value: string } }) => {
    // Editing again clears any prior success/error banner.
    if (isSuccess || isError) reset();
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    update({
      id: userId,
      // Spread the loaded general-info so required fields (e.g.
      // blockAllMarketingMessages) are preserved; override the edited fields.
      userGeneralInfo: {
        ...(base ?? { blockAllMarketingMessages: false }),
        firstName: form.firstName,
        lastName: form.lastName,
        primaryEmail: form.primaryEmail,
        phone: form.phone,
      },
    });
  };

  return (
    <>
      {isSuccess && <Alert kind="success">Profile saved.</Alert>}
      {isError && <Alert kind="error">Could not save profile. Please retry.</Alert>}
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <TextField
          label="First name"
          value={form.firstName}
          onChange={set('firstName')}
        />
        <TextField
          label="Last name"
          value={form.lastName}
          onChange={set('lastName')}
        />
        <TextField
          type="email"
          label="Email"
          value={form.primaryEmail}
          onChange={set('primaryEmail')}
          autoComplete="email"
        />
        {form.primaryEmail !== '' && !emailValid && (
          <p className="-mt-2 text-xs text-danger">
            Enter a valid email address.
          </p>
        )}
        <TextField
          label="Phone"
          value={form.phone}
          onChange={set('phone')}
          autoComplete="tel"
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!canSave}>
            {saving ? <Spinner /> : 'Save changes'}
          </Button>
          {dirty && !saving && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (isSuccess || isError) reset();
                setForm(initial);
              }}
            >
              Discard
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
