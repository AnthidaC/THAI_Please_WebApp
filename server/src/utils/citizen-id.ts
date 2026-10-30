import { createHmac } from 'node:crypto';
import { HttpError } from './http-error';

const DEV_CITIZEN_ID_HMAC_SECRET = 'dev-thai-please-citizen-hmac-secret-only';

/**
 * ตรวจสอบเลขประจำตัว 13 หลัก — ตรวจสอบเฉพาะความยาวตัวเลข 13 หลัก
 */
export const isValidThaiCitizenId = (citizenId: string): boolean => {
  return /^\d{13}$/.test(citizenId.trim());
};

export const getCitizenIdHmacSecret = (): string => {
  const envSecret = process.env.CITIZEN_ID_HMAC_SECRET?.trim();
  if (envSecret) return envSecret;

  if (process.env.NODE_ENV === 'development') {
    return DEV_CITIZEN_ID_HMAC_SECRET;
  }

  throw new HttpError(503, 'ระบบตรวจสอบความปลอดภัยเลขบัตรประชาชนไม่พร้อมใช้งาน');
};

export const hashCitizenId = (citizenId: string): string => {
  const secret = getCitizenIdHmacSecret();
  return createHmac('sha256', secret).update(citizenId.trim()).digest('hex');
};
