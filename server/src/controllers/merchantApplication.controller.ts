import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { merchantApplicationService } from '../services/merchantApplication.service';
import { comparePassword } from '../utils/bcrypt';
import { signToken } from '../utils/jwt';
import { prisma } from '../utils/prisma';
import { HttpError } from '../utils/http-error';

export const submitMerchantApplication = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const result = await merchantApplicationService.submit(req.body, files);
    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const loginMerchant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = await merchantApplicationService.login(req.body.email, req.body.password);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
};

const parseApplicationId = (value: string): string => {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(400, 'รหัสคำขอไม่ถูกต้อง');
  return parsed.data;
};

export const listMerchantApplications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'PENDING';
    const applications = await merchantApplicationService.list(status);
    res.json({ status: 'success', data: applications });
  } catch (error) {
    next(error);
  }
};

export const getMerchantApplication = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const applicationId = parseApplicationId(id);
    const application = await merchantApplicationService.getDetails(applicationId);
    res.json({ status: 'success', data: application });
  } catch (error) {
    next(error);
  }
};

export const decideMerchantApplication = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const applicationId = parseApplicationId(id);
    const staffId = req.user?.userId;
    if (!staffId) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
    const result = await merchantApplicationService.decide(
      applicationId,
      staffId,
      req.body.action,
      req.body.note
    );
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

export const loginStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const staff = await prisma.staff_accounts.findUnique({
      where: { email: req.body.email },
    });
    if (!staff || !staff.is_active || !(await comparePassword(req.body.password, staff.password_hash))) {
      throw new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    res.json({
      status: 'success',
      data: {
        user: {
          id: staff.staff_id,
          email: staff.email,
          name: staff.full_name,
          role: staff.role,
          createdAt: staff.created_at.toISOString(),
        },
        token: signToken({ userId: staff.staff_id, role: staff.role }),
      },
    });
  } catch (error) {
    next(error);
  }
};
