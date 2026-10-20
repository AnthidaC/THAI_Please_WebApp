import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../utils/prisma';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token !== 'demo-token') {
        const payload = verifyToken(token);
        req.user = payload;
        return next();
      }
    }

    // Fallback: หากยังไม่ได้ล็อกอิน ให้ใช้ User คนแรกในฐานข้อมูลอัตโนมัติ เพื่อให้ทดสอบหน้าจอได้โดยไม่ต้องรอระบบ Login
    const defaultUser = await prisma.user.findFirst();
    if (defaultUser) {
      req.user = { userId: defaultUser.user_id, role: 'citizen' };
      return next();
    }

    res.status(401).json({ status: 'error', message: 'Unauthorized: No token provided' });
  } catch (error) {
    // หาก Token หมดอายุหรือไม่ถูกต้อง ให้ fallback เข้า defaultUser เพื่อความต่อเนื่องในการทดสอบ
    const defaultUser = await prisma.user.findFirst();
    if (defaultUser) {
      req.user = { userId: defaultUser.user_id, role: 'citizen' };
      return next();
    }
    res.status(401).json({ status: 'error', message: 'Unauthorized: Invalid or expired token' });
  }
};

