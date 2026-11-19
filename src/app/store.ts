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
import { publicApi } from '@/services/publicApi';
import { hub } from '@/services/hub';
import { portalApi } from '@/services/portalApi';
import { api } from '@/services/api';
import aiChat from '@/features/aiChat/slice';
import auth from '@/features/auth/slice';
import config from '@/config/slice';
import { IS_DEV } from '@/config/env';
import project from '@/features/project/slice';
import { listenerMiddleware } from '@/app/middlewares/listener';
import { rtkQueryErrorLogger } from '@/app/middlewares/errorCatching';

// ── combine all reducers ────────────────────────────────────────────
// Data-plane endpoints (sign-in, sign-out, profile, preferences, passkeys) come
// from the Norbix SDK slice `norbixApi` (@norbix.ai/react-redux). `hub`
// (/echo), `publicApi` (legal documents, invitation), `portalApi` (the
// portal's own backend) and `api` (the end-user AI chat) are small slices of
// this app.
const reducers = combineReducers({
  config,
  project,
  auth,
  aiChat,
  [hub.reducerPath]: hub.reducer,
  [api.reducerPath]: api.reducer,
  [norbixApi.reducerPath]: norbixApi.reducer,
  [publicApi.reducerPath]: publicApi.reducer,
  [portalApi.reducerPath]: portalApi.reducer,
});

const PERSIST_KEY = 'norbix-admin';

const persistConfig = {
  key: PERSIST_KEY,
  storage,
  // RTK Query caches must NOT be persisted — they re-fetch on load and a stale
  // persisted cache would serve outdated data. Same rule as the Cloud store.
  blacklist: [
    // The open chat is re-read from the entries endpoint on load; a persisted
    // transcript or a half-sent turn would only resurrect stale state.
    'aiChat',
    api.reducerPath,
    hub.reducerPath,
    norbixApi.reducerPath,
    publicApi.reducerPath,
    portalApi.reducerPath,
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
          api.middleware,
          norbixApi.middleware,
          publicApi.middleware,
          portalApi.middleware,
          rtkQueryErrorLogger,
        ),
    preloadedState: options,
  });

export const store = createStore();
export const persistor = persistStore(store);

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;

setupListeners(store.dispatch);
