// Public (unauthenticated) endpoints: published legal documents. The login
// config itself is loaded by config/loginConfig.ts (static-then-dynamic), not
// here, because it must resolve before the store is even useful.
//
// Like the authed api, the base URL is resolved at request time from the
// /echo response (config slice), falling back to the env value.

import {
  createApi,
  fetchBaseQuery,
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import { resolveProjectId } from '@/config/project';
import { selectApiRoot } from '@/config/slice';
import type { RootState } from '@/app/store';
import type { LegalDocument } from '@/types/user';

const dynamicBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = (args, apiArg, extra) => {
  const state = apiArg.getState() as RootState;
  const projectId = resolveProjectId();
  const rawBaseQuery = fetchBaseQuery({
    baseUrl: selectApiRoot(state),
    prepareHeaders: (headers) => {
      if (projectId) headers.set('X-Norbix-Project', projectId);
      return headers;
    },
  });
  return rawBaseQuery(args, apiArg, extra);
};

export const publicApi = createApi({
  reducerPath: 'publicApi',
  baseQuery: dynamicBaseQuery,
  endpoints: (builder) => ({
    getLegalDocument: builder.query<LegalDocument, 'terms' | 'privacy'>({
      query: (kind) => ({
        url: `/public/projects/${resolveProjectId()}/legal/${kind}`,
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
  }),
});

export const { useGetLegalDocumentQuery } = publicApi;
