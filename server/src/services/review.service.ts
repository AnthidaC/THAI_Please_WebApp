import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { CreateReviewInput } from '../validations/review.validation';

export class ReviewError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ReviewError';
    this.statusCode = statusCode;
  }
}

export interface ReviewSubmissionResult {
  reviewId: string;
  transactionId: string;
  merchantId: string;
  merchantName: string;
  ratingStars: number;
  reviewText: string | null;
  isVerifiedPurchase: boolean;
  newMerchantAverageRating: number;
  totalMerchantReviews: number;
  createdAt: string;
}

export interface MerchantReviewsResult {
  merchant: {
    merchantId: string;
    shopName: string;
    averageRating: number;
    totalReviews: number;
  };
  ratingBreakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
  reviews: Array<{
    reviewId: string;
    ratingStars: number;
    reviewText: string | null;
    isVerifiedPurchase: boolean;
    reviewerName: string;
    createdAt: string;
  }>;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export class ReviewService {
  /**
   * ซ่อนข้อมูลชื่อผู้รีวิวเพื่อความเป็นส่วนตัว (Privacy-preserving Masking)
   * ตัวอย่าง: "สมชาย ใจดี" -> "สมชาย ใ***"
   */
  private maskName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return 'ผู้ใช้งาน';
    if (parts.length === 1) {
      const name = parts[0];
      return name.length > 2 ? `${name.slice(0, 2)}***` : `${name}*`;
    }
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${firstName} ${lastName.charAt(0)}***`;
  }

  /**
   * ส่งรีวิวและให้คะแนนร้านค้าหลังทำรายการชำระเงินสำเร็จ
   * ตรวจสอบ: ความเป็นเจ้าของ, สถานะธุรกรรมสำเร็จ, กรอบเวลา 24 ชม., และการป้องกันรีวิวซ้ำ
   */
  public async submitReview(
    userId: string,
    input: CreateReviewInput
  ): Promise<ReviewSubmissionResult> {
    const { transactionId, ratingStars, reviewText } = input;

    // 1. ดึงข้อมูลธุรกรรมพร้อมความสัมพันธ์ของรีวิวเดิม
    const transaction = await prisma.transactions.findUnique({
      where: { transaction_id: transactionId },
      include: {
        reviews: true,
        merchants: {
          select: {
            merchant_id: true,
            shop_name: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new ReviewError('ไม่พบข้อมูลธุรกรรมชำระเงินในระบบ', 404);
    }

    // 2. ตรวจสอบความเป็นเจ้าของธุรกรรม
    if (transaction.user_id !== userId) {
      throw new ReviewError('ไม่มีสิทธิ์ประเมินรีวิวสำหรับธุรกรรมของผู้อื่น', 403);
    }

    // 3. ตรวจสอบสถานะธุรกรรม (ต้องสำเร็จเท่านั้น ตามมาตรฐาน Co-pay: SUCCESS หรือ FLAGGED)
    if (transaction.status !== 'SUCCESS' && transaction.status !== 'FLAGGED') {
      throw new ReviewError('สามารถประเมินรีวิวได้เฉพาะธุรกรรมที่ชำระเงินสำเร็จเท่านั้น', 400);
    }

    // 4. ตรวจสอบกรอบเวลา 24 ชั่วโมง
    const createdAtMs = new Date(transaction.created_at).getTime();
    const isWithin24Hours = Date.now() - createdAtMs <= TWENTY_FOUR_HOURS_MS;
    if (!isWithin24Hours) {
      throw new ReviewError(
        'สิทธิ์การประเมินรีวิวหมดอายุแล้ว (สามารถรีวิวได้ภายใน 24 ชม. หลังทำรายการ)',
        400
      );
    }

    // 5. ตรวจสอบการรีวิวซ้ำ
    if (transaction.reviews) {
      throw new ReviewError('ธุรกรรมนี้ได้รับการประเมินรีวิวไปแล้ว', 400);
    }

    // 6. ดำเนินการสร้างรีวิวและอัปเดตคะแนนเฉลี่ยร้านค้าแบบ Atomic Prisma Transaction
    try {
      return await prisma.$transaction(async (txPrisma) => {
        // 1. เข้าครอบครอง Row-level Lock ของร้านค้าด้วย Parameterized Query ($queryRaw)
        // เพื่อป้องกัน Race Condition เมื่อมี Concurrent Reviews ของร้านเดียวกันเข้ามาพร้อมกัน
        await txPrisma.$queryRaw`
          SELECT merchant_id 
          FROM merchants 
          WHERE merchant_id = ${transaction.merchant_id}::uuid 
          FOR UPDATE
        `;

        // 2. บันทึกรีวิวใหม่
        const createdReview = await txPrisma.reviews.create({
          data: {
            transaction_id: transactionId,
            user_id: userId,
            merchant_id: transaction.merchant_id,
            rating_stars: ratingStars,
            review_text: reviewText?.trim() || null,
            is_verified_purchase: true,
          },
        });

        // คำนวณคะแนนเฉลี่ยและจำนวนรีวิวทั้งหมดของร้านค้านี้ใหม่
        const aggregate = await txPrisma.reviews.aggregate({
          where: { merchant_id: transaction.merchant_id },
          _avg: { rating_stars: true },
          _count: { rating_stars: true },
        });

        const rawAverage = aggregate._avg.rating_stars ?? ratingStars;
        const newAverage = Math.round(rawAverage * 10) / 10;

        // อัปเดตดาวเฉลี่ยลงในตาราง merchants
        await txPrisma.merchants.update({
          where: { merchant_id: transaction.merchant_id },
          data: {
            average_rating_stars: newAverage,
          },
        });

        return {
          reviewId: createdReview.review_id,
          transactionId: createdReview.transaction_id,
          merchantId: createdReview.merchant_id,
          merchantName: transaction.merchants.shop_name,
          ratingStars: createdReview.rating_stars,
          reviewText: createdReview.review_text,
          isVerifiedPurchase: createdReview.is_verified_purchase,
          newMerchantAverageRating: newAverage,
          totalMerchantReviews: aggregate._count.rating_stars,
          createdAt: createdReview.created_at.toISOString(),
        };
      });
    } catch (error: any) {
      // จัดการ Concurrency กรณี Unique Constraint ของ transaction_id ชนกัน (Code P2002)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ReviewError('ธุรกรรมนี้ได้รับการประเมินรีวิวไปแล้ว', 409);
      }
      throw error;
    }
  }

  /**
   * ดึงรายการรีวิวและสถิติคะแนนของร้านค้า (Public เข้าถึงได้)
   */
  public async getMerchantReviews(
    merchantId: string,
    page = 1,
    limit = 10
  ): Promise<MerchantReviewsResult> {
    // 1. ตรวจสอบการมีอยู่ของร้านค้า
    const merchant = await prisma.merchants.findUnique({
      where: { merchant_id: merchantId },
      select: {
        merchant_id: true,
        shop_name: true,
        average_rating_stars: true,
      },
    });

    if (!merchant) {
      throw new ReviewError('ไม่พบข้อมูลร้านค้าในระบบ', 404);
    }

    const skip = (page - 1) * limit;

    // 2. ดึงคะแนนดาวทั้งหมดเพื่อจัดทำสถิติ (ใช้ findMany แทน groupBy เพื่อป้องกันปัญหา Prepared Statement ของ PgBouncer)
    const allRatingStars = await prisma.reviews.findMany({
      where: { merchant_id: merchantId },
      select: { rating_stars: true },
    });

    const totalItems = allRatingStars.length;

    // จัดทำ Distribution สรุป 1–5 ดาว ในหน่วยความจำอย่างปลอดภัยและรวดเร็ว
    const ratingBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of allRatingStars) {
      if (ratingBreakdown[r.rating_stars] !== undefined) {
        ratingBreakdown[r.rating_stars]++;
      }
    }

    // 3. ดึงรายการรีวิวตาม Pagination
    const reviews = await prisma.reviews.findMany({
      where: { merchant_id: merchantId },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      include: {
        users: {
          select: {
            full_name: true,
          },
        },
      },
    });

    return {
      merchant: {
        merchantId: merchant.merchant_id,
        shopName: merchant.shop_name,
        averageRating: Number(merchant.average_rating_stars),
        totalReviews: totalItems,
      },
      ratingBreakdown: ratingBreakdown as MerchantReviewsResult['ratingBreakdown'],
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit) || 1,
        totalItems,
      },
      reviews: reviews.map((r) => ({
        reviewId: r.review_id,
        ratingStars: r.rating_stars,
        reviewText: r.review_text,
        isVerifiedPurchase: r.is_verified_purchase,
        reviewerName: this.maskName(r.users.full_name),
        createdAt: r.created_at.toISOString(),
      })),
    };
  }
}

export const reviewService = new ReviewService();
