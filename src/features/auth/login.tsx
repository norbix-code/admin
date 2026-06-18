import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts';
import { Button, TextField, Alert, Spinner } from '@/components/ui';
import { useLoginMutation } from '@/services/norbix';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { signedIn, selectIsAuthenticated } from './slice';
import { PasskeySignInButton } from './passkeySignIn';
import { ROUTES } from '@/routes';
import type {
  ProjectConfig,
  SocialProviderId,
  AuthMethod,
} from '@/types/projectConfig';
import { getRuntimeApiRoot } from '@/config/runtimeApi';
import { resolveProjectId } from '@/config/project';

const SOCIAL_LABEL: Record<SocialProviderId, string> = {
  google: 'Google',
  github: 'GitHub',
  facebook: 'Facebook',
  apple: 'Apple',
  microsoft: 'Microsoft',
};

// Label for the identifier field, derived from the project's auth methods.
const METHOD_LABEL: Record<AuthMethod, string> = {
  email: 'Email',
  phone: 'Phone',
  username: 'Username',
};

function identifierLabel(methods: AuthMethod[]): string {
  if (methods.length === 0) return 'Email';
  return methods.map((m) => METHOD_LABEL[m]).join(' or ');
}

function identifierInputType(methods: AuthMethod[]): string {
  // Only pin a strict input type when there's a single method.
  if (methods.length === 1 && methods[0] === 'email') return 'email';
  return 'text';
}

export function Login({ config }: { config: ProjectConfig }) {
  const [login, { isLoading, isError }] = useLoginMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');

  const { socialProviders, passkey, methods, passwordPolicy } = config.auth;

  useEffect(() => {
    if (isAuthenticated) navigate(ROUTES.HOME, { replace: true });
  }, [isAuthenticated, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await login({
        provider: 'credentials',
        userName,
        password,
      }).unwrap();
      if (res.bearerToken) {
        dispatch(
          signedIn({ token: res.bearerToken, userId: res.userId ?? '' }),
        );
      }
    } catch {
      /* surfaced via isError */
    }
  };

  // Social sign-in is a full-page navigation to the API; the backend owns the
  // OAuth redirect + secrets. We only know THAT a provider exists.
  const socialHref = (provider: SocialProviderId) => {
    const projectId = resolveProjectId() ?? config.projectId;
    return `${getRuntimeApiRoot()}/auth/${provider}?projectId=${projectId}`;
  };

  return (
    <AuthLayout
      brandName={config.branding.displayName}
      logoUrl={config.branding.logoUrl}
    >
      <h2 className="mb-6 text-center text-xl font-semibold text-fg">
        Sign in to {config.branding.displayName}
      </h2>

      {isError && <Alert kind="error">Invalid credentials.</Alert>}

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <TextField
          name="userName"
          type={identifierInputType(methods)}
          label={identifierLabel(methods)}
          autoComplete="username"
          required
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
        />
        <TextField
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
          minLength={passwordPolicy.minLength}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {passwordPolicy.minLength > 0 && (
          <p className="-mt-2 text-xs text-fg-subtle">
            Minimum {passwordPolicy.minLength} characters
            {passwordPolicy.minNumbers
              ? `, ${passwordPolicy.minNumbers} number(s)`
              : ''}
            {passwordPolicy.minUpper
              ? `, ${passwordPolicy.minUpper} uppercase`
              : ''}
            {passwordPolicy.minSpecial
              ? `, ${passwordPolicy.minSpecial} special`
              : ''}
            .
          </p>
        )}
        <Button type="submit" block disabled={isLoading}>
          {isLoading ? <Spinner /> : 'Sign in'}
        </Button>
      </form>

      {(socialProviders.length > 0 || passkey) && (
        <div className="mt-6">
          <div className="mb-4 text-center text-xs text-fg-muted">
            or continue with
          </div>
          <div className="flex flex-col gap-2">
            {passkey && <PasskeySignInButton />}
            {socialProviders.map((p) => (
              <a
                key={p}
                href={socialHref(p)}
                className="inline-flex w-full items-center justify-center rounded-token bg-surface px-4 py-2 text-sm font-medium text-fg ring-1 ring-inset ring-border-token transition hover:bg-app"
              >
                Continue with {SOCIAL_LABEL[p]}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-between text-sm">
        <Link to={ROUTES.PASSWORD_RESET} className="text-brand hover:underline">
          Forgot password?
        </Link>
      </div>

      {(config.links.termsUrl || config.links.privacyUrl) && (
        <div className="mt-8 text-center text-xs text-fg-subtle">
          {config.links.termsUrl && (
            <a href={config.links.termsUrl} className="hover:underline">
              Terms
            </a>
          )}
          {config.links.termsUrl && config.links.privacyUrl && ' · '}
          {config.links.privacyUrl && (
            <a href={config.links.privacyUrl} className="hover:underline">
              Privacy
            </a>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
