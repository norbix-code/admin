import { api } from './api';
import type { ComplianceInfo } from '@/types/user';

export const complianceService = api.injectEndpoints({
  endpoints: (builder) => ({
    getComplianceInfo: builder.query<ComplianceInfo, void>({
      query: () => ({ url: '/me/compliance', method: 'GET' }),
      providesTags: ['Compliance'],
    }),
    requestDataExport: builder.mutation<void, void>({
      query: () => ({ url: '/me/compliance/export', method: 'POST' }),
      invalidatesTags: ['Compliance'],
    }),
    requestAccountDeletion: builder.mutation<void, { confirm: boolean }>({
      query: (body) => ({
        url: '/me/compliance/delete',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useGetComplianceInfoQuery,
  useRequestDataExportMutation,
  useRequestAccountDeletionMutation,
} = complianceService;
