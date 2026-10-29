import prisma from '../utils/prisma';
import { awardAfterActivity } from './achievements/badgeAwardEngine';

const REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;
const REVIEWABLE_STATUSES = ['SUCCESS', 'FLAGGED'];

export class ReviewServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'ReviewServiceError';
  }
}
export const ReviewError = ReviewServiceError;

export interface CreateReviewInput {
  transactionId: string;
  ratingStars: number;
  reviewText?: string | null;
  isAnonymous?: boolean;
}

export interface ReviewSubmissionResult {
  reviewId: string;
  transactionId: string;
  merchantId: string;
  merchantName: string;
  ratingStars: number;
  reviewText: string | null;
  isVerifiedPurchase: boolean;
  isAnonymous: boolean;
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

function maskName(fullName: string): string {
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
 * Creates one review for the caller's own completed transaction inside the
 * existing 24-hour review window, updates merchant average rating with row-level locking,
 * and evaluates Badge progress.
 */
export const createReview = async (
  userId: string,
  input: CreateReviewInput,
  prismaClient: any = prisma,
  skipBadgeAward = false
): Promise<ReviewSubmissionResult> => {
  const transaction = await prismaClient.transactions.findUnique({
    where: { transaction_id: input.transactionId },
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

  if (!transaction || transaction.user_id !== userId) {
    throw new ReviewServiceError('ไม่พบข้อมูลธุรกรรมชำระเงินในระบบ', 404);
  }

  // นโยบาย Payment-First: อนุญาตเฉพาะธุรกรรมที่ชำระเงินสำเร็จจริง (completed_at ไม่เป็น null)
  if (!transaction.completed_at || !REVIEWABLE_STATUSES.includes(transaction.status)) {
    throw new ReviewServiceError('สามารถประเมินรีวิวได้เฉพาะธุรกรรมที่ชำระเงินสำเร็จเท่านั้น', 400);
  }

  // หน้าต่างการรีวิว 24 ชั่วโมง: เริ่มนับจากเวลาชำระเงินสำเร็จ (transactions.completed_at)
  if (Date.now() - new Date(transaction.completed_at).getTime() > REVIEW_WINDOW_MS) {
    throw new ReviewServiceError(
      'สิทธิ์การประเมินรีวิวหมดอายุแล้ว (สามารถรีวิวได้ภายใน 24 ชม. หลังชำระเงิน)',
      400
    );
  }
  if (transaction.reviews) {
    throw new ReviewServiceError('ธุรกรรมนี้ได้รับการประเมินรีวิวไปแล้ว', 409);
  }

  let result: ReviewSubmissionResult;
  try {
    result = await prismaClient.$transaction(async (txPrisma: any) => {
      // Row-level lock ของร้านค้าเพื่อป้องกัน Race condition
      await txPrisma.$queryRaw`
        SELECT merchant_id 
        FROM merchants 
        WHERE merchant_id = ${transaction.merchant_id}::uuid 
        FOR UPDATE
      `;

      const createdReview = await txPrisma.reviews.create({
        data: {
          transaction_id: transaction.transaction_id,
          user_id: userId,
          merchant_id: transaction.merchant_id,
          rating_stars: input.ratingStars,
          review_text: input.reviewText?.trim() || null,
          is_verified_purchase: true,
          is_anonymous: Boolean(input.isAnonymous),
        },
      });

      const aggregate = await txPrisma.reviews.aggregate({
        where: { merchant_id: transaction.merchant_id },
        _avg: { rating_stars: true },
        _count: { rating_stars: true },
      });

      const rawAverage = aggregate._avg.rating_stars ?? input.ratingStars;
      const newAverage = Math.round(rawAverage * 10) / 10;

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
        isAnonymous: createdReview.is_anonymous,
        newMerchantAverageRating: newAverage,
        totalMerchantReviews: aggregate._count.rating_stars,
        createdAt: createdReview.created_at.toISOString(),
      };
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new ReviewServiceError('ธุรกรรมนี้ได้รับการประเมินรีวิวไปแล้ว', 409);
    }
    throw error;
  }

  // Post-commit: Gamification Badge Evaluation
  if (!skipBadgeAward) {
    await awardAfterActivity(userId, ['review_count'], 'review creation');
  }

  return result;
};

/**
 * ดึงข้อมูลการประเมินรีวิวและความพร้อมใช้งานสิทธิ์รีวิวของธุรกรรมเฉพาะราย (Authenticated)
 */
export const getReviewByTransactionId = async (
  userId: string,
  transactionId: string,
  prismaClient: any = prisma
) => {
  // ตรวจสอบทั้งสถานะธุรกรรมและข้อมูลรีวิวในคิวรีเดียว
  const transaction = await prismaClient.transactions.findUnique({
    where: { transaction_id: transactionId },
    include: {
      reviews: {
        include: {
          merchants: {
            select: {
              merchant_id: true,
              shop_name: true,
            },
          },
        },
      },
    },
  });

  if (!transaction) {
    // Fallback: ตรวจสอบตาราง reviews โดยตรงเพื่อความเข้ากันได้
    const review = await prismaClient.reviews.findUnique({
      where: { transaction_id: transactionId },
      include: {
        merchants: {
          select: {
            merchant_id: true,
            shop_name: true,
          },
        },
      },
    });

    if (!review) {
      return {
        reviewed: false,
        isEligible: false,
        eligibilityStatus: 'NOT_ELIGIBLE' as const,
        message: 'ไม่พบข้อมูลธุรกรรมในระบบ',
        review: null,
      };
    }

    if (review.user_id !== userId) {
      throw new ReviewServiceError('ไม่มีสิทธิ์เข้าถึงข้อมูลรีวิวของธุรกรรมผู้อื่น', 403);
    }

    return {
      reviewed: true,
      isEligible: false,
      eligibilityStatus: 'ALREADY_REVIEWED' as const,
      message: 'ธุรกรรมนี้ได้รับการประเมินรีวิวไปแล้ว',
      review: {
        reviewId: review.review_id,
        transactionId: review.transaction_id,
        merchantId: review.merchant_id,
        merchantName: review.merchants.shop_name,
        ratingStars: review.rating_stars,
        reviewText: review.review_text,
        isVerifiedPurchase: review.is_verified_purchase,
        isAnonymous: review.is_anonymous,
        createdAt: review.created_at.toISOString(),
      },
    };
  }

  if (transaction.user_id !== userId) {
    throw new ReviewServiceError('ไม่มีสิทธิ์เข้าถึงข้อมูลรีวิวของธุรกรรมผู้อื่น', 403);
  }

  // 1. เคยประเมินรีวิวไปแล้ว
  if (transaction.reviews) {
    const rev = transaction.reviews;
    return {
      reviewed: true,
      isEligible: false,
      eligibilityStatus: 'ALREADY_REVIEWED' as const,
      message: 'ธุรกรรมนี้ได้รับการประเมินรีวิวไปแล้ว',
      review: {
        reviewId: rev.review_id,
        transactionId: rev.transaction_id,
        merchantId: rev.merchant_id,
        merchantName: rev.merchants.shop_name,
        ratingStars: rev.rating_stars,
        reviewText: rev.review_text,
        isVerifiedPurchase: rev.is_verified_purchase,
        isAnonymous: rev.is_anonymous,
        createdAt: rev.created_at.toISOString(),
      },
    };
  }

  // 2. ตรวจสอบสถานะการชำระเงิน (ต้องชำระเงินสำเร็จจริง: completed_at ไม่เป็น null และสถานะอยู่ใน REVIEWABLE_STATUSES)
  if (!transaction.completed_at || !REVIEWABLE_STATUSES.includes(transaction.status)) {
    return {
      reviewed: false,
      isEligible: false,
      eligibilityStatus: 'NOT_ELIGIBLE' as const,
      message: 'สามารถประเมินรีวิวได้เฉพาะธุรกรรมที่ชำระเงินสำเร็จเท่านั้น',
      review: null,
    };
  }

  // 3. สิทธิ์รีวิวหมดอายุ 24 ชั่วโมง เริ่มนับจากเวลาชำระเงินสำเร็จ (transactions.completed_at)
  const isExpired = Date.now() - new Date(transaction.completed_at).getTime() > REVIEW_WINDOW_MS;
  const expiresAt = new Date(new Date(transaction.completed_at).getTime() + REVIEW_WINDOW_MS).toISOString();

  if (isExpired) {
    return {
      reviewed: false,
      isEligible: false,
      eligibilityStatus: 'EXPIRED' as const,
      message: 'สิทธิ์การประเมินรีวิวหมดอายุแล้ว (สามารถรีวิวได้ภายใน 24 ชม. หลังชำระเงิน)',
      verificationTimestamp: new Date(transaction.completed_at).toISOString(),
      expiresAt,
      review: null,
    };
  }

  // 4. มีสิทธิ์ส่งรีวิว (ชำระเงินสำเร็จ & ภายใน 24 ชม. & ยังไม่เคยรีวิว)
  return {
    reviewed: false,
    isEligible: true,
    eligibilityStatus: 'ELIGIBLE' as const,
    message: null,
    verificationTimestamp: new Date(transaction.completed_at).toISOString(),
    expiresAt,
    review: null,
  };
};

/**
 * ดึงประวัติการประเมินรีวิวทั้งหมดของผู้ใช้งานปัจจุบัน (Authenticated)
 */
export const getUserReviews = async (userId: string, prismaClient: any = prisma) => {
  const reviews = await prismaClient.reviews.findMany({
    where: { user_id: userId },
    include: {
      merchants: {
        select: {
          merchant_id: true,
          shop_name: true,
          average_rating_stars: true,
        },
      },
      transactions: {
        select: {
          transaction_id: true,
          total_amount: true,
          citizen_paid_amount: true,
          created_at: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return reviews.map((r: any) => ({
    reviewId: r.review_id,
    transactionId: r.transaction_id,
    merchantId: r.merchant_id,
    merchantName: r.merchants.shop_name,
    merchantAverageRating: Number(r.merchants.average_rating_stars),
    ratingStars: r.rating_stars,
    reviewText: r.review_text,
    isVerifiedPurchase: r.is_verified_purchase,
    isAnonymous: r.is_anonymous,
    totalAmount: r.transactions ? Number(r.transactions.total_amount) : undefined,
    citizenPaidAmount: r.transactions ? Number(r.transactions.citizen_paid_amount) : undefined,
    transactionDate: r.transactions ? r.transactions.created_at.toISOString() : undefined,
    createdAt: r.created_at.toISOString(),
  }));
};

/**
 * ดึงรายการรีวิวและสถิติคะแนนของร้านค้า (Public)
 */
export const getMerchantReviews = async (
  merchantId: string,
  page = 1,
  limit = 10,
  prismaClient: any = prisma
): Promise<MerchantReviewsResult> => {
  const merchant = await prismaClient.merchants.findUnique({
    where: { merchant_id: merchantId },
    select: {
      merchant_id: true,
      shop_name: true,
      average_rating_stars: true,
    },
  });

  if (!merchant) {
    throw new ReviewServiceError('ไม่พบข้อมูลร้านค้าในระบบ', 404);
  }

  const skip = (page - 1) * limit;
  const allRatingStars = await prismaClient.reviews.findMany({
    where: { merchant_id: merchantId },
    select: { rating_stars: true },
  });

  const totalItems = allRatingStars.length;
  const ratingBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of allRatingStars) {
    if (ratingBreakdown[r.rating_stars] !== undefined) {
      ratingBreakdown[r.rating_stars]++;
    }
  }

  const reviews = await prismaClient.reviews.findMany({
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
    reviews: reviews.map((r: any) => ({
      reviewId: r.review_id,
      ratingStars: r.rating_stars,
      reviewText: r.review_text,
      isVerifiedPurchase: r.is_verified_purchase,
      reviewerName: r.is_anonymous ? 'ผู้ใช้งานไม่ประสงค์ออกนาม' : maskName(r.users?.full_name || ''),
      createdAt: r.created_at.toISOString(),
    })),
  };
};

export const reviewService = {
  submitReview: createReview,
  getReviewByTransactionId,
  getUserReviews,
  getMerchantReviews,
};
