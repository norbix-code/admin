import { useState } from 'react';
import { Form } from 'react-final-form';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts';
import { Button, Alert, Spinner } from '@/components/ui';
import { TextInputField } from '@/components/forms/fields';
import {
  composeValidators,
  emailValidator,
  requiredValidator,
} from '@/components/forms/validators';
import {
  useRequestPasswordResetMutation,
  useConfirmPasswordResetMutation,
} from '@/services/norbix';
import { ROUTES } from '@/routes';

export function PasswordResetRequest() {
  const [request, { isLoading }] = useRequestPasswordResetMutation();
  const [sent, setSent] = useState(false);

  const onSubmit = async (values: { email: string }) => {
    try {
      await request({ email: values.email }).unwrap();
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
        <Form onSubmit={onSubmit} initialValues={{ email: '' }}>
          {({ handleSubmit, submitting }) => (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              noValidate
            >
              <TextInputField
                name="email"
                type="email"
                label="Email"
                autoComplete="email"
                validate={composeValidators(requiredValidator, emailValidator)}
              />
              <Button type="submit" block disabled={submitting || isLoading}>
                {submitting || isLoading ? <Spinner /> : 'Send reset link'}
              </Button>
            </form>
          )}
        </Form>
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

  const onSubmit = async (values: { newPassword: string }) => {
    try {
      await confirm({ token, newPassword: values.newPassword }).unwrap();
    } catch {
      /* surfaced via isError */
    }
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
        <Form onSubmit={onSubmit} initialValues={{ newPassword: '' }}>
          {({ handleSubmit, submitting }) => (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              noValidate
            >
              {isError && (
                <Alert kind="error">Reset link invalid or expired.</Alert>
              )}
              <TextInputField
                name="newPassword"
                type="password"
                label="New password"
                autoComplete="new-password"
                validate={requiredValidator}
              />
              <Button type="submit" block disabled={submitting || isLoading}>
                {submitting || isLoading ? <Spinner /> : 'Update password'}
              </Button>
            </form>
          )}
        </Form>
      )}
    </AuthLayout>
  );
}
