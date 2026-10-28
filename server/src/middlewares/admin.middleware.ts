import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

/** Allows management endpoints only for valid JWT sessions with the Admin role. */
export const authenticateAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authorization = req.headers.authorization;
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    res.status(401).json({ status: 'error', message: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyToken(token);
    if (!payload.userId || !payload.role) {
      res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
      return;
    }

    if (payload.role.toUpperCase() !== 'ADMIN') {
      res.status(403).json({ status: 'error', message: 'Administrator access required' });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
  }
};
