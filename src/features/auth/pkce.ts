/**
 * PKCE between the portal and the gateway (gateway c24dcc4d9, step 16).
 *
 * Every sign-in start and every link start sends an S256 `codeChallenge`;
 * the exchange and the link finish send the matching `codeVerifier`. The
 * gateway binds the one-time code to the challenge, so a code handed to
 * another browser (or tab) is useless there: CM-ERRORS-MEMBERSHIP-058.
 *
 * The verifier lives in sessionStorage (this tab only; it survives the trip
 * to the provider and back) under the SDK's own key,
 * `norbix:pkce:<signIn|link>:<provider>`. It is read once and removed: after
 * use and after a failure alike.
 *
 * With no usable sessionStorage the start goes without a challenge (the
 * gateway still accepts a code started without one); a verifier is never
 * sent for such a code.
 */
import { createPkcePair } from '@norbix.ai/ts';

export type PkceKind = 'signIn' | 'link';

const keyOf = (kind: PkceKind, provider: string) =>
  `norbix:pkce:${kind}:${provider.trim().toLowerCase()}`;

const storage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

/**
 * Make a verifier for a new start, keep it, and answer its challenge. Null
 * when it cannot be kept (no sessionStorage, no Web Crypto): start without.
 */
export async function beginPkce(
  kind: PkceKind,
  provider: string,
): Promise<string | null> {
  const store = storage();
  if (!store) return null;
  try {
    const { codeVerifier, codeChallenge } = await createPkcePair();
    store.setItem(keyOf(kind, provider), codeVerifier);
    return codeChallenge;
  } catch {
    try {
      store.removeItem(keyOf(kind, provider));
    } catch {
      /* nothing kept */
    }
    return null;
  }
}

/** The kept verifier, removed as it is read (once only). */
export function takePkceVerifier(
  kind: PkceKind,
  provider: string,
): string | undefined {
  const store = storage();
  if (!store) return undefined;
  try {
    const key = keyOf(kind, provider);
    const verifier = store.getItem(key) ?? undefined;
    store.removeItem(key);
    return verifier || undefined;
  } catch {
    return undefined;
  }
}

/** Drop a kept verifier (a start that failed before leaving the page). */
export function clearPkceVerifier(kind: PkceKind, provider: string): void {
  try {
    storage()?.removeItem(keyOf(kind, provider));
  } catch {
    /* nothing to drop */
  }
}
