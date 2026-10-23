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

export const getFraudDossiers = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeNoise = req.query.includeNoise === 'true';
    const dossiers = await fraudService.getFraudDossiers(includeNoise);
    sendSuccess(res, dossiers, 'ดึงข้อมูลแฟ้มสรุปคดีความเสี่ยงระดับบุคคลและร้านค้าสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'ไม่สามารถดึงข้อมูลแฟ้มคดีทุจริตได้', 500);
  }
};

export const resolveDossier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetType, targetId, action, note } = req.body;
    const adminId = req.user?.userId;

    const result = await fraudService.resolveDossier({
      targetType,
      targetId,
      action,
      adminId,
      note,
    });

    const actionLabels: Record<string, string> = {
      APPROVE_ALL: 'อนุมัติทุกรายการในแฟ้มคดีสำเร็จ (Approve All)',
      REJECT_ALL: 'ปฏิเสธทุกรายการในแฟ้มคดีสำเร็จ (Reject All)',
      SUSPEND_USER: 'ระงับสิทธิ์ Co-pay ของประชาชนรายนี้สำเร็จ',
      SUSPEND_MERCHANT: 'ระงับสิทธิ์ร้านค้านี้เพื่อเข้าตรวจสอบสำเร็จ',
    };

    sendSuccess(res, result, actionLabels[action] || 'จัดการแฟ้มคดีสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'ไม่สามารถจัดการแฟ้มคดีได้', 400);
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

