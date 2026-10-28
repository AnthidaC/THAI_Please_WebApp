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
  input: CreateReviewInput
): Promise<ReviewSubmissionResult> => {
  const transaction = await prisma.transactions.findUnique({
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
  if (!REVIEWABLE_STATUSES.includes(transaction.status)) {
    throw new ReviewServiceError('สามารถประเมินรีวิวได้เฉพาะธุรกรรมที่ชำระเงินสำเร็จเท่านั้น', 400);
  }
  if (Date.now() - new Date(transaction.created_at).getTime() > REVIEW_WINDOW_MS) {
    throw new ReviewServiceError(
      'สิทธิ์การประเมินรีวิวหมดอายุแล้ว (สามารถรีวิวได้ภายใน 24 ชม. หลังทำรายการ)',
      400
    );
  }
  if (transaction.reviews) {
    throw new ReviewServiceError('ธุรกรรมนี้ได้รับการประเมินรีวิวไปแล้ว', 409);
  }

  let result: ReviewSubmissionResult;
  try {
    result = await prisma.$transaction(async (txPrisma) => {
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
  await awardAfterActivity(userId, ['review_count'], 'review creation');

  return result;
};

/**
 * ดึงข้อมูลการประเมินรีวิวของธุรกรรมเฉพาะราย (Authenticated)
 */
export const getReviewByTransactionId = async (userId: string, transactionId: string) => {
  const review = await prisma.reviews.findUnique({
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
    return { reviewed: false, review: null };
  }

  if (review.user_id !== userId) {
    throw new ReviewServiceError('ไม่มีสิทธิ์เข้าถึงข้อมูลรีวิวของธุรกรรมผู้อื่น', 403);
  }

  return {
    reviewed: true,
    review: {
      reviewId: review.review_id,
      transactionId: review.transaction_id,
      merchantId: review.merchant_id,
      merchantName: review.merchants.shop_name,
      ratingStars: review.rating_stars,
      reviewText: review.review_text,
      isVerifiedPurchase: review.is_verified_purchase,
      createdAt: review.created_at.toISOString(),
    },
  };
};

/**
 * ดึงประวัติการประเมินรีวิวทั้งหมดของผู้ใช้งานปัจจุบัน (Authenticated)
 */
export const getUserReviews = async (userId: string) => {
  const reviews = await prisma.reviews.findMany({
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

  return reviews.map((r) => ({
    reviewId: r.review_id,
    transactionId: r.transaction_id,
    merchantId: r.merchant_id,
    merchantName: r.merchants.shop_name,
    merchantAverageRating: Number(r.merchants.average_rating_stars),
    ratingStars: r.rating_stars,
    reviewText: r.review_text,
    isVerifiedPurchase: r.is_verified_purchase,
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
  limit = 10
): Promise<MerchantReviewsResult> => {
  const merchant = await prisma.merchants.findUnique({
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
  const allRatingStars = await prisma.reviews.findMany({
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
      reviewerName: maskName(r.users.full_name),
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
