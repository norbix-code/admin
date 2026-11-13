/**
 * Secrets in emailed links and sign-in redirects.
 *
 * New links carry a one-time token in the URL fragment
 * (`/sign-in/reset/confirm#token=…`, `/sign-up/invitation#token=…`). A browser
 * never sends the fragment to a server, so no access log (the portal's web
 * server, the ingress, a proxy) can write the token down (gateway
 * docs/tasks/link-tokens-in-fragment.md). Links sent before carry the token
 * in the query (`?token=…`) and keep working until they expire, so the
 * fragment is read first and the query second.
 *
 * After reading, the page takes the token out of the address bar
 * (`history.replaceState`): it is not kept in the browser history, shown on
 * screen or copied with the page URL.
 */

/** Where the page was opened: `window.location` or react-router's location. */
export interface LinkAddress {
  pathname?: string;
  search: string;
  hash: string;
}

const fragmentParams = (hash: string): URLSearchParams =>
  new URLSearchParams(hash.replace(/^#/, ''));

/**
 * The first of `names` that has a value: every name in the fragment first,
 * then every name in the query. Only the ends are trimmed. Empty string when
 * there is none.
 */
export const linkParam = (
  { search, hash }: LinkAddress,
  ...names: string[]
): string => {
  for (const params of [fragmentParams(hash), new URLSearchParams(search)]) {
    for (const name of names) {
      const value = (params.get(name) ?? '').trim();
      if (value) return value;
    }
  }
  return '';
};

/**
 * The address with `names` taken out of the query and the fragment, or
 * undefined when none of them is there. Other parameters stay; an empty
 * query or fragment is dropped completely.
 */
export const addressWithout = (
  { pathname = '', search, hash }: LinkAddress,
  ...names: string[]
): string | undefined => {
  const query = new URLSearchParams(search);
  const fragment = fragmentParams(hash);
  if (!names.some((name) => query.has(name) || fragment.has(name))) {
    return undefined;
  }
  for (const name of names) {
    query.delete(name);
    fragment.delete(name);
  }
  const q = query.toString();
  const f = fragment.toString();
  return `${pathname}${q ? `?${q}` : ''}${f ? `#${f}` : ''}`;
};

/** The part of `window.history` the pages use. */
export interface ReplaceableHistory {
  state: unknown;
  replaceState(data: unknown, unused: string, url?: string | null): void;
}

/**
 * Takes `names` out of the address bar. The history entry is replaced, not
 * added; its state (react-router's key) is kept. Returns true when something
 * was removed.
 */
export const removeFromAddressBar = (
  address: LinkAddress,
  history: ReplaceableHistory,
  ...names: string[]
): boolean => {
  const stripped = addressWithout(address, ...names);
  if (stripped === undefined) return false;
  history.replaceState(history.state, '', stripped);
  return true;
};
