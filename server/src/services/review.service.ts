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

export interface CreateReviewInput {
  transactionId: string;
  ratingStars: number;
  reviewText?: string | null;
}

/**
 * Creates one review for the caller's own completed transaction inside the
 * existing 24-hour review window, then evaluates Badge progress.
 */
export const createReview = async (userId: string, input: CreateReviewInput) => {
  const transaction = await prisma.transactions.findUnique({
    where: { transaction_id: input.transactionId },
    select: {
      transaction_id: true,
      user_id: true,
      merchant_id: true,
      status: true,
      created_at: true,
      reviews: { select: { review_id: true } },
    },
  });

  if (!transaction || transaction.user_id !== userId) {
    throw new ReviewServiceError('Transaction not found', 404);
  }
  if (!REVIEWABLE_STATUSES.includes(transaction.status)) {
    throw new ReviewServiceError('This transaction cannot be reviewed', 409);
  }
  if (Date.now() - transaction.created_at.getTime() > REVIEW_WINDOW_MS) {
    throw new ReviewServiceError('The review window for this transaction has closed', 409);
  }
  if (transaction.reviews) {
    throw new ReviewServiceError('This transaction has already been reviewed', 409);
  }

  let review;
  try {
    review = await prisma.reviews.create({
      data: {
        transaction_id: transaction.transaction_id,
        user_id: userId,
        merchant_id: transaction.merchant_id,
        rating_stars: input.ratingStars,
        review_text: input.reviewText ?? null,
        is_verified_purchase: true,
      },
    });
  } catch (error: any) {
    // The unique key on transaction_id is the real duplicate guard under concurrency.
    if (error?.code === 'P2002') {
      throw new ReviewServiceError('This transaction has already been reviewed', 409);
    }
    throw error;
  }

  // Post-commit: never fails the review because of gamification.
  await awardAfterActivity(userId, ['review_count'], 'review creation');

  return {
    reviewId: review.review_id,
    transactionId: review.transaction_id,
    merchantId: review.merchant_id,
    ratingStars: review.rating_stars,
    reviewText: review.review_text,
    createdAt: review.created_at.toISOString(),
  };
};
