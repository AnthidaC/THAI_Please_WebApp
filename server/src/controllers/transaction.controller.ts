import { Request, Response } from 'express';
import { transactionService } from '../services/transaction.service';
import { sendSuccess, sendError } from '../utils/response';

export const getBuyerHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const history = await transactionService.getBuyerHistory(userId);
    sendSuccess(res, history, 'ดึงประวัติการสั่งซื้อสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'ไม่สามารถดึงประวัติธุรกรรมได้', 500);
  }
};

export const getMerchantHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const merchantId = req.query.merchantId as string | undefined;
    const history = await transactionService.getMerchantHistory(merchantId);
    sendSuccess(res, history, 'ดึงสรุปยอดขายและสถิติร้านค้าสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'ไม่สามารถดึงข้อมูลสถิติร้านค้าได้', 500);
  }
};

export const getTransactionSlip = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const slip = await transactionService.getTransactionSlip(id);
    sendSuccess(res, slip, 'ดึงหลักฐานการชำระเงิน (Slip) สำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'ไม่พบหลักฐานการชำระเงิน', 404);
  }
};
