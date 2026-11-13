import { useState } from 'react';
import { Form } from 'react-final-form';
import type { FormApi } from 'final-form';
import { Link, useLocation } from 'react-router-dom';
import { PageHeader, Card, Button, Alert, Spinner } from '@/components/ui';
import { TextInputField } from '@/components/forms/fields';
import { requiredValidator } from '@/components/forms/validators';
import { useChangePasswordMutation } from '@/services/norbix';
import { useAppSelector } from '@/app/hooks';
import { ROUTES } from '@/routes';
import { PasskeysCard } from './passkeys';
import { selectLoginName, selectRecoverySession, selectUserId } from './slice';
import { useSignInAgain } from './signInAgain';
import { selectProjectAuth } from '@/features/project/slice';
import {
  providerLabel,
  socialButtons,
  socialErrorMessage,
  socialReturnUrl,
} from './social';
import { goTo, startLinkIdentity } from './socialApi';
import type { LinkResultState } from './callback';

/**
 * Router state the Security page reads: after the re-sign-in that follows a
 * password change, and after a social link came back (callback.tsx).
 */
interface SecurityState extends LinkResultState {
  passwordChanged?: boolean;
}

export function SecurityOverview() {
  const recovery = useAppSelector(selectRecoverySession);
  return (
    <>
      <PageHeader
        title="Security"
        subtitle="Manage your password, passkeys and sign-in methods."
      />
      <div className="flex flex-col gap-6">
        {recovery ? (
          // A recovery-link session (recovery.ts): lead to a new passkey.
          // Changing the password needs the current one, and linking needs
          // the login id this session does not carry, so both wait.
          <>
            <Alert kind="info">
              You signed in with a recovery link. Add a new passkey below to
              keep access to your account, or{' '}
              <Link to={ROUTES.PASSWORD_RESET} className="underline">
                set a new password by e-mail
              </Link>
              . This session ends in a few minutes.
            </Alert>
            <PasskeysCard />
          </>
        ) : (
          <>
            <ChangePasswordCard />
            <PasskeysCard />
            <SignInMethodsCard />
          </>
        )}
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

/**
 * "Sign-in methods": link a social account to this user, so they can sign in
 * with it next time. One "Link {provider}" button per social sign-in the
 * project offers in this env (public config `auth.socialSignIn`); no card
 * when it offers none.
 *
 * The linked accounts are not listed: the API host has no read of a user's
 * other logins (GetUser answers one login; the contact's logins are a Hub
 * read). So every offered provider gets a button; linking one that is
 * already yours succeeds and changes nothing.
 *
 * A click asks the gateway for the provider's page (link-identity/start, as
 * the signed-in user) and sends the browser there; /oauth/callback finishes
 * the link and comes back here with the result in the router state.
 */
function SignInMethodsCard() {
  const buttons = socialButtons(
    useAppSelector(selectProjectAuth)?.socialSignIn,
  );
  const userId = useAppSelector(selectUserId);
  const result = useLocation().state as SecurityState | null;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (buttons.length === 0) return null;

  const link = async (provider: string) => {
    if (!userId) return;
    setError(null);
    setBusy(provider);
    try {
      const { authorizeUrl } = await startLinkIdentity(
        userId,
        provider,
        socialReturnUrl(window.location.origin, provider, true),
      );
      goTo(authorizeUrl);
    } catch (err) {
      setError(socialErrorMessage(err, provider, buttons));
      setBusy(null);
    }
  };

  const shownError = error ?? result?.linkError;
  return (
    <Card>
      <h3 className="mb-1 text-lg font-medium">Sign-in methods</h3>
      <p className="mb-4 text-sm text-fg-muted">
        Link an account to sign in with it next time.
      </p>
      <div className="flex flex-col gap-4">
        {!error && result?.linked && (
          <Alert kind="success">
            Linked {providerLabel(result.linked, buttons)}.
          </Alert>
        )}
        {shownError && <Alert kind="error">{shownError}</Alert>}
        <div className="flex flex-wrap gap-2">
          {buttons.map((b) => (
            <Button
              key={b.provider}
              variant="secondary"
              disabled={busy !== null || !userId}
              onClick={() => void link(b.provider)}
            >
              {busy === b.provider ? <Spinner /> : `Link ${b.displayName}`}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
