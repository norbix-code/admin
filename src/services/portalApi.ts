// RTK Query API for the portal's OWN backend routes (same origin, /api/*).
// Distinct from `hub` (/api/proxy/hub → Norbix Hub) and `api`
// (/api/proxy/api → Norbix API): these are the route handlers in app/api.

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { CodeMashHub2 } from '@norbix.ai/ts/types/hub';

/**
 * What GET /api/bootstrap answers: the project's communication structure
 * (channels, groups, tags), read server-side with the service user's key.
 * Null when the read failed.
 */
export interface PortalBootstrap {
  marketingPreferences: CodeMashHub2.NotificationSettingsDto | null;
  warnings: string[];
}

export const portalApi = createApi({
  reducerPath: 'portalApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Bootstrap'],
  endpoints: (builder) => ({
    // The project id is only the cache key: the backend uses its own
    // PROJECT_ID.
    getBootstrap: builder.query<PortalBootstrap, { projectId: string }>({
      query: () => ({ url: '/bootstrap', method: 'GET' }),
      providesTags: (_result, _error, arg) => [
        { type: 'Bootstrap', id: arg.projectId },
      ],
    }),
  }),
});

export const { useGetBootstrapQuery } = portalApi;
