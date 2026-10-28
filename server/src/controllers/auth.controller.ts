import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { signToken, TokenPayload } from '../utils/jwt';
import { cache } from '../utils/redis';
import { DEMO_LOGIN_ROLES, DemoLoginRole } from '../validations/auth.validation';

interface DemoAccount {
  id: string;
  name: string;
  createdAt: Date;
}

interface DemoLoginOptions {
  findAccount: (role: DemoLoginRole, accountId?: string) => Promise<DemoAccount | null>;
  issueToken: (payload: TokenPayload) => string;
}

export const createDemoLoginHandler = (options: DemoLoginOptions) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const requestedRole = req.body?.role;
  if (typeof requestedRole !== 'string' || !DEMO_LOGIN_ROLES.includes(requestedRole as DemoLoginRole)) {
    res.status(400).json({ status: 'error', message: 'กรุณาเลือกประเภทบัญชีจำลองให้ถูกต้อง' });
    return;
  }
  const role = requestedRole as DemoLoginRole;

  const requestedId = typeof req.body?.accountId === 'string' ? req.body.accountId.toLowerCase() : undefined;
  try {
    const account = await options.findAccount(role, requestedId);
    if (!account) {
      res.status(404).json({ status: 'error', message: 'ไม่พบบัญชีทดสอบที่พร้อมใช้งานสำหรับบทบาทนี้' });
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

const testAccountName = /(?:^|[^\p{L}\p{N}])(?:test|demo|synthetic)(?=$|[^\p{L}\p{N}])/iu;
const testAccountNameFilter = (field: 'full_name' | 'shop_name') => ({
  OR: ['test', 'demo', 'synthetic'].map((marker) => ({
    [field]: { contains: marker, mode: 'insensitive' as const },
  })),
});

const findMarkedAccount = <T extends { name: string }>(accounts: T[]): T | null =>
  accounts.find((account) => testAccountName.test(account.name)) ?? null;

export const demoLogin = createDemoLoginHandler({
  findAccount: async (role, accountId) => {
    if (role === 'CITIZEN') {
      const users = await prisma.user.findMany({
        where: {
          ...(accountId ? { user_id: accountId } : {}),
          ...testAccountNameFilter('full_name'),
        },
        select: { user_id: true, full_name: true, created_at: true },
        orderBy: [{ created_at: 'asc' }, { user_id: 'asc' }],
      });
      const user = findMarkedAccount(users.map(({ user_id, full_name, created_at }) => ({
        id: user_id,
        name: full_name,
        createdAt: created_at,
      })));
      return user;
    }

    if (role === 'MERCHANT') {
      const merchants = await prisma.merchants.findMany({
        where: {
          ...(accountId ? { merchant_id: accountId } : {}),
          is_approved: true,
          ...testAccountNameFilter('shop_name'),
        },
        select: { merchant_id: true, shop_name: true, created_at: true },
        orderBy: [{ created_at: 'asc' }, { merchant_id: 'asc' }],
      });
      const merchant = findMarkedAccount(merchants.map(({ merchant_id, shop_name, created_at }) => ({
        id: merchant_id,
        name: shop_name,
        createdAt: created_at,
      })));
      return merchant;
    }

    const identities = await prisma.auth_identities.findMany({
      where: {
        account_type: 'STAFF_ACCOUNT',
        ...(accountId ? { account_id: accountId } : {}),
      },
      select: { account_id: true },
    });
    if (identities.length === 0) return null;

    const staffAccounts = await prisma.staff_accounts.findMany({
      where: {
        staff_id: { in: identities.map(({ account_id }) => account_id) },
        role: 'ADMIN',
        is_active: true,
        ...testAccountNameFilter('full_name'),
      },
      select: { staff_id: true, full_name: true, created_at: true },
      orderBy: [{ created_at: 'asc' }, { staff_id: 'asc' }],
    });
    const staff = findMarkedAccount(staffAccounts.map(({ staff_id, full_name, created_at }) => ({
      id: staff_id,
      name: full_name,
      createdAt: created_at,
    })));
    return staff;
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
