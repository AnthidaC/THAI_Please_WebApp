import { Request, Response } from 'express';
import { fraudService } from '../services/fraud.service';
import { sendSuccess, sendError } from '../utils/response';

export const getFraudAlerts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await fraudService.getFlaggedAlerts();
    sendSuccess(res, alerts, 'ดึงรายการแจ้งเตือนการทุจริตสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'ไม่สามารถดึงข้อมูลรายการทุจริตได้', 500);
  }
};

export const resolveFraudAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { action, note } = req.body;
    const adminId = req.user?.userId;

    const result = await fraudService.resolveAlert(id, action, adminId, note);
    const actionLabels: Record<string, string> = {
      APPROVE: 'ยืนยันรายการปกติ (Approve)',
      REJECT: 'ส่งเรื่องตรวจสอบเบื้องหลัง (ไม่ดึงเงินคืนอัตโนมัติ)',
      SUSPEND_MERCHANT: 'ระงับสิทธิ์ร้านค้าชั่วคราวเพื่อเข้าตรวจสอบ',
      SUSPEND_USER: 'ระงับสิทธิ์ Co-pay ของประชาชนที่น่าสงสัย',
    };
    sendSuccess(res, result, `ดำเนินการ ${actionLabels[action] || action} สำเร็จ`);
  } catch (error: any) {
    sendError(res, error.message || 'ไม่สามารถดำเนินการตรวจสอบได้', 400);
  }
};

