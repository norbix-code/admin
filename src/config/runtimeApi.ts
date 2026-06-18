// Module-level holder for the resolved API root, set once /echo resolves.
//
// Most API calls go through RTK Query (which reads the API root from the store
// at request time). But two call sites run outside the store/React tree:
//   - loadLoginConfig() during boot (fetches the public login-config)
//   - the OAuth redirect in the login screen (a full-page navigation)
// They read the resolved root from here, falling back to the env value before
// echo has resolved.

import type { EchoResponse } from '@/types/echo';

// Empty until /echo resolves. The portal blocks the UI on echo, so the two
// out-of-store callers (public config fetch during boot, OAuth/passkey
// full-page navigation) only read this after it's set.
let apiRoot = '';

export function setRuntimeApiRoot(echo: EchoResponse): void {
  if (echo.apiUrl) apiRoot = echo.apiUrl.replace(/\/$/, '');
}

export function getRuntimeApiRoot(): string {
  return apiRoot;
}
