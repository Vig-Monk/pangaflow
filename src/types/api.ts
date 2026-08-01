export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface AppErrorPayload {
  message: string;
  code?: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: AppErrorPayload;
  meta?: PaginationMeta;
}