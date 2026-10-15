import { Request, Response } from 'express';
import { walletService } from '../services/wallet.service';
import { sendSuccess, sendError } from '../utils/response';

export const getWalletBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const wallet = await walletService.getWalletByUserId(userId);
    sendSuccess(res, wallet, 'ดึงข้อมูลกระเป๋าเงินสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'ไม่สามารถดึงข้อมูลกระเป๋าเงินได้', 500);
  }
};

export const topUpWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการ', 401);
      return;
    }

    const { amount, paymentChannel } = req.body;
    const result = await walletService.topUp(userId, Number(amount), paymentChannel);
    sendSuccess(res, result, 'เติมเงินเข้ากระเป๋าสำเร็จ', 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการเติมเงิน', 400);
  }
};
