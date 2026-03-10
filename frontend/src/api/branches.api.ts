import { axiosInstance } from './axios.instance';

const baseUrl = '/branches';

export type Branch = {
  id: string;
  distributionId: string;
  name: string;
  code: string;
  distribution?: { id: string; name: string; code: string };
  createdAt?: string;
  updatedAt?: string;
};

const unwrap = <T>(r: { data: { data?: T } | T }): T =>
  (r.data as { data?: T }).data ?? (r.data as T);

export const branchesApi = {
  list: (distributionId?: string) =>
    axiosInstance
      .get(baseUrl, distributionId ? { params: { distributionId } } : undefined)
      .then((r) => unwrap<Branch[]>(r.data)),

  get: (id: string) =>
    axiosInstance.get(`${baseUrl}/${id}`).then((r) => unwrap<Branch>(r.data)),

  create: (data: { distributionId: string; name: string; code: string }) =>
    axiosInstance.post(baseUrl, data).then((r) => unwrap<Branch>(r.data)),

  update: (id: string, data: Partial<{ name: string; code: string }>) =>
    axiosInstance.patch(`${baseUrl}/${id}`, data).then((r) => unwrap<Branch>(r.data)),

  delete: (id: string) =>
    axiosInstance.delete(`${baseUrl}/${id}`),
};
