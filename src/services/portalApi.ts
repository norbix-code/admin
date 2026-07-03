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
// under the names the rest of the admin code already imports from here.
export type AdminPortalModule = CodeMashHub2.AdminPortalModuleDto;
export type AdminPortalStructure = CodeMashHub2.AdminPortalStructureDto;

export const portalApi = createApi({
  reducerPath: 'portalApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Structure'],
  endpoints: (builder) => ({
    // GET /api/structure?projectId=… — the backend reads the real structure
    // server-side and always returns a usable layout. The backend itself decides
    // self-hosted (public endpoint + key) vs managed (private internal endpoint)
    // from whether API_KEY is configured — no client hint needed.
    getStructure: builder.query<AdminPortalStructure, { projectId: string }>({
      query: ({ projectId }) => ({
        url: `/structure?projectId=${encodeURIComponent(projectId)}`,
        method: 'GET',
      }),
      providesTags: (result, error, arg) => [
        { type: 'Structure', id: arg.projectId },
      ],
    }),
  }),
});

export const { useGetStructureQuery } = portalApi;
