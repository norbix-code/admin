import { useState } from 'react';
import { Card, Button, TextField, Alert, Spinner, ConfirmDialog } from '@/components/ui';
import { useAppSelector } from '@/app/hooks';
import { selectUserId } from './slice';
import {
  useGetUserQuery,
  useStartEmailVerificationMutation,
  useConfirmEmailVerificationMutation,
  usePasskeyRegistrationOptionsMutation,
  useVerifyPasskeyRegistrationMutation,
  useListPasskeysQuery,
  useRenamePasskeyMutation,
  useRevokePasskeyMutation,
} from '@/services/norbix';
import { createPasskey, isWebAuthnAvailable } from './webauthn';

/**
 * Passkey management. Registration is a guarded flow because the API gates it
 * behind email verification:
 *   start-verification → user enters the emailed code → confirm (returns a
 *   one-time verificationToken) → registration-options → WebAuthn create →
 *   verify-registration.
 * Listing / renaming / revoking are plain authenticated calls.
 */
export function PasskeysCard() {
  const userId = useAppSelector(selectUserId) ?? '';
  const { data: userData } = useGetUserQuery({ id: userId });
  const email = userData?.user?.email ?? userData?.user?.generalInfo?.primaryEmail ?? '';

  const { data: list, isLoading: listing } = useListPasskeysQuery({});
  const passkeys = list?.passkeys ?? [];

  if (!isWebAuthnAvailable()) {
    return (
      <Card>
        <h3 className="mb-4 text-lg font-medium">Passkeys</h3>
        <Alert kind="info">
          This browser does not support passkeys. Try a modern browser on a
          device with biometrics or a security key.
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-1 text-lg font-medium">Passkeys</h3>
      <p className="mb-4 text-sm text-fg-muted">
        Sign in without a password using your device biometrics or a security
        key.
      </p>

      {listing ? (
        <Spinner label="Loading passkeys…" />
      ) : passkeys.length === 0 ? (
        <p className="mb-4 text-sm text-fg-subtle">
          You don’t have any passkeys yet.
        </p>
      ) : (
        <ul className="mb-4 divide-y divide-border-token">
          {passkeys.map((p) => (
            <PasskeyRow
              key={p.credentialId}
              credentialId={p.credentialId}
              friendlyName={p.friendlyName}
              registeredOnUtc={p.registeredOnUtc}
              isRevoked={p.isRevoked}
            />
          ))}
        </ul>
      )}

      <RegisterPasskey email={email} />
    </Card>
  );
}

function PasskeyRow({
  credentialId,
  friendlyName,
  registeredOnUtc,
  isRevoked,
}: {
  credentialId: string;
  friendlyName: string;
  registeredOnUtc: string;
  isRevoked: boolean;
}) {
  const [rename, { isLoading: renaming }] = useRenamePasskeyMutation();
  const [revoke, { isLoading: revoking }] = useRevokePasskeyMutation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(friendlyName);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const registered = registeredOnUtc
    ? new Date(registeredOnUtc).toLocaleDateString()
    : '';

  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <TextField
              label=""
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button
              disabled={renaming || name.trim() === ''}
              onClick={async () => {
                await rename({ credentialId, friendlyName: name.trim() });
                setEditing(false);
              }}
            >
              {renaming ? <Spinner /> : 'Save'}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <div className="truncate text-sm font-medium text-fg">
              {friendlyName || 'Passkey'}
              {isRevoked && (
                <span className="ml-2 text-xs text-fg-subtle">(revoked)</span>
              )}
            </div>
            {registered && (
              <div className="text-xs text-fg-subtle">Added {registered}</div>
            )}
          </>
        )}
      </div>

      {!editing && !isRevoked && (
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Rename
          </Button>
          <Button
            variant="danger"
            disabled={revoking}
            onClick={() => setConfirmRevoke(true)}
          >
            {revoking ? <Spinner /> : 'Remove'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        onConfirm={() => {
          revoke({ credentialId });
          setConfirmRevoke(false);
        }}
        title="Remove this passkey?"
        body="You will no longer be able to sign in with this passkey."
        confirmLabel="Remove"
        danger
      />
    </li>
  );
}

type Step = 'idle' | 'sendingCode' | 'awaitingCode' | 'registering';

function RegisterPasskey({ email }: { email: string }) {
  const [startVerification] = useStartEmailVerificationMutation();
  const [confirmVerification] = useConfirmEmailVerificationMutation();
  const [getOptions] = usePasskeyRegistrationOptionsMutation();
  const [verifyRegistration] = useVerifyPasskeyRegistrationMutation();

  const [step, setStep] = useState<Step>('idle');
  const [code, setCode] = useState('');
  const [friendlyName, setFriendlyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const begin = async () => {
    setError(null);
    setStep('sendingCode');
    try {
      await startVerification({ email }).unwrap();
      setStep('awaitingCode');
    } catch {
      setError('Could not send a verification code. Please retry.');
      setStep('idle');
    }
  };

  const finish = async () => {
    setError(null);
    setStep('registering');
    try {
      // 1) Confirm the emailed code → one-time verification token.
      const { verificationToken } = await confirmVerification({
        email,
        code,
      }).unwrap();

      // 2) Ask the server for WebAuthn creation options.
      const opts = await getOptions({ verificationToken }).unwrap();

      // 3) Run the browser ceremony.
      const attestationResponse = await createPasskey(opts.optionsJson);

      // 4) Hand the attestation back to the server to finish registration.
      await verifyRegistration({
        verificationToken,
        ceremonyId: opts.ceremonyId,
        attestationResponse,
        friendlyName: friendlyName.trim() || undefined,
      }).unwrap();

      setDone(true);
      setStep('idle');
      setCode('');
      setFriendlyName('');
    } catch (e) {
      // WebAuthn throws DOMException on cancel/timeout; the API throws on a
      // bad code. Either way, let the user try again.
      const msg =
        e instanceof DOMException
          ? 'Passkey setup was cancelled or timed out.'
          : 'Could not add the passkey. Check the code and try again.';
      setError(msg);
      setStep('awaitingCode');
    }
  };

  if (done) {
    return (
      <Alert kind="success">
        Passkey added.{' '}
        <button
          type="button"
          className="underline"
          onClick={() => setDone(false)}
        >
          Add another
        </button>
      </Alert>
    );
  }

  return (
    <div className="border-t border-border-token pt-4">
      {error && (
        <Alert kind="error">
          {error}
        </Alert>
      )}

      {step === 'idle' && (
        <Button onClick={begin} disabled={!email}>
          Add a passkey
        </Button>
      )}

      {step === 'sendingCode' && <Spinner label="Sending a code to your email…" />}

      {(step === 'awaitingCode' || step === 'registering') && (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-fg-muted">
            We emailed a verification code to <strong>{email}</strong>. Enter it
            to confirm it’s you, then approve the passkey on your device.
          </p>
          <TextField
            label="Verification code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <TextField
            label="Passkey name (optional)"
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
            placeholder="e.g. My laptop"
          />
          <div className="flex items-center gap-2">
            <Button
              onClick={finish}
              disabled={step === 'registering' || code.trim() === ''}
            >
              {step === 'registering' ? <Spinner /> : 'Add passkey'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setStep('idle');
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
