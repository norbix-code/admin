// Hub RTK Query API: discovery (GET /echo) and the public pages behind the
// footer links of a sent message (preferences, unsubscribe, view in web). Those
// three calls need no sign-in: the signed `token` / `hash` in the link is the
// only key. Everything else goes to the API data plane.

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { HUB_ROOT } from '@/config/env';
import { resolveProjectId, setProjectHeaders } from '@/config/project';
import type { EchoResponse } from '@/types/echo';
import type {
  EmailLinkPreferencesAnswer,
  EmailPreviewAnswer,
} from '@/features/emailLinks/answers';

export const hub = createApi({
  reducerPath: 'hub',
  baseQuery: fetchBaseQuery({
    baseUrl: HUB_ROOT,
    prepareHeaders: (headers) => {
      const projectId = resolveProjectId();
      setProjectHeaders(headers, projectId);
      return headers;
    },
  }),
  tagTypes: ['Echo'],
  endpoints: (builder) => ({
    echo: builder.query<EchoResponse, void>({
      query: () => ({ url: '/echo', method: 'GET' }),
      providesTags: [{ type: 'Echo', id: 'ECHO' }],
    }),
    getEmailPreferencesByLink: builder.query<
      EmailLinkPreferencesAnswer,
      { token: string }
    >({
      query: ({ token }) => ({
        url: '/email/preferences',
        method: 'GET',
        params: { token },
      }),
    }),
    oneClickUnsubscribe: builder.mutation<
      { responseStatus?: EmailLinkPreferencesAnswer['responseStatus'] },
      { token: string }
    >({
      query: ({ token }) => ({
        url: '/email/one-click-unsubscribe',
        method: 'POST',
        params: { token },
      }),
    }),
    previewEmailNotification: builder.query<
      EmailPreviewAnswer,
      { hash: string }
    >({
      query: ({ hash }) => ({
        url: '/notifications/email/preview',
        method: 'GET',
        params: { hash },
      }),
    }),
  }),
});

export const {
  useEchoQuery,
  useGetEmailPreferencesByLinkQuery,
  useOneClickUnsubscribeMutation,
  usePreviewEmailNotificationQuery,
} = hub;
