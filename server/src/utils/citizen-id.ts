import { createHmac } from 'node:crypto';
import { HttpError } from './http-error';

const DEV_CITIZEN_ID_HMAC_SECRET = 'dev-thai-please-citizen-hmac-secret-only';

export const isValidThaiCitizenId = (citizenId: string): boolean => {
  if (!/^\d{13}$/.test(citizenId)) return false;

  let weightedSum = 0;
  for (let index = 0; index < 12; index += 1) {
    weightedSum += Number(citizenId[index]) * (13 - index);
  }
  const checkDigit = (11 - (weightedSum % 11)) % 10;
  return Number(citizenId[12]) === checkDigit;
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

