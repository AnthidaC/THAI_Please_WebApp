import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { signToken, TokenPayload } from '../utils/jwt';
import { env } from '../config/env';
import { cache } from '../utils/redis';

interface DemoCitizenUser {
  user_id: string;
  full_name: string;
  created_at: Date;
}

interface DemoCitizenLoginOptions {
  nodeEnv: string;
  enabled: boolean;
  allowedUserIds: readonly string[];
  findUserById: (userId: string) => Promise<DemoCitizenUser | null>;
  issueToken: (payload: TokenPayload) => string;
}

export const createDemoCitizenLoginHandler = (options: DemoCitizenLoginOptions) => async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (options.nodeEnv !== 'development' || !options.enabled || options.allowedUserIds.length === 0) {
    res.status(404).json({ status: 'error', message: 'ไม่เปิดใช้งานการเข้าสู่ระบบทดสอบ' });
    return;
  }

  const allowedUserIds = new Set(options.allowedUserIds.map((userId) => userId.toLowerCase()));
  const requestedId = typeof req.body?.userId === 'string' ? req.body.userId.toLowerCase() : undefined;
  const userId = requestedId ?? (allowedUserIds.size === 1 ? [...allowedUserIds][0] : undefined);
  if (!userId || !allowedUserIds.has(userId)) {
    res.status(403).json({ status: 'error', message: 'บัญชีนี้ไม่ได้รับอนุญาตให้เข้าสู่ระบบทดสอบ' });
    return;
  }

  try {
    const user = await options.findUserById(userId);
    if (!user) {
      res.status(404).json({ status: 'error', message: 'ไม่พบบัญชีทดสอบประชาชนที่กำหนดไว้' });
      return;
    }

    const token = options.issueToken({ userId: user.user_id, role: 'CITIZEN', isDemo: true });
    res.json({
      status: 'success',
      data: {
        user: {
          id: user.user_id,
          name: user.full_name,
          role: 'USER',
          createdAt: user.created_at.toISOString(),
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const demoCitizenLogin = createDemoCitizenLoginHandler({
  nodeEnv: env.NODE_ENV,
  enabled: env.DEMO_CITIZEN_AUTH_ENABLED,
  allowedUserIds: env.DEMO_CITIZEN_USER_IDS,
  findUserById: (userId) => prisma.user.findUnique({
    where: { user_id: userId },
    select: { user_id: true, full_name: true, created_at: true },
  }),
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
