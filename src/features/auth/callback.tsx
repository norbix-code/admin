import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts';
import { selectProjectBranding } from '@/features/project/slice';
import { Alert, Spinner } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { signedIn } from './slice';
import { ROUTES } from '@/routes';
import {
  CALLBACK_TOKEN_NAMES,
  readCallback,
  removeFromAddressBar,
} from './linkToken';

/**
 * OAuth / social sign-in return handler.
 *
 * Social and passkey-recovery sign-in are full-page navigations to the API,
 * which owns the provider redirect and the token exchange. The API sends the
 * browser back here with either a bearer token or an error. We read it once,
 * take the token out of the address bar at once, store it in the auth slice
 * (which the SDK client and persist layer pick up), and bounce to the app.
 *
 * Accepted params (any of these token names): `token`, `bearerToken`,
 * `access_token`; plus optional `userId`/`user_id`; or `error`. Each is read
 * from the URL fragment first (`#token=…` — never sent to a server, so never
 * in an access log), then from the query (links and redirects that still use
 * `?token=…`).
 */
export function OAuthCallback() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const branding = useAppSelector(selectProjectBranding);
  const navigate = useNavigate();

  // Parse the URL once, on the first render (pure: StrictMode may render
  // twice). The address bar loses the token right after, so it is never
  // read again. The token branch is the only side effect, handled below.
  const [result] = useState(() => readCallback(location));

  const error = 'error' in result ? result.error : null;

  useEffect(() => {
    removeFromAddressBar(location, window.history, ...CALLBACK_TOKEN_NAMES);
    // Once, on mount: the location read above is the one to clean.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ('token' in result) {
      dispatch(signedIn({ token: result.token, userId: result.userId }));
      navigate(ROUTES.HOME, { replace: true });
    }
  }, [result, dispatch, navigate]);

  return (
    <AuthLayout brandName={branding?.displayName} logoUrl={branding?.logoUrl}>
      {error ? (
        <>
          <Alert kind="error">{error}</Alert>
          <div className="mt-6 text-center text-sm">
            <Link to={ROUTES.SIGN_IN} className="text-brand hover:underline">
              Back to sign in
            </Link>
          </div>
        </>
      ) : (
        <div className="flex justify-center py-6">
          <Spinner label="Signing you in…" />
        </div>
      )}
    </AuthLayout>
  );
}
