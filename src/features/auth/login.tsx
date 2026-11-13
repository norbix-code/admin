import { useEffect, useRef } from 'react';
import { Form } from 'react-final-form';
import { useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts';
import { Button, Alert, Spinner } from '@/components/ui';
import { TextInputField } from '@/components/forms/fields';
import { requiredValidator } from '@/components/forms/validators';
import { useLoginMutation } from '@/services/norbix';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { signedIn, selectIsAuthenticated } from './slice';
import { PasskeySignInButton } from './passkeySignIn';
import { isWebAuthnAvailable } from './webauthn';
import { useGetLegalDocumentQuery } from '@/services/publicApi';
import { ROUTES } from '@/routes';
import type { ProjectConfig, AuthMethod } from '@/types/projectConfig';
import { selectEcho } from '@/config/slice';
import { beginPkce } from './pkce';
import { goTo } from './socialApi';
import {
  passwordChangeRequiredOf,
  type PasswordChangeState,
} from './passwordChange';
import {
  apiHostRoot,
  socialButtons,
  socialReturnUrl,
  socialStartUrl,
} from './social';

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

interface LoginFormValues {
  userName: string;
  password: string;
}

export function Login({ config }: { config: ProjectConfig }) {
  const [login, { isLoading, isError }] = useLoginMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  // Social sign-in starts on the real API host (echo apiUrl), not the proxy.
  const apiRoot = apiHostRoot(useAppSelector(selectEcho)?.apiUrl);

  const { passkey, methods } = config.auth;
  // One button per enabled social sign-in integration of the env; none
  // without the API host to send the browser to.
  const social = apiRoot ? socialButtons(config.auth.socialSignIn) : [];
  // Where to go once signed in: home, or the change-password step when the
  // answer says the password breaks the project's current rules. Set before
  // the token lands, so the effect below reads it in the same render.
  const next = useRef<{ to: string; state?: PasswordChangeState }>({
    to: ROUTES.HOME,
  });
  // The passkey button renders nothing without WebAuthn, so only count it when
  // the browser can use it — otherwise "or continue with" would stand alone.
  const showPasskey = passkey && isWebAuthnAvailable();
  const { termsUrl, privacyUrl } = useLegalLinks(config);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(next.current.to, { replace: true, state: next.current.state });
    }
  }, [isAuthenticated, navigate]);

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const res = await login({
        provider: 'credentials',
        userName: values.userName,
        password: values.password,
      }).unwrap();
      if (res.bearerToken) {
        if (passwordChangeRequiredOf(res)) {
          next.current = {
            to: ROUTES.SECURITY_PASSWORD,
            state: { required: true, userName: values.userName },
          };
        }
        dispatch(
          signedIn({
            token: res.bearerToken,
            userId: res.userId ?? '',
            loginName: values.userName,
          }),
        );
      }
    } catch {
      /* surfaced via isError */
    }
  };

  // Social sign-in is a full-page navigation to the API host, which owns the
  // provider redirect and the secrets; it comes back to /oauth/callback with
  // a one-time code (callback.tsx). Each start makes a PKCE pair first: the
  // verifier stays in this tab, the challenge goes in the URL.
  // Not disabled while starting: a page restored from the back-forward
  // cache must not come back with dead buttons. A second click makes a new
  // pair, and the last navigation wins with the last verifier.
  const startSocial = async (provider: string, startPath: string) => {
    const codeChallenge = await beginPkce('signIn', provider);
    goTo(
      socialStartUrl(
        apiRoot ?? '',
        startPath,
        socialReturnUrl(window.location.origin, provider),
        codeChallenge,
      ),
    );
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

      <Form<LoginFormValues>
        onSubmit={onSubmit}
        initialValues={{ userName: '', password: '' }}
      >
        {({ handleSubmit, submitting }) => (
          <form
            onSubmit={handleSubmit}
            className="mt-4 flex flex-col gap-4"
            noValidate
          >
            <TextInputField
              name="userName"
              type={identifierInputType(methods)}
              label={identifierLabel(methods)}
              autoComplete="username"
              validate={requiredValidator}
            />
            {/* Required only: a password set under older, looser rules must
                still reach the gateway, which signs the user in and asks for a
                new one (meta.passwordChangeRequired). */}
            <TextInputField
              name="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              validate={requiredValidator}
            />
            <Button type="submit" block disabled={submitting || isLoading}>
              {submitting || isLoading ? <Spinner /> : 'Sign in'}
            </Button>
          </form>
        )}
      </Form>

      {(social.length > 0 || showPasskey) && (
        <div className="mt-6">
          <div className="mb-4 text-center text-xs text-fg-muted">
            or continue with
          </div>
          <div className="flex flex-col gap-2">
            {showPasskey && <PasskeySignInButton />}
            {social.map((b) => (
              <Button
                key={b.provider}
                type="button"
                variant="secondary"
                block
                onClick={() => void startSocial(b.provider, b.startPath)}
              >
                Continue with {b.displayName}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-between text-sm">
        <Link to={ROUTES.PASSWORD_RESET} className="text-brand hover:underline">
          Forgot password?
        </Link>
      </div>

      {(termsUrl || privacyUrl) && (
        <div className="mt-8 text-center text-xs text-fg-subtle">
          {termsUrl && (
            <a href={termsUrl} className="hover:underline">
              Terms
            </a>
          )}
          {termsUrl && privacyUrl && ' · '}
          {privacyUrl && (
            <a href={privacyUrl} className="hover:underline">
              Privacy
            </a>
          )}
        </div>
      )}
    </AuthLayout>
  );
}

/**
 * Terms / Privacy links under the sign-in form. A link set in the project
 * config wins; otherwise the portal's own /legal/* page is linked when Cloud
 * has published that document (Project Settings → Access, "expose legal").
 */
function useLegalLinks(config: ProjectConfig): {
  termsUrl?: string;
  privacyUrl?: string;
} {
  const terms = useGetLegalDocumentQuery('terms', {
    skip: Boolean(config.links.termsUrl),
  });
  const privacy = useGetLegalDocumentQuery('privacy', {
    skip: Boolean(config.links.privacyUrl),
  });
  return {
    termsUrl:
      config.links.termsUrl ??
      (terms.data?.available ? ROUTES.LEGAL_TERMS : undefined),
    privacyUrl:
      config.links.privacyUrl ??
      (privacy.data?.available ? ROUTES.LEGAL_PRIVACY : undefined),
  };
}
