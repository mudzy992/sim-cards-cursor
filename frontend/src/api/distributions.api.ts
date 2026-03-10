import { axiosInstance } from './axios.instance';

const baseUrl = '/distributions';

export type Distribution = {
  id: string;
  name: string;
  code: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: { branches?: number; users?: number };
};

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const distributionsApi = {
  list: () =>
    axiosInstance.get(baseUrl).then((r) => unwrap<Distribution[]>(r.data)),

  get: (id: string) =>
    axiosInstance.get(`${baseUrl}/${id}`).then((r) => unwrap<Distribution & { branches: { id: string; name: string; code: string }[] }>(r.data)),

  create: (data: { name: string; code: string }) =>
    axiosInstance.post(baseUrl, data).then((r) => unwrap<Distribution>(r.data)),

  update: (id: string, data: Partial<{ name: string; code: string }>) =>
    axiosInstance.patch(`${baseUrl}/${id}`, data).then((r) => unwrap<Distribution>(r.data)),

  delete: (id: string) =>
    axiosInstance.delete(`${baseUrl}/${id}`),
};
