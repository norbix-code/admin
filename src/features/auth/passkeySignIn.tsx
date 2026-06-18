import { useState } from 'react';
import { Button, TextField, Alert, Spinner } from '@/components/ui';
import { useAppDispatch } from '@/app/hooks';
import { signedIn } from './slice';
import {
  usePasskeyAuthenticationOptionsMutation,
  useVerifyPasskeyAuthenticationMutation,
} from '@/services/norbix';
import { getPasskeyAssertion, isWebAuthnAvailable } from './webauthn';

/**
 * Real in-browser passkey sign-in (no server redirect).
 *
 * Flow: ask for the account email → request authentication options →
 * run `navigator.credentials.get` → verify the assertion → store the returned
 * access token. The API returns the email-scoped options so the authenticator
 * can pick the right credential.
 */
export function PasskeySignInButton() {
  const dispatch = useAppDispatch();
  const [getOptions] = usePasskeyAuthenticationOptionsMutation();
  const [verify] = useVerifyPasskeyAuthenticationMutation();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isWebAuthnAvailable()) return null;

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      const opts = await getOptions({ email }).unwrap();
      const assertionResponse = await getPasskeyAssertion(opts.optionsJson);
      const tokens = await verify({
        ceremonyId: opts.ceremonyId,
        assertionResponse,
      }).unwrap();
      if (tokens.accessToken) {
        dispatch(signedIn({ token: tokens.accessToken, userId: '' }));
      } else {
        setError('Sign-in did not return a token.');
      }
    } catch (e) {
      setError(
        e instanceof DOMException
          ? 'Passkey sign-in was cancelled or timed out.'
          : 'Could not sign in with a passkey. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" block onClick={() => setOpen(true)}>
        Continue with a passkey
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-token bg-surface p-3 ring-1 ring-inset ring-border-token">
      {error && <Alert kind="error">{error}</Alert>}
      <TextField
        type="email"
        label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email webauthn"
      />
      <div className="flex items-center gap-2">
        <Button onClick={run} disabled={busy || email.trim() === ''}>
          {busy ? <Spinner /> : 'Use passkey'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
