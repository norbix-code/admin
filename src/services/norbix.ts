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
import { API_VERSION } from '@/config/env';

interface ClientParams {
  apiBaseUrl: string;
  apiVersion: string;
  projectId: string | undefined;
  bearerToken: string | undefined;
}

// The API base is empty until /echo resolves (setNorbixApiBase) and the project
// id is set once resolved (setNorbixProjectId). The portal blocks the UI on echo
// + project resolution, so no request is made before both are set.
let params: ClientParams = {
  apiBaseUrl: '',
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

function build(p: ClientParams): Norbix {
  return new Norbix({
    projectId: p.projectId,
    bearerToken: p.bearerToken,
    apiVersion: p.apiVersion,
    baseUrl: { api: p.apiBaseUrl },
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

/** Point the client at the API URL discovered from /echo. */
export function setNorbixApiBase(apiUrl: string, apiVersion?: string): void {
  // echo's apiUrl is already versioned (e.g. http://host/v3); strip the
  // version segment so the SDK composes routes with its apiVersion.
  const m = /^(.*)\/(v\d+)\/?$/.exec(apiUrl);
  const base = m ? m[1] : apiUrl.replace(/\/$/, '');
  const version = apiVersion ?? (m ? m[2] : params.apiVersion);
  params = { ...params, apiBaseUrl: base, apiVersion: version };
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
