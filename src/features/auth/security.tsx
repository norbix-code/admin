import { Form } from 'react-final-form';
import type { FormApi } from 'final-form';
import { PageHeader, Card, Button, Alert, Spinner } from '@/components/ui';
import { TextInputField } from '@/components/forms/fields';
import { requiredValidator } from '@/components/forms/validators';
import { useChangePasswordMutation } from '@/services/norbix';
import { PasskeysCard } from './passkeys';

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
  const [change, { isLoading, isSuccess, isError }] =
    useChangePasswordMutation();

  const onSubmit = async (
    values: ChangePasswordValues,
    form: FormApi<ChangePasswordValues>,
  ) => {
    try {
      await change({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }).unwrap();
      // Clear the password fields after a successful change.
      form.restart();
    } catch {
      /* surfaced via isError */
    }
  };

  return (
    <Card>
      <h3 className="mb-4 text-lg font-medium">Change password</h3>
      {isSuccess && <Alert kind="success">Password changed.</Alert>}
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
