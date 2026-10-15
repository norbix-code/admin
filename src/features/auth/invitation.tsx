import { useEffect, useState } from 'react';
import { Form } from 'react-final-form';
import { Link, useLocation } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts';
import { useAppSelector } from '@/app/hooks';
import { selectProjectBranding } from '@/features/project/slice';
import { Button, Alert, Spinner, TextField } from '@/components/ui';
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

/** Trimmed, inner runs of spaces collapsed; undefined when blank. */
const clean = (value: string): string | undefined => {
  const tidy = value.trim().replace(/\s+/g, ' ');
  return tidy.length > 0 ? tidy : undefined;
};

/**
 * Behind the link in the invitation e-mail
 * (`/sign-up/invitation#token=…&email=…`). The invited user chooses a
 * password and may change the full name and the salutation the admin entered
 * (owner decision 2026-10-15 #3, gateway docs/tasks/owner-answers-2-3-0.md):
 * both are optional — empty keeps the admin's values. The e-mail is shown
 * read-only; it cannot change. The one-time token and the e-mail are read
 * once — fragment first, then the query — and taken out of the address bar at
 * once (see ./linkToken). The token goes to the API only in the body of the
 * finish POST; the e-mail is never sent (the token names it).
 */
export function InvitationFinish() {
  const location = useLocation();
  // Read once, on the first render (pure: StrictMode may render twice).
  const [token] = useState(() => linkParam(location, 'token'));
  const [email] = useState(() => linkParam(location, 'email'));

  useEffect(() => {
    removeFromAddressBar(location, window.history, 'token', 'email');
    // Once, on mount: the location read above is the one to clean.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [finish, { isLoading, isSuccess, isError, error }] =
    useFinishInvitationMutation();
  const branding = useAppSelector(selectProjectBranding);

  const onSubmit = async (values: {
    password: string;
    fullName: string;
    salutation: string;
  }) => {
    const fullName = clean(values.fullName);
    const salutation = clean(values.salutation);
    try {
      await finish({
        token,
        password: values.password,
        ...(fullName ? { fullName } : {}),
        ...(salutation ? { salutation } : {}),
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
          initialValues={{ password: '', fullName: '', salutation: '' }}
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
              {email && (
                <TextField
                  id="invitation-email"
                  label="E-mail"
                  type="email"
                  value={email}
                  readOnly
                  disabled
                />
              )}
              <TextInputField
                name="fullName"
                label="Full name (optional)"
                placeholder="Leave empty to keep the name you were invited with"
                autoComplete="name"
              />
              <TextInputField
                name="salutation"
                label="Salutation (optional)"
                placeholder="How e-mails greet you, e.g. “Hi Ona,”"
                autoComplete="nickname"
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
