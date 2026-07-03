import { Form, FormSpy } from 'react-final-form';
import type { FormApi } from 'final-form';
import { PageHeader, Card, Button, Alert, Spinner } from '@/components/ui';
import { TextInputField } from '@/components/forms/fields';
import { emailValidator } from '@/components/forms/validators';
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

  const onSubmit = async (values: Editable, form: FormApi<Editable>) => {
    try {
      await update({
        id: userId,
        // Spread the loaded general-info so required fields (e.g.
        // blockAllMarketingMessages) are preserved; override the edited fields.
        userGeneralInfo: {
          ...(base ?? { blockAllMarketingMessages: false }),
          firstName: values.firstName,
          lastName: values.lastName,
          primaryEmail: values.primaryEmail,
          phone: values.phone,
        },
      }).unwrap();
      // Saved values become the new baseline: the form turns pristine again
      // and the Save button disables until the user edits something.
      form.initialize(values);
    } catch {
      /* surfaced via isError */
    }
  };

  return (
    <Form<Editable> onSubmit={onSubmit} initialValues={initial}>
      {({ handleSubmit, form, pristine, submitting, hasValidationErrors }) => (
        <>
          {isSuccess && <Alert kind="success">Profile saved.</Alert>}
          {isError && (
            <Alert kind="error">Could not save profile. Please retry.</Alert>
          )}
          {/* Editing again clears any prior success/error banner. */}
          <FormSpy<Editable>
            subscription={{ values: true }}
            onChange={() => {
              if (isSuccess || isError) reset();
            }}
          />
          <form
            onSubmit={handleSubmit}
            className="mt-4 flex flex-col gap-4"
            noValidate
          >
            <TextInputField name="firstName" label="First name" />
            <TextInputField name="lastName" label="Last name" />
            <TextInputField
              name="primaryEmail"
              type="email"
              label="Email"
              autoComplete="email"
              validate={emailValidator}
            />
            <TextInputField name="phone" label="Phone" autoComplete="tel" />
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={
                  pristine || hasValidationErrors || submitting || saving
                }
              >
                {submitting || saving ? <Spinner /> : 'Save changes'}
              </Button>
              {!pristine && !saving && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (isSuccess || isError) reset();
                    form.reset();
                  }}
                >
                  Discard
                </Button>
              )}
            </div>
          </form>
        </>
      )}
    </Form>
  );
}
