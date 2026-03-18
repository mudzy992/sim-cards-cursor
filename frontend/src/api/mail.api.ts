import { axiosInstance } from './axios.instance';
import type { ApiEnvelope } from '@/types/common.types';

export type MailTemplate = {
  name: string;
  key: string;
  sourceType: 'db' | 'file';
  content: string;
};

export const mailApi = {
  listTemplates: async (): Promise<MailTemplate[]> => {
    const response = await axiosInstance.get<ApiEnvelope<MailTemplate[]>>('/mail/templates');
    return response.data.data;
  },

  getTemplate: async (name: string): Promise<MailTemplate> => {
    const response = await axiosInstance.get<ApiEnvelope<MailTemplate>>(
      `/mail/templates/${encodeURIComponent(name)}`,
    );
    return response.data.data;
  },

  updateTemplate: async (name: string, content: string): Promise<MailTemplate> => {
    const response = await axiosInstance.put<ApiEnvelope<MailTemplate>>(
      `/mail/templates/${encodeURIComponent(name)}`,
      { content },
    );
    return response.data.data;
  },

  previewTemplate: async (name: string, context: Record<string, unknown>): Promise<{ name: string; html: string }> => {
    const response = await axiosInstance.post<ApiEnvelope<{ name: string; html: string }>>(
      `/mail/templates/${encodeURIComponent(name)}/preview`,
      { context },
    );
    return response.data.data;
  },

  sendTest: async (input: {
    to: string;
    template: string;
    subject?: string;
    context?: Record<string, unknown>;
  }): Promise<{ ok: true }> => {
    const response = await axiosInstance.put<ApiEnvelope<{ ok: true }>>('/mail/test', input);
    return response.data.data;
  },
};

