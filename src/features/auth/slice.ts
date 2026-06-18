import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';

interface AuthState {
  token: string | null;
  userId: string | null;
}

// Auth state is persisted by redux-persist (see app/store.ts), the same way
// the Cloud store persists its auth slice — no manual localStorage here.
const initialState: AuthState = { token: null, userId: null };

const slice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signedIn(state, action: PayloadAction<{ token: string; userId: string }>) {
      state.token = action.payload.token;
      state.userId = action.payload.userId;
    },
    signedOut(state) {
      state.token = null;
      state.userId = null;
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
export const selectUserId = (state: RootState): string | null =>
  state.auth.userId;

export default slice.reducer;
