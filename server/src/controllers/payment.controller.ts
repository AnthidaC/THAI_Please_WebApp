import { Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { sendSuccess, sendError } from '../utils/response';

export const generateDynamicQr = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, latitude, longitude, shopName, merchantId } = req.body;

    const qrData = await paymentService.generateDynamicQr({
      merchantId,
      amount: Number(amount),
      latitude: Number(latitude),
      longitude: Number(longitude),
      shopName,
    });

    sendSuccess(res, qrData, 'สร้าง Dynamic QR Code รับชำระเงินสำเร็จ', 201);
  } catch (error: any) {
    sendError(res, error.message || 'ไม่สามารถสร้าง QR Code ได้', 500);
  }
};

export const getQrDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const reference = Array.isArray(req.params.reference) ? req.params.reference[0] : req.params.reference;
    const userId = req.user?.userId;

    const details = await paymentService.getQrDetails(reference, userId);
    sendSuccess(res, details, 'ดึงข้อมูล QR Code สำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'ไม่พบข้อมูล QR Code', 404);
  }
};

export const checkoutCopay = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการชำระเงิน', 401);
      return;
    }

    const { qrReference, userLatitude, userLongitude, merchantId } = req.body;

    const result = await paymentService.checkout({
      userId,
      qrReference,
      userLatitude: Number(userLatitude),
      userLongitude: Number(userLongitude),
      merchantId,
    });

    sendSuccess(res, result, 'ชำระเงินร่วม (Co-pay 60/40) สำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'การชำระเงินล้มเหลว', 400);
  }
};
