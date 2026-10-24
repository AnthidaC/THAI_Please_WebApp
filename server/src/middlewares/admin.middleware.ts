import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { verifyToken } from '../utils/jwt';

/** Protects management endpoints from the citizen fallback used by demo APIs. */
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

  if (env.NODE_ENV === 'development' && token === 'demo-token-admin') {
    req.user = { userId: 'admin-001', role: 'ADMIN' };
    next();
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
