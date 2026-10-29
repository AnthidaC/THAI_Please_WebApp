import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { merchantApplicationService } from '../services/merchantApplication.service';
import { comparePassword } from '../utils/bcrypt';
import { signToken } from '../utils/jwt';
import { prisma } from '../utils/prisma';
import { HttpError } from '../utils/http-error';
import { merchantProfileService } from '../services/merchantProfile.service';

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
    if ('applicationStatus' in data) {
      const isPending = data.applicationStatus === 'PENDING';
      res.status(403).json({
        status: 'error',
        code: `MERCHANT_APPLICATION_${data.applicationStatus}`,
        applicationStatus: data.applicationStatus,
        message: isPending ? 'ใบสมัครร้านค้าอยู่ระหว่างตรวจสอบ' : 'ใบสมัครร้านค้าถูกปฏิเสธ',
      });
      return;
    }
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

export const getOwnMerchantApplicationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const applicationId = req.user?.userId;
    if (!applicationId || req.user?.tokenScope !== 'MERCHANT_APPLICATION_STATUS') {
      throw new HttpError(403, 'Merchant application status access required');
    }
    const status = await merchantApplicationService.getOwnStatus(applicationId);
    res.json({ status: 'success', data: status });
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

const parseUuid = (value: string): string => {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(400, 'รหัสร้านค้าหรือคำขอไม่ถูกต้อง');
  return parsed.data;
};

export const getOwnMerchantProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const merchantId = req.user?.userId;
    if (!merchantId) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
    res.json({ status: 'success', data: await merchantProfileService.getProfile(merchantId) });
  } catch (error) {
    next(error);
  }
};

export const updateOwnMerchantProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const merchantId = req.user?.userId;
    if (!merchantId) throw new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่');
    const profile = await merchantProfileService.updateOwnProfile(merchantId, req.body);
    res.json({ status: 'success', data: profile });
  } catch (error) {
    next(error);
  }
};

export const listApprovedMerchants = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.json({ status: 'success', data: await merchantProfileService.listApproved() });
  } catch (error) {
    next(error);
  }
};

export const getMerchantProfileByStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json({ status: 'success', data: await merchantProfileService.getProfile(parseUuid(id)) });
  } catch (error) {
    next(error);
  }
};

export const updateMerchantProfileByStaff = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const staffId = req.user?.userId;
    const role = req.user?.role.toUpperCase();
    if (!staffId || (role !== 'ADMIN' && role !== 'STAFF')) {
      throw new HttpError(403, 'คุณไม่มีสิทธิ์ดำเนินการนี้');
    }
    const profile = await merchantProfileService.updateByStaff(
      parseUuid(id),
      staffId,
      role,
      req.body
    );
    res.json({ status: 'success', data: profile });
  } catch (error) {
    next(error);
  }
};

export const listPendingMerchantLocationChanges = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.json({ status: 'success', data: await merchantProfileService.listPendingLocationChanges() });
  } catch (error) {
    next(error);
  }
};

export const decideMerchantLocationChange = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const staffId = req.user?.userId;
    const role = req.user?.role.toUpperCase();
    if (!staffId || (role !== 'ADMIN' && role !== 'STAFF')) {
      throw new HttpError(403, 'คุณไม่มีสิทธิ์ดำเนินการนี้');
    }
    const result = await merchantProfileService.decideLocationChange(
      parseUuid(id),
      staffId,
      req.body.action,
      req.body.note,
      role
    );
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};
