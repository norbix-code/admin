import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import { resolveLoginId } from './loginId';

interface AuthState {
  token: string | null;
  /** The `usr_` login id (see loginId.ts) — never the numeric /auth userId. */
  userId: string | null;
  /**
   * The name typed at a password sign-in (email, phone or user name). A
   * password change ends the session it was made with, so the portal signs in
   * again with it and the new password. Null after a passkey or social sign-in.
   */
  loginName?: string | null;
}

// Auth state is persisted by redux-persist (see app/store.ts), the same way
// the Cloud store persists its auth slice — no manual localStorage here.
const initialState: AuthState = { token: null, userId: null, loginName: null };

const slice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(
      state,
      action: PayloadAction<{
        token: string;
        userId: string;
        loginName?: string;
      }>,
    ) {
      state.token = action.payload.token;
      state.loginName = action.payload.loginName ?? null;
      state.userId = resolveLoginId(
        action.payload.token,
        action.payload.userId,
      );
    },
    signedOut(state) {
      state.token = null;
      state.userId = null;
      state.loginName = null;
    },
    // `auth/reset` is intercepted by the root reducer (store.ts) to purge the
    // whole persisted tree. Mirrors the Cloud store's hard sign-out reset.
    reset() {
      /* handled in the root reducer */
    },
  },
});

export const { signedIn, signedOut, reset } = slice.actions;

export const selectIsAuthenticated = (state: RootState): boolean =>
  Boolean(state.auth.token);
// Re-derived from the token so a session persisted before this fix (userId "2")
// also gets the usr_ id without signing in again.
export const selectLoginName = (state: RootState): string | null =>
  state.auth.loginName ?? null;

export const selectUserId = (state: RootState): string | null =>
  resolveLoginId(state.auth.token, state.auth.userId);

export default slice.reducer;
