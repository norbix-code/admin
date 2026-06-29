// Store backbone — mirrors the Cloud project's src/app/store.ts so the two
// apps share the same state-management shape:
//   combineReducers → persistReducer (RTK Query caches blacklisted) →
//   root reducer with an `auth/reset` hard-purge → createStore factory with
//   listener middleware + RTK Query middleware + setupListeners.
//
// Admin has far fewer feature slices than Cloud, but the structure is 1:1 so
// adding slices later (e.g. the future "own records" feature) follows the same
// pattern.

import {
  configureStore,
  combineReducers,
  Reducer,
  Action,
  ConfigureStoreOptions,
} from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { setupListeners } from '@reduxjs/toolkit/query';

import { norbixApi } from '@/services/norbix';
import { api } from '@/services/api';
import { publicApi } from '@/services/publicApi';
import { hub } from '@/services/hub';
import auth from '@/features/auth/slice';
import config from '@/config/slice';
import { IS_DEV } from '@/config/env';
import project from '@/features/project/slice';
import { listenerMiddleware } from '@/app/middlewares/listener';
import { rtkQueryErrorLogger } from '@/app/middlewares/errorCatching';

// ── combine all reducers ────────────────────────────────────────────
// Data-plane endpoints come from the Norbix SDK slice (@norbix/react-redux):
// login, logout, profile, preferences. The app-owned `api` slice still backs
// the endpoints the SDK does NOT yet expose (password change/reset, 2FA,
// compliance) — these move to the SDK once @norbix.ai/ts adds them, with no
// store restructuring. `hub` (/echo) and `publicApi` (login-config + legal)
// remain app-owned by design.
const reducers = combineReducers({
  config,
  project,
  auth,
  [hub.reducerPath]: hub.reducer,
  [norbixApi.reducerPath]: norbixApi.reducer,
  [api.reducerPath]: api.reducer,
  [publicApi.reducerPath]: publicApi.reducer,
});

const PERSIST_KEY = 'norbix-admin';

const persistConfig = {
  key: PERSIST_KEY,
  storage,
  // RTK Query caches must NOT be persisted — they re-fetch on load and a stale
  // persisted cache would serve outdated data. Same rule as the Cloud store.
  blacklist: [
    hub.reducerPath,
    norbixApi.reducerPath,
    api.reducerPath,
    publicApi.reducerPath,
  ],
};

export const persistedReducer = persistReducer(persistConfig, reducers);

// ── root reducer with the global hard-reset ─────────────────────────
// On `auth/reset` we wipe the persisted tree (full sign-out), exactly like
// Cloud clears 'persist:root'.
const rootReducer: Reducer = (state: RootState | undefined, action: Action) => {
  if (action.type === 'auth/reset') {
    storage.removeItem(`persist:${PERSIST_KEY}`);
    state = undefined;
  }
  return persistedReducer(state, action);
};

// ── store factory ───────────────────────────────────────────────────
export const createStore = (
  options?: ConfigureStoreOptions['preloadedState'],
) =>
  configureStore({
    reducer: rootReducer,
    devTools: IS_DEV,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // redux-persist dispatches non-serializable actions; ignore them.
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      })
        // Listener middleware can receive actions with functions inside, so it
        // must go before the serializability check (same note as Cloud).
        .prepend(listenerMiddleware.middleware)
        .concat(
          hub.middleware,
          norbixApi.middleware,
          api.middleware,
          publicApi.middleware,
          rtkQueryErrorLogger,
        ),
    preloadedState: options,
  });

export const store = createStore();
export const persistor = persistStore(store);

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

setupListeners(store.dispatch);
