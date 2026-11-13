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
  changePasswordErrorMessage,
  PASSWORD_CHANGE_REASON,
  PASSWORD_RULES_UNKNOWN_HINT,
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
  const [failure, setFailure] = useState<string | null>(null);

  const state = location.state as PasswordChangeState | null;
  if (!state?.required) return <Navigate to={ROUTES.HOME} replace />;

  // The portal gets the project's password rule only when the project shares
  // its auth settings with the Admin Portal ("expose auth", off by default).
  // Otherwise the rule here is just the portal's default, which may be weaker
  // than the stored one — so it is neither shown nor checked, and the
  // gateway's answer says what is wrong.
  const { passwordPolicy, exposed } = config.auth;

  const onSubmit = async (values: Values) => {
    setFailure(null);
    try {
      await change({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }).unwrap();
    } catch (err) {
      setFailure(changePasswordErrorMessage(err));
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
      {failure && (
        <div className="mt-4">
          <Alert kind="error">{failure}</Alert>
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
              validate={
                exposed
                  ? composeValidators(
                      requiredValidator,
                      passwordPolicyValidator(passwordPolicy),
                    )
                  : requiredValidator
              }
            />
            <p className="-mt-2 text-xs text-fg-subtle">
              {exposed && passwordPolicy.minLength > 0
                ? `At least ${passwordPolicy.minLength} characters.`
                : PASSWORD_RULES_UNKNOWN_HINT}
            </p>
            <Button type="submit" block disabled={submitting || isLoading}>
              {submitting || isLoading ? <Spinner /> : 'Save new password'}
            </Button>
          </form>
        )}
      </Form>
    </AuthLayout>
  );
}
