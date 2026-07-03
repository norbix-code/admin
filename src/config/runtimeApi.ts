// Module-level holder for the resolved API root, set once /echo resolves.
//
// Most API calls go through RTK Query (which reads the API root from the store
// at request time). But two call sites run outside the store/React tree:
//   - loadLoginConfig() during boot (fetches the public login-config)
//   - the OAuth redirect in the login screen (a full-page navigation)
// They read the resolved root from here, falling back to the env value before
// echo has resolved.

import type { EchoResponse } from '@/types/echo';
import { API_PROXY_ROOT } from './env';

// The API root is the same-origin BFF proxy (/api/proxy/api/v3), available
// immediately — the browser never targets the gateway host. echo no longer
// determines the base URL; it is kept for regions/release only.
const apiRoot = API_PROXY_ROOT;

// Kept for call-site compatibility during the migration. The proxy base is
// fixed, so resolving echo no longer changes the API root.
export function setRuntimeApiRoot(_echo: EchoResponse): void {
  /* no-op: the API root is the same-origin proxy, not echo's apiUrl */
}

export function getRuntimeApiRoot(): string {
  return apiRoot;
}
