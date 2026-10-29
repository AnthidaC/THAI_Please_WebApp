import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Unhandled Error:', err);

  const candidateStatus = err.statusCode ?? err.status;
  const statusCode = Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus <= 599
    ? candidateStatus
    : 500;
  const message = statusCode === 500 ? 'Internal Server Error' : err.message || 'Request failed';

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
