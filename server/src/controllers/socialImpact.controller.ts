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
