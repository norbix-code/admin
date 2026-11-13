import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts';
import {
  selectProjectBranding,
  selectProjectConfig,
} from '@/features/project/slice';
import { Alert, Spinner } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { signedIn, selectUserId } from './slice';
import { ROUTES } from '@/routes';
import { removeFromAddressBar } from './linkToken';
import {
  CALLBACK_PARAM_NAMES,
  callbackErrorMessage,
  providerLabel,
  readSocialCallback,
  socialErrorMessage,
  type SocialCallback,
} from './social';
import { exchangeSocialCode, finishLinkIdentity } from './socialApi';

/** Router state the Security page reads after a link (security.tsx). */
export interface LinkResultState {
  /** The provider that was linked. */
  linked?: string;
  /** Why the link failed, as a plain message. */
  linkError?: string;
}

/**
 * Social sign-in and link return page (`/oauth/callback`).
 *
 * The gateway sends the browser back here with a one-time `code` and
 * `provider` (plus `intent=link` for a link), or with `error=<reason>`. No
 * token is ever in the URL. The page reads the address once, takes the code
 * out of the address bar at once, then:
 *  - a sign-in code is exchanged (no credentials) for the bearer JWT, stored
 *    like a password sign-in's, and the user goes home;
 *  - a link code is finished as the signed-in user, who goes back to
 *    Security with "Linked …" or the reason it failed;
 *  - an error is shown in plain words with the sign-in button. A failed link
 *    goes back to Security instead, when the user is still signed in.
 */
export function OAuthCallback() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const branding = useAppSelector(selectProjectBranding);
  const buttons = useAppSelector(selectProjectConfig)?.auth.socialSignIn ?? [];
  const userId = useAppSelector(selectUserId);

  // Parse the URL once, on the first render (pure: StrictMode may render
  // twice). The address bar loses the code right after.
  const [answer] = useState<SocialCallback>(() => readSocialCallback(location));
  const [failure, setFailure] = useState<string | null>(() =>
    firstMessage(answer, Boolean(userId), buttons),
  );
  // A code works once: StrictMode runs effects twice, the ref keeps one call.
  const started = useRef(false);

  useEffect(() => {
    removeFromAddressBar(location, window.history, ...CALLBACK_PARAM_NAMES);
    // Once, on mount: the location read above is the one to clean.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (answer.kind === 'signIn') {
      exchangeSocialCode(answer.provider, answer.code).then(
        (res) => {
          // Navigate first: the provider re-mounts the routes on a new
          // token, and a re-mounted page must not find the code again.
          navigate(ROUTES.HOME, { replace: true });
          dispatch(
            signedIn({ token: res.bearerToken, userId: res.userId ?? '' }),
          );
        },
        (err) => setFailure(socialErrorMessage(err, answer.provider, buttons)),
      );
      return;
    }

    if (answer.kind === 'link' && userId) {
      const back = (state: LinkResultState) =>
        navigate(ROUTES.SECURITY, { replace: true, state });
      finishLinkIdentity(userId, answer.code).then(
        () => back({ linked: answer.provider }),
        (err) =>
          back({
            linkError: socialErrorMessage(err, answer.provider, buttons),
          }),
      );
      return;
    }

    if (answer.kind === 'error' && answer.link && userId) {
      const state: LinkResultState = {
        linkError: callbackErrorMessage(answer.error, answer.provider, buttons),
      };
      navigate(ROUTES.SECURITY, { replace: true, state });
    }
    // Once, on mount: the answer is read once and the code works once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthLayout brandName={branding?.displayName} logoUrl={branding?.logoUrl}>
      {failure ? (
        <>
          <Alert kind="error">{failure}</Alert>
          <div className="mt-6 flex justify-center">
            <Link
              to={ROUTES.SIGN_IN}
              className="inline-flex items-center justify-center rounded-token bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition hover:bg-brand-hover"
            >
              Sign in
            </Link>
          </div>
        </>
      ) : (
        <div className="flex justify-center py-6">
          <Spinner
            label={answer.kind === 'link' ? 'Linking…' : 'Signing you in…'}
          />
        </div>
      )}
    </AuthLayout>
  );
}

/**
 * The message to show at once, or null while a call is on its way (or the
 * page is about to go back to Security).
 */
function firstMessage(
  answer: SocialCallback,
  signedIn: boolean,
  buttons: Parameters<typeof providerLabel>[1],
): string | null {
  switch (answer.kind) {
    case 'signIn':
      return null;
    case 'link':
      return signedIn
        ? null
        : `Your session has ended. Sign in, then link ${providerLabel(answer.provider, buttons)} again from Security.`;
    case 'error':
      return answer.link && signedIn
        ? null
        : callbackErrorMessage(answer.error, answer.provider, buttons);
    case 'token':
      // The passkey recovery e-mail still links here with #token=…; that
      // token must be consumed (…/recovery/magic-link/consume), which this
      // page does not do. Never store it as a session.
      return 'This sign-in link cannot be used here. Please sign in another way.';
    case 'none':
      return 'Sign-in did not complete. Please try again.';
  }
}
