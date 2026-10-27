import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../utils/prisma';
import { env } from '../config/env';

/** Fintech endpoints require a real session; leaves Dev1's login/demo middleware untouched. */
export const authenticatePaymentSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new Error('Missing session');
    const token = header.slice(7).trim();
    // Development only: map demo tokens to test entities
    if (env.NODE_ENV === 'development') {
      if (token === 'demo-token-citizen' || token === 'demo-token-citizen-new') {
        const demoUser = await prisma.user.findFirst({ select: { user_id: true } });
        if (!demoUser) throw new Error('No demo user');
        req.user = { userId: demoUser.user_id, role: 'USER', isDemo: true };
        next();
        return;
      }
      if (token === 'demo-token-merchant' || token === 'demo-token') {
        const demoMerchant = await prisma.merchants.findFirst({
          where: { transactions: { some: {} } },
          select: { merchant_id: true },
        }) || await prisma.merchants.findFirst({ select: { merchant_id: true } });
        if (!demoMerchant) throw new Error('No demo merchant');
        req.user = { userId: demoMerchant.merchant_id, role: 'MERCHANT', isDemo: true };
        next();
        return;
      }
    }
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
    // Dev1 may issue merchant sessions with either merchant_id or application_id.
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
    if (!resolvedMerchantId && env.NODE_ENV === 'development') {
      const fallback = await prisma.merchants.findFirst({
        where: { transactions: { some: {} } },
        select: { merchant_id: true },
      }) || await prisma.merchants.findFirst({ select: { merchant_id: true } });
      resolvedMerchantId = fallback?.merchant_id;
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
