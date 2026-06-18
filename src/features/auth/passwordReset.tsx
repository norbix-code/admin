import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts';
import { Button, TextField, Alert, Spinner } from '@/components/ui';
import {
  useRequestPasswordResetMutation,
  useConfirmPasswordResetMutation,
} from '@/services/norbix';
import { ROUTES } from '@/routes';

export function PasswordResetRequest() {
  const [request, { isLoading }] = useRequestPasswordResetMutation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await request({ email }).unwrap();
    } finally {
      setSent(true);
    }
  };

  return (
    <AuthLayout>
      <h2 className="mb-4 text-center text-xl font-semibold">Reset password</h2>
      {sent ? (
        <Alert kind="success">
          If an account exists for that email, a reset link is on its way.
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextField
            type="email"
            label="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" block disabled={isLoading}>
            {isLoading ? <Spinner /> : 'Send reset link'}
          </Button>
        </form>
      )}
      <div className="mt-6 text-center text-sm">
        <Link to={ROUTES.SIGN_IN} className="text-brand hover:underline">
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}

export function PasswordResetConfirm() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [confirm, { isLoading, isSuccess, isError }] =
    useConfirmPasswordResetMutation();
  const [newPassword, setNewPassword] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    confirm({ token, newPassword });
  };

  return (
    <AuthLayout>
      <h2 className="mb-4 text-center text-xl font-semibold">
        Choose a new password
      </h2>
      {isSuccess ? (
        <Alert kind="success">
          Password updated.{' '}
          <Link to={ROUTES.SIGN_IN} className="underline">
            Sign in
          </Link>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {isError && (
            <Alert kind="error">Reset link invalid or expired.</Alert>
          )}
          <TextField
            type="password"
            label="New password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button type="submit" block disabled={isLoading}>
            {isLoading ? <Spinner /> : 'Update password'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
