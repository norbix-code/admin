import { useEffect, useState } from 'react';
import { Form } from 'react-final-form';
import { Link, useLocation } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts';
import { useAppSelector } from '@/app/hooks';
import { selectProjectBranding } from '@/features/project/slice';
import { Button, Alert, Spinner } from '@/components/ui';
import { TextInputField } from '@/components/forms/fields';
import { requiredValidator } from '@/components/forms/validators';
import { useFinishInvitationMutation } from '@/services/publicApi';
import { ROUTES } from '@/routes';
import { linkParam, removeFromAddressBar } from './linkToken';

/** The gateway's error message, when the answer carries one. */
const errorMessage = (error: unknown): string | undefined => {
  const data = (error as { data?: unknown } | undefined)?.data as
    | { responseStatus?: { errors?: { message?: string }[] } }
    | undefined;
  return data?.responseStatus?.errors?.[0]?.message;
};

/**
 * Behind the link in the invitation e-mail (`/sign-up/invitation#token=…`).
 * The invited user chooses a password (and optionally a display name) and the
 * account becomes active. The one-time token is read once — fragment first,
 * then the query — and taken out of the address bar at once (see
 * ./linkToken). It goes to the API only in the body of the finish POST.
 */
export function InvitationFinish() {
  const location = useLocation();
  // Read once, on the first render (pure: StrictMode may render twice).
  const [token] = useState(() => linkParam(location, 'token'));

  useEffect(() => {
    removeFromAddressBar(location, window.history, 'token');
    // Once, on mount: the location read above is the one to clean.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [finish, { isLoading, isSuccess, isError, error }] =
    useFinishInvitationMutation();
  const branding = useAppSelector(selectProjectBranding);

  const onSubmit = async (values: {
    password: string;
    displayName: string;
  }) => {
    try {
      await finish({
        token,
        password: values.password,
        displayName: values.displayName.trim() || undefined,
      }).unwrap();
    } catch {
      /* surfaced via isError */
    }
  };

  return (
    <AuthLayout brandName={branding?.displayName} logoUrl={branding?.logoUrl}>
      <h2 className="mb-4 text-center text-xl font-semibold">
        Finish your registration
      </h2>
      {!token ? (
        <Alert kind="error">
          This invitation link is not complete. Open the link from the
          invitation e-mail again.
        </Alert>
      ) : isSuccess ? (
        <Alert kind="success">
          Your account is ready.{' '}
          <Link to={ROUTES.SIGN_IN} className="underline">
            Sign in
          </Link>
        </Alert>
      ) : (
        <Form
          onSubmit={onSubmit}
          initialValues={{ password: '', displayName: '' }}
        >
          {({ handleSubmit, submitting }) => (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              noValidate
            >
              {isError && (
                <Alert kind="error">
                  {errorMessage(error) ??
                    'This invitation link is not valid or has expired.'}
                </Alert>
              )}
              <TextInputField
                name="displayName"
                label="Your name (optional)"
                autoComplete="name"
              />
              <TextInputField
                name="password"
                type="password"
                label="Password"
                autoComplete="new-password"
                validate={requiredValidator}
              />
              <Button type="submit" block disabled={submitting || isLoading}>
                {submitting || isLoading ? <Spinner /> : 'Create my account'}
              </Button>
            </form>
          )}
        </Form>
      )}
    </AuthLayout>
  );
}
