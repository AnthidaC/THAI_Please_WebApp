import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../utils/prisma';

/** Financial endpoints require a valid signed session token. */
export const authenticatePaymentSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new Error('Missing session');
    const token = header.slice(7).trim();
    const user = verifyToken(token);
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
    // Existing Merchant sessions may identify either an application or an approved Merchant.
    const application = await prisma.merchantApplication.findFirst({
      where: { OR: [{ application_id: req.user.userId }, { merchant_id: req.user.userId }] },
      select: { merchant_id: true },
    });
    let resolvedMerchantId = application?.merchant_id;
    if (!resolvedMerchantId) {
      const direct = await prisma.merchants.findUnique({
        where: { merchant_id: req.user.userId },
        select: { merchant_id: true },
      });
      resolvedMerchantId = direct?.merchant_id;
    }
    if (!resolvedMerchantId) {
      res.status(403).json({ status: 'error', message: 'ไม่พบร้านค้าที่ผูกกับบัญชีนี้' });
      return;
    }
    res.locals.paymentMerchantId = resolvedMerchantId;
    next();
  } catch (error) {
    next(error);
  }
};
