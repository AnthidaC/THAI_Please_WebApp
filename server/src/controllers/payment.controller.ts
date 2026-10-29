import { Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { sendSuccess, sendError } from '../utils/response';
import { PaymentPinError } from '../services/payment-pin.service';

export const generateDynamicQr = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, latitude, longitude, shopName } = req.body;
    const merchantId = res.locals.paymentMerchantId;

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

export const getQrPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const merchantId = req.user?.userId;
    if (!merchantId) {
      sendError(res, 'กรุณาเข้าสู่ระบบร้านค้า', 401);
      return;
    }
    const reference = Array.isArray(req.params.reference)
      ? req.params.reference[0]
      : req.params.reference;
    const statusData = await paymentService.getQrPaymentStatus(reference, res.locals.paymentMerchantId);
    sendSuccess(res, statusData, 'ตรวจสอบสถานะ QR Code สำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'ไม่สามารถตรวจสอบสถานะ QR Code ได้', 400);
  }
};

/**
 * Server-Sent Events (SSE) สำหรับแจ้งเตือนหน้าจอ POS ของร้านค้าแบบ Real-Time ทันที (0 ms Latency)
 * เมื่อลูกค้าชำระเงินสำเร็จ Server จะส่ง event แจ้งเตือนโดยตรงโดยไม่ต้อง Polling
 */
export const streamQrPaymentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const merchantId = req.user?.userId;
    if (!merchantId) {
      sendError(res, 'กรุณาเข้าสู่ระบบร้านค้า', 401);
      return;
    }
    const reference = Array.isArray(req.params.reference)
      ? req.params.reference[0]
      : req.params.reference;

    const currentStatus = await paymentService.getQrPaymentStatus(reference, res.locals.paymentMerchantId);

    // ตั้งค่า Header สำหรับ Server-Sent Events (SSE)
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write('retry: 3000\n\n');

    // ส่งสถานะปัจจุบันเริ่มต้นทันที
    res.write(`data: ${JSON.stringify(currentStatus)}\n\n`);

    // หากชำระเงินเรียบร้อยแล้ว ให้ปิดการเชื่อมต่อ
    if (currentStatus.status === 'USED') {
      res.end();
      return;
    }

    // ฟังก์ชันรับ Event เมื่อลูกค้ากดชำระเงินสำเร็จ
    const onPaymentCompleted = (paidTransaction: any) => {
      res.write(
        `data: ${JSON.stringify({
          qrReference: reference,
          status: 'USED',
          shopName: currentStatus.shopName,
          totalAmount: currentStatus.totalAmount,
          paidTransaction,
        })}\n\n`
      );
      res.end();
    };

    // ฟังก์ชันรับ Event เมื่อลูกค้าสแกน QR Code เข้าสู่ขั้นตอนชำระเงิน (Real-time Scan Notification)
    const onQrScanned = (scannedInfo: any) => {
      res.write(
        `data: ${JSON.stringify({
          qrReference: reference,
          status: 'SCANNED',
          shopName: currentStatus.shopName,
          totalAmount: currentStatus.totalAmount,
          expiresAt: scannedInfo.expiresAt,
          scannedAt: scannedInfo.scannedAt,
          isScanned: true,
        })}\n\n`
      );
    };

    // สมัครรับ Event การชำระเงินของ QR นี้ครั้งเดียว
    paymentService.qrPaymentEvents.once(`payment:${reference}`, onPaymentCompleted);
    paymentService.qrPaymentEvents.on(`scanned:${reference}`, onQrScanned);

    // ส่ง Heartbeat ทุก 15 วินาที เพื่อรักษาการเชื่อมต่อไม่ให้ถูกตัด
    const heartbeatTimer = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    // เมื่อ Client ปิดหน้าจอ หรือตัดการเชื่อมต่อ ให้เคลียร์ Listener
    req.on('close', () => {
      clearInterval(heartbeatTimer);
      paymentService.qrPaymentEvents.off(`payment:${reference}`, onPaymentCompleted);
      paymentService.qrPaymentEvents.off(`scanned:${reference}`, onQrScanned);
    });
  } catch (error: any) {
    res.end();
  }
};

/**
 * Server-Sent Events (SSE) ระดับร้านค้า (Merchant-Wide Stream)
 * แจ้งเตือนเมื่อมีเงินเข้าหรือมีลูกค้าสแกน QR ใดๆ ของร้านค้าแบบ Real-Time ทันที
 * รองรับกรณีร้านค้าสร้าง QR หลายรายการต่อเนื่องกันโดยไม่ต้องเปิดหน้ารอ
 */
export const streamMerchantPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const merchantId = res.locals.paymentMerchantId;
    if (!merchantId) {
      res.status(403).json({ status: 'error', message: 'ไม่พบร้านค้าที่ผูกกับบัญชีนี้' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write('retry: 3000\n\n');
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', merchantId })}\n\n`);

    const onPayment = (payload: any) => {
      res.write(`data: ${JSON.stringify({ type: 'PAYMENT_RECEIVED', ...payload })}\n\n`);
    };

    const onScanned = (payload: any) => {
      res.write(`data: ${JSON.stringify({ type: 'QR_SCANNED', ...payload })}\n\n`);
    };

    paymentService.qrPaymentEvents.on(`merchant:${merchantId}:payment`, onPayment);
    paymentService.qrPaymentEvents.on(`merchant:${merchantId}:scanned`, onScanned);

    const heartbeatTimer = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeatTimer);
      paymentService.qrPaymentEvents.off(`merchant:${merchantId}:payment`, onPayment);
      paymentService.qrPaymentEvents.off(`merchant:${merchantId}:scanned`, onScanned);
    });
  } catch (error: any) {
    res.end();
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

    const { qrReference, userLatitude, userLongitude, merchantId, discountCode, pin } = req.body;

    const result = await paymentService.checkout({
      userId,
      qrReference,
      userLatitude: Number(userLatitude),
      userLongitude: Number(userLongitude),
      merchantId,
      discountCode,
      pin,
    });

    sendSuccess(res, result, 'ชำระเงินร่วม (Co-pay 60/40) สำเร็จ');
  } catch (error: any) {
    if (error instanceof PaymentPinError) {
      res.status(error.statusCode).json({ status: 'error', code: error.code, message: error.message });
      return;
    }
    sendError(res, error.message || 'การชำระเงินล้มเหลว', 400);
  }
};
