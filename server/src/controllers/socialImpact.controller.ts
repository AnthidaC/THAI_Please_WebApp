import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../utils/http-error';
import { socialImpactService } from '../services/socialImpact.service';

const rangeSchema = z.coerce.number().int();

const parseRange = (value: unknown): number => {
  const parsed = rangeSchema.safeParse(value ?? 30);
  if (!parsed.success) throw new HttpError(400, 'ช่วงเวลาที่เลือกไม่ถูกต้อง');
  return parsed.data;
};

export const getSocialImpactSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const summary = await socialImpactService.getSummary(parseRange(req.query.days));
    res.json({ status: 'success', data: summary });
  } catch (error) {
    next(error);
  }
};

export const getSocialImpactHeatmap = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const heatmap = await socialImpactService.getHeatmap(parseRange(req.query.days));
    res.json({ status: 'success', data: heatmap });
  } catch (error) {
    next(error);
  }
};

export const getSocialImpactDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const level = z.enum(['province', 'district', 'subdistrict']).safeParse(req.query.level ?? 'province');
    if (!level.success) throw new HttpError(400, 'ระดับพื้นที่ไม่ถูกต้อง');

    const dateValue = (value: unknown, fallback: Date, isEnd = false): Date => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
      const date = new Date(`${value}T${isEnd ? '23:59:59.999Z' : '00:00:00.000Z'}`);
      if (Number.isNaN(date.getTime())) throw new HttpError(400, 'รูปแบบวันที่ไม่ถูกต้อง');
      return date;
    };

    const now = new Date();
    const end = dateValue(req.query.to, now, true);
    const startFallback = new Date(now);
    startFallback.setUTCDate(startFallback.getUTCDate() - 29);
    startFallback.setUTCHours(0, 0, 0, 0);
    const start = dateValue(req.query.from, startFallback, false);
    if (start > end) throw new HttpError(400, 'วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด');

    const code = typeof req.query.code === 'string' ? req.query.code.slice(0, 50) : undefined;
    const provinceName = typeof req.query.provinceName === 'string' ? req.query.provinceName.slice(0, 100) : undefined;

    const data = await socialImpactService.getDashboard({
      level: level.data,
      from: start,
      to: end,
      code,
      provinceName,
    });

    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
};
