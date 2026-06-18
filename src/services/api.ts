// Base RTK Query API for the end-user data plane. All authenticated calls go
// here. The API base URL is resolved at request time from the /echo response
// in the config slice (falling back to the env value), so the portal targets
// whatever API the Hub reported. The base query also attaches the project id
// (from the subdomain) and the end-user bearer token from the auth slice.

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

const dynamicBaseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = (args, apiArg, extra) => {
  const state = apiArg.getState() as RootState;
  const baseUrl = selectApiRoot(state);
  const token = state.auth.token;
  const projectId = resolveProjectId();

  const rawBaseQuery = fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers) => {
      if (projectId) headers.set('X-Norbix-Project', projectId);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  });

  return rawBaseQuery(args, apiArg, extra);
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: dynamicBaseQuery,
  tagTypes: ['Profile', 'Preferences', 'Compliance'],
  endpoints: () => ({}),
});
