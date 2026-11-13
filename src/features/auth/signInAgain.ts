import { useNavigate } from 'react-router-dom';
import { useLoginMutation } from '@/services/norbix';
import { useAppDispatch } from '@/app/hooks';
import { ROUTES } from '@/routes';
import { reset, signedIn, signedOut } from './slice';

/**
 * After a successful password change: sign in again with the new password and
 * go on to `to`. The change ends the session it was made with — the gateway
 * refuses a token that names an older credential version (`cm_cv`, 401
 * CM-ERRORS-MEMBERSHIP-USERS-050) — so the old token cannot continue.
 *
 * Without a login name, or when that sign-in fails, the user is signed out and
 * sent to the sign-in screen to sign in with the new password by hand.
 */
export function useSignInAgain() {
  const [login] = useLoginMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return async (
    loginName: string | null | undefined,
    password: string,
    to: string,
    state?: unknown,
  ): Promise<boolean> => {
    if (loginName) {
      try {
        const res = await login({
          provider: 'credentials',
          userName: loginName,
          password,
        }).unwrap();
        if (res.bearerToken) {
          // Navigate first: the provider re-mounts the routes on a new token,
          // and the router state must already be in the history entry.
          navigate(to, { replace: true, state });
          dispatch(
            signedIn({
              token: res.bearerToken,
              userId: res.userId ?? '',
              loginName,
            }),
          );
          return true;
        }
      } catch {
        /* fall through: sign in by hand */
      }
    }
    // signedOut drops the token at once; reset purges the persisted tree
    // (handled by the root reducer, as the sidebar's sign-out does).
    dispatch(signedOut());
    dispatch(reset());
    navigate(ROUTES.SIGN_IN, { replace: true });
    return false;
  };
}
