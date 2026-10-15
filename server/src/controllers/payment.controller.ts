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
    const discountCode = req.query.discountCode as string | undefined;
    const userLatitude = req.query.userLatitude ? Number(req.query.userLatitude) : undefined;
    const userLongitude = req.query.userLongitude ? Number(req.query.userLongitude) : undefined;

    const userLocation =
      userLatitude !== undefined &&
      userLongitude !== undefined &&
      !isNaN(userLatitude) &&
      !isNaN(userLongitude)
        ? { lat: userLatitude, lon: userLongitude }
        : undefined;

    const details = await paymentService.getQrDetails(reference, userId, discountCode, userLocation);
    sendSuccess(res, details, 'ดึงข้อมูล QR Code สำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'ไม่พบข้อมูล QR Code', 400);
  }
};

export const validateDiscount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, merchantId, totalAmount } = req.body;
    const userId = req.user?.userId;

    const result = await paymentService.validateDiscountCode({
      code,
      userId,
      merchantId,
      totalAmount: Number(totalAmount),
    });

    sendSuccess(res, result, 'ตรวจสอบรหัสส่วนลดสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'รหัสคูปองหรือโค้ดคำชวนของเพื่อนไม่ถูกต้อง', 400);
  }
};

export const checkoutCopay = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      sendError(res, 'กรุณาเข้าสู่ระบบก่อนทำรายการชำระเงิน', 401);
      return;
    }

    const { qrReference, userLatitude, userLongitude, merchantId, discountCode } = req.body;

    const result = await paymentService.checkout({
      userId,
      qrReference,
      userLatitude: Number(userLatitude),
      userLongitude: Number(userLongitude),
      merchantId,
      discountCode,
    });

    sendSuccess(res, result, 'ชำระเงินร่วม (Co-pay 60/40) สำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'การชำระเงินล้มเหลว', 400);
  }
};
