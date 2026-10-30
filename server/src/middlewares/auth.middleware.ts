import { Request, Response, NextFunction } from 'express';
import { isAllowedMerchantApplicationStatusRequest, isRestrictedToken, verifyToken } from '../utils/jwt';

export const restrictScopedTokens = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }
  try {
    const payload = verifyToken(authHeader.slice('Bearer '.length).trim());
    if (isRestrictedToken(payload)
      && !isAllowedMerchantApplicationStatusRequest(payload, req.method, req.originalUrl.split('?')[0])) {
      res.status(403).json({ status: 'error', message: 'Token is restricted to merchant application status' });
      return;
    }
    next();
  } catch {
    // Existing route authentication owns invalid-token responses. This gate only handles valid scoped tokens.
    next();
  }
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
    return;
  }

  try {
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
      return;
    }

    const payload = verifyToken(token);
    if (!payload.userId || !payload.role) {
      res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
      return;
    }

    if (isRestrictedToken(payload)) {
      if (!isAllowedMerchantApplicationStatusRequest(payload, req.method, req.originalUrl.split('?')[0])) {
        res.status(403).json({ status: 'error', message: 'Token is restricted to merchant application status' });
        return;
      }
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireCitizen = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ status: 'error', message: 'กรุณาเข้าสู่ระบบ' });
    return;
  }
  if (req.user.role.toUpperCase() !== 'CITIZEN') {
    res.status(403).json({ status: 'error', message: 'ต้องใช้บัญชีประชาชนเพื่อเข้าถึงข้อมูลนี้' });
    return;
  }
  next();
};

export const requireStaff = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
    return;
  }
  if (!['STAFF', 'ADMIN'].includes(req.user.role.toUpperCase())) {
    res.status(403).json({ status: 'error', message: 'Staff access required' });
    return;
  }
  next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
    return;
  }
  if (req.user.role.toUpperCase() !== 'ADMIN') {
    res.status(403).json({ status: 'error', message: 'Administrator access required' });
    return;
  }
  next();
};

export const requireApprovedMerchant = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
    return;
  }
  if (req.user.role.toUpperCase() !== 'MERCHANT') {
    res.status(403).json({ status: 'error', message: 'Approved merchant access required' });
    return;
  }
  next();
};
