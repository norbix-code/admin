'use client';

// Client shell that mounts the EXISTING React Router SPA (src/App.tsx) inside
// the Next.js app. This is the phased-migration bridge: the whole current UI
// works under the Next standalone server with zero per-screen rewrite, and
// individual routes can be converted to native Next routes incrementally.
//
// Why client-only + mount gate:
//   • src/App.tsx uses react-router's BrowserRouter (needs window).
//   • the Redux store calls persistStore() at import (touches localStorage).
//   • redux-persist's PersistGate is a client concern.
// So we render nothing on the server and on the first client paint, then mount
// after the component is on the client — avoiding any hydration mismatch.
import { useSyncExternalStore } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from '@/app/store';
import App from '@/App';

// useSyncExternalStore returns the server snapshot (false) during SSR + the
// first client render, then the client snapshot (true) — without a setState in
// an effect. A no-op subscribe is fine: "are we on the client" never changes
// after mount.
const noop = () => () => {};
function useIsClient(): boolean {
  return useSyncExternalStore(
    noop,
    () => true, // client snapshot
    () => false, // server snapshot
  );
}

export default function SpaShell() {
  const isClient = useIsClient();

  // Server render + first client paint: render nothing (the SPA owns its own
  // loading UI once mounted). Prevents BrowserRouter/persist from running on
  // the server.
  if (!isClient) return null;

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  );
}
