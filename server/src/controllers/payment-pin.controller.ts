import { Request, Response } from 'express';
import { paymentPinService, PaymentPinError } from '../services/payment-pin.service';
import { sendSuccess } from '../utils/response';

const handleError = (res: Response, error: unknown) => {
  if (error instanceof PaymentPinError) {
    res.status(error.statusCode).json({ status: 'error', code: error.code, message: error.message });
    return;
  }
  res.status(500).json({ status: 'error', message: 'ไม่สามารถจัดการรหัส PIN ได้ กรุณาลองใหม่' });
};

export const getPaymentPinStatus = async (req: Request, res: Response) => {
  try {
    sendSuccess(res, await paymentPinService.getStatus(req.user!.userId));
  } catch (error) { handleError(res, error); }
};

export const setPaymentPin = async (req: Request, res: Response) => {
  try {
    sendSuccess(res, await paymentPinService.setPin(req.user!.userId, req.body.pin, req.body.currentPin), 'บันทึกรหัส PIN สำเร็จ');
  } catch (error) { handleError(res, error); }
};

export const resetPaymentPin = async (req: Request, res: Response) => {
  try {
    sendSuccess(res, await paymentPinService.resetPin(req.user!.userId, req.body.pin, req.user!), 'ตั้งรหัส PIN ใหม่สำเร็จ');
  } catch (error) { handleError(res, error); }
};
