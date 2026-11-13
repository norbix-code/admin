import { useState } from 'react';
import { Form } from 'react-final-form';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts';
import { Alert, Button, Spinner } from '@/components/ui';
import { TextInputField } from '@/components/forms/fields';
import {
  composeValidators,
  passwordPolicyValidator,
  requiredValidator,
} from '@/components/forms/validators';
import { useChangePasswordMutation } from '@/services/norbix';
import { ROUTES } from '@/routes';
import type { ProjectConfig } from '@/types/projectConfig';
import { useSignInAgain } from './signInAgain';
import {
  PASSWORD_CHANGE_REASON,
  type PasswordChangeState,
} from './passwordChange';

interface Values {
  currentPassword: string;
  newPassword: string;
}

/**
 * The step after a sign-in whose password breaks the project's current rules
 * (`meta.passwordChangeRequired`). The user is already signed in; this asks
 * for a new password, signs in again with it (the change ends the old
 * session), then goes on to the landing page. Reached only from the sign-in
 * screen: without its state the page goes home.
 */
export function PasswordChangeRequired({ config }: { config: ProjectConfig }) {
  const location = useLocation();
  const [change, { isLoading }] = useChangePasswordMutation();
  const signInAgain = useSignInAgain();
  const [failed, setFailed] = useState(false);

  const state = location.state as PasswordChangeState | null;
  if (!state?.required) return <Navigate to={ROUTES.HOME} replace />;

  const { passwordPolicy } = config.auth;

  const onSubmit = async (values: Values) => {
    setFailed(false);
    try {
      await change({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }).unwrap();
    } catch {
      setFailed(true);
      return;
    }
    // The change ends the session it was made with: sign in again.
    await signInAgain(state.userName, values.newPassword, ROUTES.HOME);
  };

  return (
    <AuthLayout
      brandName={config.branding.displayName}
      logoUrl={config.branding.logoUrl}
    >
      <h2 className="mb-6 text-center text-xl font-semibold text-fg">
        Choose a new password
      </h2>
      <Alert kind="info">{PASSWORD_CHANGE_REASON}</Alert>
      {failed && (
        <div className="mt-4">
          <Alert kind="error">
            Could not change the password. Check the current password and the
            rules below.
          </Alert>
        </div>
      )}
      <Form<Values>
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
              validate={composeValidators(
                requiredValidator,
                passwordPolicyValidator(passwordPolicy),
              )}
            />
            {passwordPolicy.minLength > 0 && (
              <p className="-mt-2 text-xs text-fg-subtle">
                At least {passwordPolicy.minLength} characters.
              </p>
            )}
            <Button type="submit" block disabled={submitting || isLoading}>
              {submitting || isLoading ? <Spinner /> : 'Save new password'}
            </Button>
          </form>
        )}
      </Form>
    </AuthLayout>
  );
}
