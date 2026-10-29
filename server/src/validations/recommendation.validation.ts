import { z } from 'zod';

/**
 * ค่าคอนฟิกเริ่มต้นสำหรับการแนะนำร้านค้า (Provisional Defaults)
 * [PROVISIONAL NOTE]: ค่าเหล่านี้เป็นค่าชั่วคราวสำหรับการพัฒนา อาจปรับเปลี่ยนตามนโยบายของระบบ
 */
export const PROVISIONAL_RECOMMENDATION_CONFIG = {
  defaultRadiusKm: 10,
  minRadiusKm: 1,
  maxRadiusKm: 20,
  defaultLimit: 5,
  minLimit: 1,
  maxLimit: 10,
} as const;

/**
 * Preprocessor สำหรับแปลงค่าพารามิเตอร์ Query สตริงว่างให้เป็น undefined
 * เพื่อป้องกันกรณี Number('') ถูกแปลงเป็น 0 โดยไม่ตั้งใจ
 */
const preprocessEmptyStringToUndefined = (val: unknown): unknown => {
  if (val === undefined || val === null || val === '') {
    return undefined;
  }
  return val;
};

/**
 * Zod Schema สำหรับตรวจสอบ Request Query ในการค้นหาร้านค้าแนะนำรอบตัว (GET /recommendations/near-me)
 * - บังคับระบุพิกัด latitude (-90 ถึง 90) และ longitude (-180 ถึง 180)
 * - แปลงสตริงจาก Query Parameter เป็นตัวเลขอย่างปลอดภัย (Type Coercion)
 * - ปฏิเสธค่า NaN, Infinity, สตริงว่าง หรือค่าพิกัดที่อยู่นอกเกณฑ์สากล
 * - ไม่รับ userId จาก Query เพื่อความปลอดภัย (ต้องรับจาก Authenticated User เท่านั้น)
 */
export const getRecommendationsQuerySchema = z.object({
  latitude: z.preprocess(
    preprocessEmptyStringToUndefined,
    z.coerce
      .number({ error: 'พิกัดละติจูดต้องเป็นตัวเลขที่ถูกต้อง' })
      .min(-90, 'พิกัดละติจูดต้องอยู่ระหว่าง -90 ถึง 90 องศา')
      .max(90, 'พิกัดละติจูดต้องอยู่ระหว่าง -90 ถึง 90 องศา')
      .refine((val) => !isNaN(val) && isFinite(val), {
        message: 'พิกัดละติจูดต้องเป็นตัวเลขจริง (ไม่ใช่ NaN หรือ Infinity)',
      })
  ),

  longitude: z.preprocess(
    preprocessEmptyStringToUndefined,
    z.coerce
      .number({ error: 'พิกัดลองจิจูดต้องเป็นตัวเลขที่ถูกต้อง' })
      .min(-180, 'พิกัดลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180 องศา')
      .max(180, 'พิกัดลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180 องศา')
      .refine((val) => !isNaN(val) && isFinite(val), {
        message: 'พิกัดลองจิจูดต้องเป็นตัวเลขจริง (ไม่ใช่ NaN หรือ Infinity)',
      })
  ),

  radiusKm: z.preprocess(
    preprocessEmptyStringToUndefined,
    z.coerce
      .number({
        error: 'รัศมีการค้นหาต้องเป็นตัวเลข',
      })
      .min(
        PROVISIONAL_RECOMMENDATION_CONFIG.minRadiusKm,
        `รัศมีการค้นหาต้องไม่ต่ำกว่า ${PROVISIONAL_RECOMMENDATION_CONFIG.minRadiusKm} กิโลเมตร`
      )
      .max(
        PROVISIONAL_RECOMMENDATION_CONFIG.maxRadiusKm,
        `รัศมีการค้นหาต้องไม่เกิน ${PROVISIONAL_RECOMMENDATION_CONFIG.maxRadiusKm} กิโลเมตร`
      )
      .default(PROVISIONAL_RECOMMENDATION_CONFIG.defaultRadiusKm)
      .refine((val) => !isNaN(val) && isFinite(val), {
        message: 'รัศมีการค้นหาต้องเป็นตัวเลขจริง (ไม่ใช่ NaN หรือ Infinity)',
      })
  ),

  limit: z.preprocess(
    preprocessEmptyStringToUndefined,
    z.coerce
      .number({
        error: 'จำนวนรายการที่ต้องการต้องเป็นตัวเลข',
      })
      .int('จำนวนรายการที่ต้องการต้องเป็นจำนวนเต็ม')
      .min(
        PROVISIONAL_RECOMMENDATION_CONFIG.minLimit,
        `จำนวนรายการต้องไม่ต่ำกว่า ${PROVISIONAL_RECOMMENDATION_CONFIG.minLimit} รายการ`
      )
      .max(
        PROVISIONAL_RECOMMENDATION_CONFIG.maxLimit,
        `จำนวนรายการต้องไม่เกิน ${PROVISIONAL_RECOMMENDATION_CONFIG.maxLimit} รายการ`
      )
      .default(PROVISIONAL_RECOMMENDATION_CONFIG.defaultLimit)
      .refine((val) => !isNaN(val) && isFinite(val), {
        message: 'จำนวนรายการต้องเป็นตัวเลขจริง (ไม่ใช่ NaN หรือ Infinity)',
      })
  ),
});

export type GetRecommendationsQuery = z.infer<typeof getRecommendationsQuerySchema>;
