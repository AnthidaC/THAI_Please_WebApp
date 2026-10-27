import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../utils/http-error';
import { socialImpactService } from '../services/socialImpact.service';
import { prisma } from '../utils/prisma';

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
    const dateValue = (value: unknown, fallback: Date): Date => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
      const date = new Date(`${value}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) throw new HttpError(400, 'รูปแบบวันที่ไม่ถูกต้อง');
      return date;
    };
    const end = dateValue(req.query.to, new Date());
    const startFallback = new Date(end);
    startFallback.setUTCDate(startFallback.getUTCDate() - 29);
    const start = dateValue(req.query.from, startFallback);
    if (start > end) throw new HttpError(400, 'วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด');

    const provinceName = typeof req.query.provinceName === 'string' ? req.query.provinceName.slice(0, 100) : undefined;
    const where = { metric_date: { gte: start, lte: end }, ...(provinceName ? { province: provinceName } : {}) };
    const [areas, days] = await Promise.all([
      prisma.daily_social_impact_metrics.groupBy({
        by: ['province'], where,
        _sum: { total_spending_amount: true, benefited_merchants_count: true },
      }),
      prisma.daily_social_impact_metrics.groupBy({
        by: ['metric_date'], where, orderBy: { metric_date: 'asc' },
        _sum: { total_spending_amount: true },
      }),
    ]);
    const areaData = areas.flatMap((area) => area.province ? [{
      province: area.province,
      totalCirculation: Number(area._sum.total_spending_amount ?? 0),
      benefitedMerchantDays: Number(area._sum.benefited_merchants_count ?? 0),
    }] : []);
    const timeline = days.map((day) => ({ date: day.metric_date.toISOString().slice(0, 10), totalCirculation: Number(day._sum.total_spending_amount ?? 0) }));
    res.json({ status: 'success', data: {
      source: 'daily_social_impact_metrics', level: level.data, areas: areaData, timeline,
      totalCirculation: areaData.reduce((sum, area) => sum + area.totalCirculation, 0),
      benefitedMerchantDays: areaData.reduce((sum, area) => sum + area.benefitedMerchantDays, 0),
      secondaryCityShare: null,
      ...(level.data !== 'province' ? { detailUnavailable: true } : {}),
    } });
  } catch (error) {
    next(error);
  }
};
