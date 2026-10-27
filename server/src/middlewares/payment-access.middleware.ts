import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../utils/prisma';

/** Fintech endpoints require a real session; leaves Dev1's login/demo middleware untouched. */
export const authenticatePaymentSession = (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new Error('Missing session');
    const user = verifyToken(header.slice(7).trim());
    if (!user.userId || !user.role) throw new Error('Invalid session');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ status: 'error', message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
  }
};

export const requirePaymentMerchant = async (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role.toUpperCase() !== 'MERCHANT') {
    res.status(403).json({ status: 'error', message: 'เฉพาะบัญชีร้านค้าเท่านั้น' });
    return;
  }
  try {
    // Dev1 may issue merchant sessions with either merchant_id or application_id.
    const application = await prisma.merchant_applications.findFirst({
      where: { OR: [{ application_id: req.user.userId }, { merchant_id: req.user.userId }] },
      select: { merchant_id: true },
    });
    if (!application?.merchant_id) {
      res.status(403).json({ status: 'error', message: 'ไม่พบร้านค้าที่ผูกกับบัญชีนี้' });
      return;
    }
    res.locals.paymentMerchantId = application.merchant_id;
    next();
  } catch (error) {
    next(error);
  }
};
