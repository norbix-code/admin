// Hub RTK Query API. The admin portal calls the Hub only for discovery
// (GET /echo) — everything else goes to the API data plane. Mirrors the Cloud
// project's configService.echo.

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { HUB_ROOT } from '@/config/env';
import { resolveProjectId } from '@/config/project';
import type { EchoResponse } from '@/types/echo';

export const hub = createApi({
  reducerPath: 'hub',
  baseQuery: fetchBaseQuery({
    baseUrl: HUB_ROOT,
    prepareHeaders: (headers) => {
      const projectId = resolveProjectId();
      if (projectId) headers.set('X-Norbix-Project', projectId);
      return headers;
    },
  }),
  tagTypes: ['Echo'],
  endpoints: (builder) => ({
    echo: builder.query<EchoResponse, void>({
      query: () => ({ url: '/echo', method: 'GET' }),
      providesTags: [{ type: 'Echo', id: 'ECHO' }],
    }),
  }),
});

export const { useEchoQuery } = hub;
