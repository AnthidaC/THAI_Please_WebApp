import prisma from '../utils/prisma';

/**
 * ค่าคงที่ระยะเวลาสำหรับสถิติความนิยมแบบ Rolling Window (24 ชั่วโมง)
 */
export const POPULARITY_WINDOW_HOURS = 24;
export const POPULARITY_WINDOW_MS = POPULARITY_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * สถานะธุรกรรมที่นับเป็นยอดขายและความนิยมที่เกิดขึ้นจริง
 * - SUCCESS: ชำระเงินสำเร็จปกติ
 * - FLAGGED: ชำระเงินสำเร็จแต่ระบบตรวจจับความผิดปกติไว้ตรวจย้อนหลัง (ถือเป็นยอดซื้อขายจริงในมุมผู้บริโภค)
 */
export const POPULARITY_STATUSES = ['SUCCESS', 'FLAGGED'] as const;

export interface PopularityWindowOptions {
  /** เวลาอ้างอิงสำหรับคำนวณหน้าต่าง 24 ชม. (Default: Date.now()) */
  referenceTime?: Date;
  /** ระยะเวลาหน้าต่างเป็นชั่วโมง (Default: 24 ชม.) */
  windowHours?: number;
}

/**
 * Service รวมสถิติความนิยมร้านค้าใน 24 ชั่วโมง (Developer 3)
 */
export class RecommendationPopularityService {
  /**
   * ดึงจำนวนธุรกรรมสำเร็จใน 24 ชั่วโมงที่ผ่านมาของกลุ่มร้านค้าที่กำหนด
   * @param merchantIds รายการรหัสร้านค้า (Candidate Merchants)
   * @param options ตัวเลือกกำหนดเวลาอ้างอิงและขนาดหน้าต่างเวลา (เพื่อความแน่นอน Deterministic ในการทดสอบ)
   * @returns Map<merchantId, transactionCount> โดยร้านค้าที่ไม่มีธุรกรรมจะได้ค่า 0 เสมอ
   */
  public async get24HourMerchantPopularity(
    merchantIds: string[],
    options?: PopularityWindowOptions
  ): Promise<Map<string, number>> {
    // 1. ตรวจสอบและกรองรหัสร้านค้าที่ซ้ำซ้อนหรือค่าว่างทิ้ง (Deduplicate & Sanitize)
    if (!merchantIds || !Array.isArray(merchantIds) || merchantIds.length === 0) {
      return new Map<string, number>();
    }

    const uniqueMerchantIds = Array.from(
      new Set(
        merchantIds
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          .map((id) => id.trim())
      )
    );

    // หากไม่มี ID ที่ถูกต้อง ไม่จำเป็นต้องเรียกฐานข้อมูล (Zero DB Query)
    if (uniqueMerchantIds.length === 0) {
      return new Map<string, number>();
    }

    // เตรียม Map ผลลัพธ์และกำหนดค่าเริ่มต้นให้ทุกร้านเป็น 0 (Handling zero transactions)
    const popularityMap = new Map<string, number>();
    for (const merchantId of uniqueMerchantIds) {
      popularityMap.set(merchantId, 0);
    }

    // 2. กำหนดขอบเขตเวลา Rolling Window ที่แม่นยำและ Deterministic
    const now = options?.referenceTime ?? new Date();
    const windowHours = options?.windowHours ?? POPULARITY_WINDOW_HOURS;
    const windowMs = windowHours * 60 * 60 * 1000;
    const windowStart = new Date(now.getTime() - windowMs);

    // 3. เรียก Prisma groupBy เพื่อรวมยอดธุรกรรมสำเร็จที่เกิดขึ้นในหน้าต่าง 24 ชม.
    // - กรองเฉพาะสถานะ SUCCESS และ FLAGGED
    // - ใช้ completed_at ซึ่งได้รับการยืนยันว่า payment.service.ts บันทึกเวลาตัดเงินสำเร็จจริงเสมอ
    const aggregations = await prisma.transactions.groupBy({
      by: ['merchant_id'],
      _count: {
        transaction_id: true,
      },
      where: {
        merchant_id: { in: uniqueMerchantIds },
        status: { in: [...POPULARITY_STATUSES] },
        completed_at: {
          gte: windowStart,
          lte: now,
        },
      },
    });

    // 4. บันทึกจำนวนธุรกรรมลงใน Map
    for (const row of aggregations) {
      popularityMap.set(row.merchant_id, row._count.transaction_id);
    }

    return popularityMap;
  }
}

export const recommendationPopularityService = new RecommendationPopularityService();

export const get24HourMerchantPopularity = (
  merchantIds: string[],
  options?: PopularityWindowOptions
): Promise<Map<string, number>> => {
  return recommendationPopularityService.get24HourMerchantPopularity(merchantIds, options);
};
