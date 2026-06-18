import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layouts';
import { Alert, Spinner } from '@/components/ui';
import { useAppDispatch } from '@/app/hooks';
import { signedIn } from './slice';
import { ROUTES } from '@/routes';

/**
 * OAuth / social sign-in return handler.
 *
 * Social and passkey-recovery sign-in are full-page navigations to the API,
 * which owns the provider redirect and the token exchange. The API sends the
 * browser back here with either a bearer token or an error in the query
 * string. We read it once, store it in the auth slice (which the SDK client
 * and persist layer pick up), and bounce to the app.
 *
 * Accepted params (any of these token names): `token`, `bearerToken`,
 * `access_token`; plus optional `userId`/`user_id`; or `error`.
 */
export function OAuthCallback() {
  const [params] = useSearchParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Parse the URL once (pure) — no setState needed. The token branch is the
  // only side effect, handled in the effect below.
  const result = useMemo<
    { token: string; userId: string } | { error: string }
  >(() => {
    const token =
      params.get('token') ??
      params.get('bearerToken') ??
      params.get('access_token');
    const userId = params.get('userId') ?? params.get('user_id') ?? '';
    const errParam = params.get('error') ?? params.get('error_description');
    if (errParam) return { error: errParam };
    if (token) return { token, userId };
    return { error: 'Sign-in did not complete. No token was returned.' };
  }, [params]);

  const error = 'error' in result ? result.error : null;

  useEffect(() => {
    if ('token' in result) {
      dispatch(signedIn({ token: result.token, userId: result.userId }));
      navigate(ROUTES.HOME, { replace: true });
    }
  }, [result, dispatch, navigate]);

  return (
    <AuthLayout>
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
