import { Response } from 'express';
import { ApiResponse, PaginationMeta } from '../types/api';

export function success<T>(
  res: Response,
  data: T,
  meta?: PaginationMeta,
  statusCode = 200
): Response {
  const responseBody: ApiResponse<T> = {
    success: true,
    data,
    meta,
  };
  return res.status(statusCode).json(responseBody);
}

export function error(
  res: Response,
  statusCode: number,
  message: string,
  details?: unknown
): Response {
  const responseBody: ApiResponse<never> = {
    success: false,
    error: {
      message,
      details,
    },
  };
  return res.status(statusCode).json(responseBody);
}