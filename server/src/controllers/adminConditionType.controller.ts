import { Request, Response } from 'express';
import { AdminConditionTypeServiceError, adminConditionTypeService } from '../services/adminConditionType.service';
import { sendError, sendSuccess } from '../utils/response';
import {
  conditionTypeIdParamSchema,
  conditionTypeListQuerySchema,
} from '../validations/condition-type.validation';

const run = async (res: Response, operation: () => Promise<unknown>, message: string, status = 200) => {
  try {
    sendSuccess(res, await operation(), message, status);
  } catch (error) {
    if (error instanceof AdminConditionTypeServiceError) {
      sendError(res, error.message, error.statusCode);
      return;
    }
    console.error('Admin condition type request failed', error);
    sendError(res, 'ไม่สามารถดำเนินการจัดการประเภทเงื่อนไขได้', 500);
  }
};

const withId = (req: Request, res: Response, operation: (id: string) => Promise<unknown>, message: string) => {
  const parsed = conditionTypeIdParamSchema.safeParse(req.params.id);
  if (!parsed.success) {
    sendError(res, 'รหัสประเภทเงื่อนไขไม่ถูกต้อง', 400);
    return Promise.resolve();
  }
  return run(res, () => operation(parsed.data), message);
};

export const listAdminConditionTypes = (req: Request, res: Response) => {
  const parsed = conditionTypeListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    sendError(res, 'ตัวกรองประเภทเงื่อนไขไม่ถูกต้อง', 400);
    return;
  }
  return run(res, () => adminConditionTypeService.list(parsed.data), 'โหลดประเภทเงื่อนไขแล้ว');
};

export const getAdminConditionType = (req: Request, res: Response) =>
  withId(req, res, adminConditionTypeService.get, 'โหลดประเภทเงื่อนไขแล้ว');

export const createAdminConditionType = (req: Request, res: Response) =>
  run(res, () => adminConditionTypeService.create(req.body), 'สร้างประเภทเงื่อนไขแล้ว โดยรอการพัฒนา Backend', 201);

export const updateAdminConditionType = (req: Request, res: Response) =>
  withId(req, res, (id) => adminConditionTypeService.update(id, req.body), 'บันทึกประเภทเงื่อนไขแล้ว');
