import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../utils/prisma';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ status: 'error', message: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' });
    return;
  }

  try {
    const token = authHeader.slice('Bearer '.length);
    const payload = verifyToken(token);
    if (!payload.userId || !payload.role) {
      res.status(401).json({ status: 'error', message: 'โทเคนไม่ถูกต้องหรือหมดอายุ' });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ status: 'error', message: 'โทเคนไม่ถูกต้องหรือหมดอายุ' });
  }
};

export const requireStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const staffId = req.user?.userId;
  const role = req.user?.role.toUpperCase();
  if (!staffId || (role !== 'ADMIN' && role !== 'STAFF')) {
    res.status(403).json({ status: 'error', message: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
    return;
  }
  try {
    const staff = await prisma.staff_accounts.findUnique({
      where: { staff_id: staffId },
      select: { role: true, is_active: true },
    });
    if (!staff || !staff.is_active || staff.role !== role) {
      res.status(403).json({ status: 'error', message: 'บัญชีเจ้าหน้าที่ถูกระงับหรือไม่มีสิทธิ์' });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const requireApprovedMerchant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const merchantId = req.user?.userId;
  if (!merchantId || req.user?.role.toUpperCase() !== 'MERCHANT') {
    res.status(403).json({ status: 'error', message: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
    return;
  }
  try {
    const merchant = await prisma.merchants.findUnique({
      where: { merchant_id: merchantId },
      select: { is_approved: true },
    });
    if (!merchant?.is_approved) {
      res.status(403).json({ status: 'error', message: 'บัญชีร้านค้ายังไม่ได้รับอนุมัติหรือถูกระงับ' });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};
