import { z } from 'zod';

export const topUpWalletSchema = z.object({
  amount: z
    .number({ required_error: 'กรุณาระบุจำนวนเงินที่ต้องการเติม' })
    .positive('จำนวนเงินต้องมากกว่า 0 บาท')
    .max(50000, 'สามารถเติมเงินได้สูงสุด 50,000 บาท ต่อครั้ง'),
  paymentChannel: z.string().optional().default('PROMPTPAY'),
});

export const generateQrSchema = z.object({
  amount: z
    .number({ required_error: 'กรุณาระบุจำนวนเงินค่าสินค้า/บริการ' })
    .positive('ยอดเงินต้องมากกว่า 0 บาท')
    .max(100000, 'ยอดเงินต้องไม่เกิน 100,000 บาท'),
  latitude: z
    .number({ required_error: 'กรุณาระบุพิกัด Latitude ของร้านค้า' })
    .min(-90)
    .max(90),
  longitude: z
    .number({ required_error: 'กรุณาระบุพิกัด Longitude ของร้านค้า' })
    .min(-180)
    .max(180),
  shopName: z.string().optional(),
  merchantId: z.string().optional(),
});

export const checkoutCopaySchema = z.object({
  qrReference: z
    .string({ required_error: 'กรุณาระบุรหัสอ้างอิง QR Code' })
    .min(1, 'รหัสอ้างอิง QR Code ไม่ถูกต้อง'),
  merchantId: z.string().optional(),
  userLatitude: z
    .number({ required_error: 'กรุณาระบุพิกัด Latitude ปัจจุบันของผู้ใช้' })
    .min(-90)
    .max(90),
  userLongitude: z
    .number({ required_error: 'กรุณาระบุพิกัด Longitude ปัจจุบันของผู้ใช้' })
    .min(-180)
    .max(180),
  pin: z
    .string()
    .regex(/^\d{6}$/, 'รหัส PIN ยืนยันการชำระเงินต้องเป็นตัวเลข 6 หลัก'),
  discountCode: z.string().optional(),
});

export const setPaymentPinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'รหัส PIN ต้องเป็นตัวเลข 6 หลัก'),
  confirmPin: z.string().regex(/^\d{6}$/, 'กรุณายืนยันรหัส PIN 6 หลัก'),
  currentPin: z.string().regex(/^\d{6}$/, 'PIN ปัจจุบันต้องเป็นตัวเลข 6 หลัก').optional(),
}).refine(data => data.pin === data.confirmPin, {
  message: 'รหัส PIN ทั้งสองช่องไม่ตรงกัน', path: ['confirmPin'],
});

export const validateDiscountSchema = z.object({
  code: z.string({ required_error: 'กรุณาระบุรหัสคูปองหรือโค้ดชวนเพื่อน' }).min(1),
  merchantId: z.string().optional(),
  totalAmount: z.number().positive('ยอดเงินต้องมากกว่า 0 บาท'),
});

export const resolveFraudAlertSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'SUSPEND_MERCHANT', 'SUSPEND_USER'], {
    required_error:
      'กรุณาระบุผลการตรวจสอบ (APPROVE, REJECT, SUSPEND_MERCHANT หรือ SUSPEND_USER)',
  }),
  note: z.string().optional(),
});

export const resolveDossierSchema = z.object({
  targetType: z.enum(['USER', 'MERCHANT'], {
    required_error: 'กรุณาระบุประเภทเป้าหมาย (USER หรือ MERCHANT)',
  }),
  targetId: z.string({ required_error: 'กรุณาระบุ targetId' }).min(1),
  action: z.enum(['APPROVE_ALL', 'REJECT_ALL', 'SUSPEND_USER', 'SUSPEND_MERCHANT'], {
    required_error: 'กรุณาระบุผลการจัดการเคส',
  }),
  note: z.string().optional(),
});
