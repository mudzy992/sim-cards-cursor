export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
