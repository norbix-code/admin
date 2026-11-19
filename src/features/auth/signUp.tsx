import { useState } from 'react';
import { Form } from 'react-final-form';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts';
import { useAppSelector } from '@/app/hooks';
import { selectProjectBranding } from '@/features/project/slice';
import { Button, Alert, Spinner } from '@/components/ui';
import { TextInputField } from '@/components/forms/fields';
import {
  composeValidators,
  emailValidator,
  passwordPolicyValidator,
  requiredValidator,
} from '@/components/forms/validators';
import { useSaveEmailUserMutation } from '@/services/norbix';
import { ROUTES } from '@/routes';
import type { ProjectConfig } from '@/types/projectConfig';

interface SignUpValues {
  email: string;
  password: string;
}

/** The gateway's own words when it refuses, else a plain fallback. */
export const signUpErrorMessage = (error: unknown): string => {
  const message = (error as { message?: string } | undefined)?.message?.trim();
  return message || 'Could not create the account. Please try again.';
};

/**
 * A visitor creates an account with e-mail and password. The project decides
 * whether anyone may sign up (Norbix → Membership → Authorization); when it
 * does not, the gateway refuses and the page shows its message.
 */
export function SignUp({ config }: { config: ProjectConfig }) {
  const [signUp, { isLoading, isSuccess, error }] = useSaveEmailUserMutation();
  const [email, setEmail] = useState('');
  const branding = useAppSelector(selectProjectBranding);

  const onSubmit = async (values: SignUpValues) => {
    try {
      await signUp({
        email: values.email.trim(),
        password: values.password,
      }).unwrap();
      setEmail(values.email.trim());
    } catch {
      /* shown from `error` */
    }
  };

  return (
    <AuthLayout brandName={branding?.displayName} logoUrl={branding?.logoUrl}>
      <h2 className="mb-4 text-center text-xl font-semibold">Create account</h2>
      {isSuccess ? (
        <Alert kind="success">
          Your account for {email} is ready. If the project asks you to confirm
          your e-mail, check your inbox first.{' '}
          <Link to={ROUTES.SIGN_IN} className="underline">
            Sign in
          </Link>
        </Alert>
      ) : (
        <Form<SignUpValues>
          onSubmit={onSubmit}
          initialValues={{ email: '', password: '' }}
        >
          {({ handleSubmit, submitting }) => (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              noValidate
            >
              {error && <Alert kind="error">{signUpErrorMessage(error)}</Alert>}
              <TextInputField
                name="email"
                type="email"
                label="Email"
                autoComplete="email"
                validate={composeValidators(requiredValidator, emailValidator)}
              />
              <TextInputField
                name="password"
                type="password"
                label="Password"
                autoComplete="new-password"
                validate={composeValidators(
                  requiredValidator,
                  passwordPolicyValidator(config.auth.passwordPolicy),
                )}
              />
              <Button type="submit" block disabled={submitting || isLoading}>
                {submitting || isLoading ? <Spinner /> : 'Create account'}
              </Button>
            </form>
          )}
        </Form>
      )}
      <div className="mt-6 text-center text-sm">
        Already have an account?{' '}
        <Link to={ROUTES.SIGN_IN} className="text-brand hover:underline">
          Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
