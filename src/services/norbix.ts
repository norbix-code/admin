// The Norbix SDK wiring for the admin portal.
//
// We use @norbix/react-redux (RTK Query over the typed @norbix.ai/ts client)
// instead of hand-written services. The client is project-scoped (projectId
// from the subdomain) and points at the API URL discovered from /echo. The
// bearer token comes from the auth slice after sign-in.
//
// `createNorbixApi(() => getClient())` reads the client lazily on every
// request, so we can swap the client (new token, resolved API URL) without
// recreating the API slice.

import { Norbix } from '@norbix.ai/ts';
import { createNorbixApi } from '@norbix/react-redux';
import { API_VERSION, API_PROXY_BASE, HUB_PROXY_BASE } from '@/config/env';

interface ClientParams {
  apiVersion: string;
  projectId: string | undefined;
  bearerToken: string | undefined;
}

// The SDK talks to the SAME-ORIGIN BFF proxy, not the gateway directly. The
// proxy re-targets to the real Hub/API on the server. So the base URLs are
// fixed relative paths (/api/proxy/{api|hub}) and only the project id + bearer
// token change at runtime.
let params: ClientParams = {
  apiVersion: API_VERSION,
  projectId: undefined,
  bearerToken: undefined,
};

// The client is built LAZILY. The Norbix constructor throws if `projectId` is
// missing, and at boot (e.g. http://localhost with no pr_ subdomain) there is
// no project yet — building eagerly would crash the whole app to a blank page
// before the "no project" placeholder can render. So we only construct on
// first actual use, and rebuild when params change.
let client: Norbix | undefined;

function sameOriginProxyBase(path: string): string {
  if (typeof window === 'undefined') {
    throw new Error(
      'Norbix proxy base URLs require a browser context (same-origin absolute URL).',
    );
  }
  return new URL(path, window.location.origin).href.replace(/\/$/, '');
}

function build(p: ClientParams): Norbix {
  return new Norbix({
    projectId: p.projectId,
    bearerToken: p.bearerToken,
    apiVersion: p.apiVersion,
    // Both targets go through the same-origin BFF proxy. The SDK requires
    // absolute http(s) base URLs, so resolve against window.location.origin.
    baseUrl: {
      api: sameOriginProxyBase(API_PROXY_BASE),
      hub: sameOriginProxyBase(HUB_PROXY_BASE),
    },
  });
}

/**
 * The live client, built on demand and read lazily by the RTK Query base
 * query. Constructing it requires a projectId; callers only reach a data
 * request once a project is resolved, so this is safe by then.
 */
export function getNorbixClient(): Norbix {
  if (!client) client = build(params);
  return client;
}

/** Drop the cached client so the next getNorbixClient() rebuilds with `params`. */
function invalidateClient(): void {
  client = undefined;
}

/**
 * Update the API version from /echo. The base URL is the fixed BFF proxy and
 * does NOT change — only the version segment the SDK appends.
 */
export function setNorbixApiBase(apiUrl: string, apiVersion?: string): void {
  // echo's apiUrl is versioned (e.g. http://host/v3); take the version only.
  const m = /^(.*)\/(v\d+)\/?$/.exec(apiUrl);
  const version = apiVersion ?? (m ? m[2] : params.apiVersion);
  params = { ...params, apiVersion: version };
  invalidateClient();
}

/** Set/refresh the project id (e.g. once resolved from the subdomain). */
export function setNorbixProjectId(projectId: string | undefined): void {
  params = { ...params, projectId };
  invalidateClient();
}

/** Update the bearer token after sign-in / sign-out. */
export function setNorbixToken(token: string | undefined): void {
  params = { ...params, bearerToken: token };
  invalidateClient();
}

export const norbixApi = createNorbixApi(() => getNorbixClient());

// The hooks the admin portal uses, re-exported under stable names. These come
// straight from the SDK slice — no hand-written endpoints. Add more here as
// features adopt them (the full SDK surface is available on `norbixApi`).
export const {
  // auth
  useLoginMutation,
  useLogoutMutation,
  // profile (membership user)
  useGetUserQuery,
  useUpdateUserMutation,
  // marketing / notification preferences
  useGetUserPreferencesQuery,
  useUpdateUserPreferencesMutation,
  // email verification (gates passkey registration: confirm returns a token)
  useStartEmailVerificationMutation,
  useConfirmEmailVerificationMutation,
  // password — change (authed) + reset (anonymous)
  useChangePasswordMutation,
  useRequestPasswordResetMutation,
  useConfirmPasswordResetMutation,
  // passkeys — registration, authentication, and management
  usePasskeyRegistrationOptionsMutation,
  useVerifyPasskeyRegistrationMutation,
  usePasskeyAuthenticationOptionsMutation,
  useVerifyPasskeyAuthenticationMutation,
  useListPasskeysQuery,
  useRenamePasskeyMutation,
  useRevokePasskeyMutation,
  // public (unauthenticated) project bootstrap: brand + auth options + legal
  useGetPublicProjectConfigQuery,
  useGetPublicProjectLegalQuery,
} = norbixApi;
