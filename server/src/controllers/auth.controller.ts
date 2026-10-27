import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { signToken } from '../utils/jwt';
import { cache } from '../utils/redis';

// Helper to hash citizen ID
const hashCitizenId = (id: string): string => {
  return crypto.createHash('sha256').update(id).digest('hex');
};

/**
 * 2.1 ลงทะเบียนรับสิทธิ์โครงการ / ตรวจสอบสิทธิ์ (Citizen ThaiD Registration)
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { citizenId, fullName, provinceCode } = req.body;
    const citizenIdHash = hashCitizenId(citizenId);

    const existingUser = await prisma.user.findUnique({
      where: { citizen_id_hash: citizenIdHash },
    });

    if (existingUser) {
      res.status(400).json({
        status: 'error',
        message: 'เลขประจำตัวประชาชนนี้ลงทะเบียนรับสิทธิ์แล้ว',
      });
      return;
    }

    const user = await prisma.user.create({
      data: {
        citizen_id_hash: citizenIdHash,
        full_name: fullName,
        province_code: provinceCode,
        is_registered_thai_plus: true,
      },
    });

    const token = signToken({ userId: user.user_id, role: 'CITIZEN' });

    res.status(201).json({
      status: 'success',
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 1.1 หน้าล็อกอินสำหรับประชาชน (ThaiD / NDID Login Simulation)
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { citizenId } = req.body;
    const citizenIdHash = hashCitizenId(citizenId);

    const user = await prisma.user.findUnique({
      where: { citizen_id_hash: citizenIdHash },
      include: {
        wallets: true,
      },
    });

    if (!user) {
      res.status(404).json({
        status: 'error',
        message: 'ไม่พบข้อมูลผู้ใช้งาน กรุณาลงทะเบียนตรวจสอบสิทธิ์ก่อน',
      });
      return;
    }

    const token = signToken({ userId: user.user_id, role: 'CITIZEN' });

    res.json({
      status: 'success',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

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
    const cacheKey = `user:${userId}`;
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
      include: {
        wallets: true,
        user_badges: {
          include: { badges: true, badge_tiers: true },
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
