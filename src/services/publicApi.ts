// Public (unauthenticated) endpoints: the published legal documents and the
// invitation finish. Calls go through the portal's proxy, like everything
// else.

import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { resolveProjectId, setProjectHeaders } from '@/config/project';
import { selectApiRoot } from '@/config/slice';
import { selectSelectedProjectId } from '@/features/project/slice';
import type { RootState } from '@/app/store';
import type { LegalDocument } from '@/types/user';

const dynamicBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = (args, apiArg, extra) => {
  const state = apiArg.getState() as RootState;
  // The configured project, as resolved at boot.
  const projectId = selectSelectedProjectId(state) ?? resolveProjectId();
  // Endpoints write `{projectId}` in their url; fill it in here.
  const fill = (u: string) => u.replace('{projectId}', projectId ?? '');
  const filled =
    typeof args === 'string'
      ? fill(args)
      : {
          ...args,
          url: fill(args.url),
          body:
            args.body &&
            typeof args.body === 'object' &&
            'projectId' in args.body
              ? { ...args.body, projectId: fill(String(args.body.projectId)) }
              : args.body,
        };
  const rawBaseQuery = fetchBaseQuery({
    baseUrl: selectApiRoot(state),
    prepareHeaders: (headers) => {
      setProjectHeaders(headers, projectId);
      return headers;
    },
  });
  return rawBaseQuery(filled, apiArg, extra);
};

export const publicApi = createApi({
  reducerPath: 'publicApi',
  baseQuery: dynamicBaseQuery,
  endpoints: (builder) => ({
    getLegalDocument: builder.query<LegalDocument, 'terms' | 'privacy'>({
      query: (kind) => ({
        url: `/public/projects/{projectId}/legal/${kind}`,
        method: 'GET',
      }),
      // Normalize: the endpoint returns { kind, title?, body, available }.
      transformResponse: (
        r: Partial<LegalDocument>,
        _meta,
        kind: 'terms' | 'privacy',
      ): LegalDocument => ({
        kind,
        title: r.title,
        body: r.body ?? '',
        available: r.available ?? false,
      }),
    }),
    // An invited user finishes registration (gateway registration-settings):
    // POST /membership/auth/invitation/finish — anonymous, the one-time token
    // is the proof and goes only in the body. Hand-written until the SDK
    // ships `finishInvitation`; then move it to services/norbix.ts.
    finishInvitation: builder.mutation<
      { responseStatus?: { isSuccess?: boolean } },
      FinishInvitationBody
    >({
      query: (body) => ({
        url: '/membership/auth/invitation/finish',
        method: 'POST',
        body: { ...body, projectId: '{projectId}' },
      }),
    }),
  }),
});

/** What the invited user sends; the project comes from the portal. */
export interface FinishInvitationBody {
  token: string;
  password: string;
  /** Optional: replaces the full name the admin entered (owner decision 2026-10-15 #3). */
  fullName?: string;
  /** Optional: how e-mails greet the user; empty keeps the admin's (or the name). */
  salutation?: string;
}

export const { useGetLegalDocumentQuery, useFinishInvitationMutation } =
  publicApi;
