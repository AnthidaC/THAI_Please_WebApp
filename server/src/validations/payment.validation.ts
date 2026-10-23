import { z } from 'zod';

export const topUpWalletSchema = z.object({
  amount: z
    .number({ message: 'กรุณาระบุจำนวนเงินที่ต้องการเติม' })
    .positive('จำนวนเงินต้องมากกว่า 0 บาท')
    .max(50000, 'สามารถเติมเงินได้สูงสุด 50,000 บาท ต่อครั้ง'),
  paymentChannel: z.string().optional().default('PROMPTPAY'),
});

export const generateQrSchema = z.object({
  amount: z
    .number({ message: 'กรุณาระบุจำนวนเงินค่าสินค้า/บริการ' })
    .positive('ยอดเงินต้องมากกว่า 0 บาท')
    .max(100000, 'ยอดเงินต้องไม่เกิน 100,000 บาท'),
  latitude: z
    .number({ message: 'กรุณาระบุพิกัด Latitude ของร้านค้า' })
    .min(-90)
    .max(90),
  longitude: z
    .number({ message: 'กรุณาระบุพิกัด Longitude ของร้านค้า' })
    .min(-180)
    .max(180),
  shopName: z.string().optional(),
  merchantId: z.string().optional(),
});

export const checkoutCopaySchema = z.object({
  qrReference: z
    .string({ message: 'กรุณาระบุรหัสอ้างอิง QR Code' })
    .min(1, 'รหัสอ้างอิง QR Code ไม่ถูกต้อง'),
  merchantId: z.string().optional(),
  userLatitude: z
    .number({ message: 'กรุณาระบุพิกัด Latitude ปัจจุบันของผู้ใช้' })
    .min(-90)
    .max(90),
  userLongitude: z
    .number({ message: 'กรุณาระบุพิกัด Longitude ปัจจุบันของผู้ใช้' })
    .min(-180)
    .max(180),
  pin: z
    .string()
    .regex(/^\d{6}$/, 'รหัส PIN ยืนยันการชำระเงินต้องเป็นตัวเลข 6 หลัก')
    .optional(),
  discountCode: z.string().optional(),
});

export const validateDiscountSchema = z.object({
  code: z.string({ message: 'กรุณาระบุรหัสคูปองหรือโค้ดชวนเพื่อน' }).min(1),
  merchantId: z.string().optional(),
  totalAmount: z.number().positive('ยอดเงินต้องมากกว่า 0 บาท'),
});

export const resolveFraudAlertSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'SUSPEND_MERCHANT', 'SUSPEND_USER'], {
    message: 'กรุณาระบุผลการตรวจสอบ (APPROVE, REJECT, SUSPEND_MERCHANT หรือ SUSPEND_USER)',
  }),
  note: z.string().optional(),
});

export const resolveDossierSchema = z.object({
  targetType: z.enum(['USER', 'MERCHANT'], {
    message: 'กรุณาระบุประเภทเป้าหมาย (USER หรือ MERCHANT)',
  }),
  targetId: z.string({ message: 'กรุณาระบุ targetId' }).min(1),
  action: z.enum(['APPROVE_ALL', 'REJECT_ALL', 'SUSPEND_USER', 'SUSPEND_MERCHANT'], {
    message: 'กรุณาระบุผลการจัดการเคส',
  }),
  note: z.string().optional(),
});
