// RTK Query API for the portal's OWN Next.js backend routes (same origin,
// /api/*). Distinct from `hub` (/api/proxy/hub → gateway) and `api`
// (/api/proxy/api → gateway): this targets the server route handlers the portal
// ships itself — today the structure endpoint. The pattern mirrors Cloud's
// service slices (createApi + typed query hooks), so screens consume generated
// hooks instead of useEffect/fetch.

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { CodeMashHub2 } from '@norbix.ai/ts/types/hub';

// The structure shapes are the GENERATED gateway DTOs (regenerated into the SDK
// from the AdminPortalStructureDto / AdminPortalModuleDto contracts). Re-exported
// under the names the rest of the admin code already imports from here. The
// DTO's `adminPortalEnabled` is left out: the portal does not read it.
export type AdminPortalModule = CodeMashHub2.AdminPortalModuleDto;
export type AdminPortalStructure = Omit<
  CodeMashHub2.AdminPortalStructureDto,
  'adminPortalEnabled'
>;

/**
 * The part of GET /api/bootstrap the screens use: the communication structure
 * Cloud defines (project NotificationSettings), read server-side with the
 * service-user key. Null when the read failed.
 */
export interface PortalBootstrap {
  marketingPreferences: CodeMashHub2.NotificationSettingsDto | null;
  warnings: string[];
}

export const portalApi = createApi({
  reducerPath: 'portalApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Structure', 'Bootstrap'],
  endpoints: (builder) => ({
    // GET /api/structure — the backend reads the real structure server-side
    // (as the service user, for the configured project) and always returns a
    // usable layout. The project id is only the cache key here: the backend
    // uses its own PROJECT_ID.
    getStructure: builder.query<AdminPortalStructure, { projectId: string }>({
      query: () => ({ url: '/structure', method: 'GET' }),
      providesTags: (_result, _error, arg) => [
        { type: 'Structure', id: arg.projectId },
      ],
    }),
    // GET /api/bootstrap — privileged catalogs (communication structure)
    // fetched by the backend with the service key, never the browser. The
    // project id is only the cache key.
    getBootstrap: builder.query<PortalBootstrap, { projectId: string }>({
      query: () => ({ url: '/bootstrap', method: 'GET' }),
      providesTags: (_result, _error, arg) => [
        { type: 'Bootstrap', id: arg.projectId },
      ],
    }),
  }),
});

export const { useGetStructureQuery, useGetBootstrapQuery } = portalApi;
