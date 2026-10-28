import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { signToken, TokenPayload } from '../utils/jwt';
import { env } from '../config/env';
import { cache } from '../utils/redis';
import { DEMO_LOGIN_ROLES, DemoLoginRole } from '../validations/auth.validation';

interface DemoAccount {
  id: string;
  name: string;
  createdAt: Date;
}

interface DemoLoginOptions {
  nodeEnv: string;
  enabled: boolean;
  allowedAccountIds: Record<DemoLoginRole, readonly string[]>;
  findAccount: (role: DemoLoginRole, accountId: string) => Promise<DemoAccount | null>;
  issueToken: (payload: TokenPayload) => string;
}

export const createDemoLoginHandler = (options: DemoLoginOptions) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (options.nodeEnv !== 'development' || !options.enabled) {
    res.status(404).json({ status: 'error', message: 'ไม่เปิดใช้งานบัญชีจำลอง' });
    return;
  }

  const requestedRole = req.body?.role;
  if (typeof requestedRole !== 'string' || !DEMO_LOGIN_ROLES.includes(requestedRole as DemoLoginRole)) {
    res.status(400).json({ status: 'error', message: 'กรุณาเลือกประเภทบัญชีจำลองให้ถูกต้อง' });
    return;
  }
  const role = requestedRole as DemoLoginRole;

  const allowedAccountIds = new Set(options.allowedAccountIds[role].map((accountId) => accountId.toLowerCase()));
  if (allowedAccountIds.size === 0) {
    res.status(404).json({ status: 'error', message: 'ยังไม่ได้กำหนดบัญชีจำลองสำหรับบทบาทนี้' });
    return;
  }

  const requestedId = typeof req.body?.accountId === 'string' ? req.body.accountId.toLowerCase() : undefined;
  const accountId = requestedId ?? (allowedAccountIds.size === 1 ? [...allowedAccountIds][0] : undefined);
  if (!accountId || !allowedAccountIds.has(accountId)) {
    res.status(403).json({ status: 'error', message: 'บัญชีนี้ไม่ได้รับอนุญาตให้เข้าสู่ระบบทดสอบ' });
    return;
  }

  try {
    const account = await options.findAccount(role, accountId);
    if (!account) {
      res.status(404).json({ status: 'error', message: 'ไม่พบบัญชีจำลองที่กำหนดไว้หรือบัญชีไม่พร้อมใช้งาน' });
      return;
    }

    const token = options.issueToken({ userId: account.id, role, isDemo: true });
    res.json({
      status: 'success',
      data: {
        user: {
          id: account.id,
          name: account.name,
          role: role === 'CITIZEN' ? 'USER' : role,
          createdAt: account.createdAt.toISOString(),
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const demoLogin = createDemoLoginHandler({
  nodeEnv: env.NODE_ENV,
  enabled: env.DEMO_AUTH_ENABLED,
  allowedAccountIds: {
    CITIZEN: env.DEMO_CITIZEN_USER_IDS,
    MERCHANT: env.DEMO_MERCHANT_IDS,
    ADMIN: env.DEMO_ADMIN_STAFF_IDS,
  },
  findAccount: async (role, accountId) => {
    if (role === 'CITIZEN') {
      const user = await prisma.user.findUnique({
        where: { user_id: accountId },
        select: { user_id: true, full_name: true, created_at: true },
      });
      return user ? { id: user.user_id, name: user.full_name, createdAt: user.created_at } : null;
    }

    if (role === 'MERCHANT') {
      const merchant = await prisma.merchants.findUnique({
        where: { merchant_id: accountId },
        select: { merchant_id: true, shop_name: true, created_at: true },
      });
      return merchant ? { id: merchant.merchant_id, name: merchant.shop_name, createdAt: merchant.created_at } : null;
    }

    const staff = await prisma.staff_accounts.findUnique({
      where: { staff_id: accountId },
      select: { staff_id: true, full_name: true, created_at: true, role: true, is_active: true },
    });
    return staff?.role === 'ADMIN' && staff.is_active
      ? { id: staff.staff_id, name: staff.full_name, createdAt: staff.created_at }
      : null;
  },
  issueToken: signToken,
});

/**
 * 2.5 ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบันพร้อมกระเป๋าเงิน (Citizen Me & Wallet)
 */
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }

    // Try Redis cache first (Upstash REST or TCP Redis)
    const cacheKey = `user:profile:v2:${userId}`;
    const cachedUser = await cache.get(cacheKey);
    if (cachedUser) {
      res.json({
        status: 'success',
        source: 'cache',
        data: cachedUser,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        full_name: true,
        province_code: true,
        is_registered_thai_plus: true,
        created_at: true,
        wallets: {
          select: {
            wallet_id: true,
            campaign_id: true,
            balance: true,
            daily_quota_limit: true,
            daily_quota_used: true,
            last_quota_reset_date: true,
            total_quota_remaining: true,
            eligibility_status: true,
            status: true,
            created_at: true,
            updated_at: true,
          },
        },
        user_badges: {
          select: {
            user_badge_id: true,
            earned_at: true,
            badges: {
              select: {
                badge_id: true,
                badge_name: true,
                description: true,
                condition_type: true,
                status: true,
              },
            },
            badge_tiers: {
              select: {
                tier_id: true,
                tier_name: true,
                tier_level: true,
                required_count: true,
                icon_url: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ status: 'error', message: 'User not found' });
      return;
    }

    // Cache user profile for 5 minutes (300s)
    await cache.set(cacheKey, user, 300);

    res.json({
      status: 'success',
      source: 'database',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
