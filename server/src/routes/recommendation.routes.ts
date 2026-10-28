import { Router, Request, Response, NextFunction } from 'express';
import {
  getNearbyRecommendations,
  recordRecommendationClick,
} from '../controllers/recommendation.controller';
import { authenticate, requireCitizen } from '../middlewares/auth.middleware';
import { verifyToken } from '../utils/jwt';
import { sendError } from '../utils/response';

const router = Router();

/**
 * Middleware สำหรับถอดรหัส Token แบบ Optional (รองรับทั้ง Guest และ Authenticated User)
 * - อนุญาตให้เข้าถึงในฐานะ Guest เฉพาะกรณีที่ไม่มี Authorization Header มาเท่านั้น
 * - หากมีการส่ง Authorization Header มา ต้องเป็น Bearer JWT ที่ถูกต้อง
 * - ปฏิเสธด้วย HTTP 401 หาก Header ผิดฟอร์แมต, Token หมดอายุ, ไม่ถูกต้อง, หรือเป็น demo-token
 * - กำหนดค่า req.user เฉพาะหลังผ่านการตรวจสอบลายเซ็น Token อย่างสมบูรณ์
 */
export const optionalAuthenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  // 1. อนุญาตให้เป็น Guest เฉพาะเมื่อไม่มี Authorization header ส่งมาเลย
  if (!authHeader) {
    return next();
  }

  // 2. ตรวจสอบฟอร์แมต Bearer header
  if (!authHeader.startsWith('Bearer ')) {
    sendError(res, 'Unauthorized: Invalid token format', 401);
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    sendError(res, 'Unauthorized: Token missing', 401);
    return;
  }

  // 3. ปฏิเสธ demo-token
  if (token === 'demo-token') {
    sendError(res, 'Unauthorized: Demo tokens are not permitted', 401);
    return;
  }

  // 4. ตรวจสอบความถูกต้องและวันหมดอายุของ JWT
  try {
    const payload = verifyToken(token);
    req.user = payload;
    return next();
  } catch {
    sendError(res, 'Unauthorized: Invalid or expired token', 401);
    return;
  }
};

/**
 * GET /api/recommendations/near-me
 * ค้นหาและแนะนำร้านค้าใกล้ฉัน (รองรับทั้ง Guest และ Authenticated Citizen)
 */
router.get('/near-me', optionalAuthenticate, getNearbyRecommendations);

/**
 * POST /api/recommendations/:recommendationId/click
 * บันทึกสถิติการคลิกการ์ดคำแนะนำร้านค้า (ต้องผ่านการยืนยันตัวตน Authenticated Only)
 */
router.post('/:recommendationId/click', authenticate, requireCitizen, recordRecommendationClick);

export default router;
