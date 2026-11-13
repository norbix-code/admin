import { Form } from 'react-final-form';
import type { FormApi } from 'final-form';
import { useLocation } from 'react-router-dom';
import { PageHeader, Card, Button, Alert, Spinner } from '@/components/ui';
import { TextInputField } from '@/components/forms/fields';
import { requiredValidator } from '@/components/forms/validators';
import { useChangePasswordMutation } from '@/services/norbix';
import { useAppSelector } from '@/app/hooks';
import { ROUTES } from '@/routes';
import { PasskeysCard } from './passkeys';
import { selectLoginName } from './slice';
import { useSignInAgain } from './signInAgain';

/** Router state the Security page reads after the re-sign-in that follows a change. */
interface SecurityState {
  passwordChanged?: boolean;
}

export function SecurityOverview() {
  return (
    <>
      <PageHeader
        title="Security"
        subtitle="Manage your password and passkeys."
      />
      <div className="flex flex-col gap-6">
        <ChangePasswordCard />
        <PasskeysCard />
      </div>
    </>
  );
}

interface ChangePasswordValues {
  currentPassword: string;
  newPassword: string;
}

function ChangePasswordCard() {
  const [change, { isLoading, isError }] = useChangePasswordMutation();
  const loginName = useAppSelector(selectLoginName);
  const signInAgain = useSignInAgain();
  // The page re-mounts on the new token; the success note travels in the
  // router state of the history entry.
  const changed = Boolean(
    (useLocation().state as SecurityState | null)?.passwordChanged,
  );

  const onSubmit = async (
    values: ChangePasswordValues,
    form: FormApi<ChangePasswordValues>,
  ) => {
    try {
      await change({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }).unwrap();
    } catch {
      return; /* surfaced via isError */
    }
    // The change ends the session it was made with (the gateway refuses the
    // old token): sign in again with the new password and stay here.
    const state: SecurityState = { passwordChanged: true };
    if (
      await signInAgain(loginName, values.newPassword, ROUTES.SECURITY, state)
    ) {
      // Clear the password fields after a successful change.
      form.restart();
    }
  };

  return (
    <Card>
      <h3 className="mb-4 text-lg font-medium">Change password</h3>
      {changed && <Alert kind="success">Password changed.</Alert>}
      {isError && <Alert kind="error">Could not change password.</Alert>}
      <Form<ChangePasswordValues>
        onSubmit={onSubmit}
        initialValues={{ currentPassword: '', newPassword: '' }}
      >
        {({ handleSubmit, submitting }) => (
          <form
            onSubmit={handleSubmit}
            className="mt-4 flex flex-col gap-4"
            noValidate
          >
            <TextInputField
              name="currentPassword"
              type="password"
              label="Current password"
              autoComplete="current-password"
              validate={requiredValidator}
            />
            <TextInputField
              name="newPassword"
              type="password"
              label="New password"
              autoComplete="new-password"
              validate={requiredValidator}
            />
            <div>
              <Button type="submit" disabled={submitting || isLoading}>
                {submitting || isLoading ? <Spinner /> : 'Update password'}
              </Button>
            </div>
          </form>
        )}
      </Form>
    </Card>
  );
}
