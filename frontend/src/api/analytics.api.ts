import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';

export type AnalyticsRange =
  | 'TODAY'
  | '7_DAYS'
  | '30_DAYS'
  | 'MONTH'
  | 'YEAR'
  | 'CUSTOM';

export interface TimeRangeParams {
  range?: AnalyticsRange;
  from?: string;
  to?: string;
}

export interface OverviewAnalytics {
  installationRecords: {
    total: number;
    byStatus: Record<string, number>;
  };
  simCards: {
    total: number;
    byStatus: Record<string, number>;
  };
  metersTotal: number;
  activationKpi: {
    count: number;
    avgSeconds: number | null;
    p50Seconds: number | null;
    p90Seconds: number | null;
  };
}

export const analyticsApi = {
  getOverview: async (
    params: TimeRangeParams,
  ): Promise<OverviewAnalytics> => {
    const response = await axiosInstance.get<ApiEnvelope<OverviewAnalytics>>(
      '/analytics/overview',
      { params },
    );
    return response.data.data;
  },

  getInstallationRecords: async (
    params: TimeRangeParams,
  ): Promise<{ funnel: Record<string, number>; timeline: { date: string; count: number }[] }> => {
    const response = await axiosInstance.get<
      ApiEnvelope<{ funnel: Record<string, number>; timeline: { date: string; count: number }[] }>
    >('/analytics/installation-records', { params });
    return response.data.data;
  },

  getSimCards: async (
    params: TimeRangeParams,
  ): Promise<{
    byStatus: Record<string, number>;
    byDistribution: {
      distributionId: string;
      distributionName: string;
      total: number;
    }[];
    byBranch: {
      branchId: string;
      branchName: string;
      distributionName: string;
      installedCount: number;
    }[];
    byOperator: {
      userId: string;
      firstName: string;
      lastName: string;
      branchName: string;
      distributionName: string;
      totalAssigned: number;
      totalInstalled: number;
    }[];
  }> => {
    const response = await axiosInstance.get<
      ApiEnvelope<{
        byStatus: Record<string, number>;
        byDistribution: {
          distributionId: string;
          distributionName: string;
          total: number;
        }[];
        byBranch: {
          branchId: string;
          branchName: string;
          distributionName: string;
          installedCount: number;
        }[];
        byOperator: {
          userId: string;
          firstName: string;
          lastName: string;
          branchName: string;
          distributionName: string;
          totalAssigned: number;
          totalInstalled: number;
        }[];
      }>
    >('/analytics/sim-cards', { params });
    return response.data.data;
  },

  getUsers: async (
    params: TimeRangeParams,
  ): Promise<
    {
      userId: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      created: number;
      approved: number;
    }[]
  > => {
    const response = await axiosInstance.get<
      ApiEnvelope<
        {
          userId: string;
          firstName: string;
          lastName: string;
          email: string;
          role: string;
          created: number;
          approved: number;
        }[]
      >
    >('/analytics/users', { params });
    return response.data.data;
  },

  downloadCsv: async (
    report: 'overview' | 'sim-cards' | 'installation-records' | 'users',
    params: TimeRangeParams,
  ): Promise<Blob> => {
    const response = await axiosInstance.get(
      `/analytics/exports/${report}.csv`,
      {
        params,
        responseType: 'blob',
      },
    );
    return response.data as Blob;
  },
};

