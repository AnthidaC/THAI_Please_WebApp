import { Response } from 'express';

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  meta?: Record<string, any>;
}

export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200
): Response => {
  return res.status(statusCode).json({
    status: 'success',
    ...(message && { message }),
    ...(data !== undefined && { data }),
  });
};

export const sendError = (
  res: Response,
  message = 'Internal server error',
  statusCode = 500,
  errors?: any
): Response => {
  return res.status(statusCode).json({
    status: 'error',
    message,
    ...(errors && { errors }),
  });
};
