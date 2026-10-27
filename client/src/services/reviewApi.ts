import api from '../lib/axios';
import { ApiResponse } from '../types';

/**
 * ข้อมูลรีวิวรายบุคคลของร้านค้า (Review Item DTO)
 */
export interface MerchantReviewItem {
  reviewId: string;
  ratingStars: number;
  reviewText: string | null;
  isVerifiedPurchase: boolean;
  reviewerName: string;
  createdAt: string;
}

/**
 * ข้อมูลสรุปและรายการรีวิวของร้านค้าจาก Backend
 */
export interface MerchantReviewsData {
  merchant: {
    merchantId: string;
    shopName: string;
    averageRating: number;
    totalReviews: number;
  };
  ratingBreakdown: Record<number, number>;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
  reviews: MerchantReviewItem[];
}

/**
 * DTO สำหรับส่งรีวิวร้านค้า (Create Review Payload)
 */
export interface CreateReviewPayload {
  transactionId: string;
  ratingStars: number;
  reviewText?: string | null;
}

/**
 * ผลลัพธ์ตอบกลับเมื่อบันทึกรีวิวสำเร็จจาก Backend
 */
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

/**
 * DTO สำหรับผลการตรวจสอบการประเมินรีวิวของธุรกรรม
 */
export interface ExistingReviewItem {
  reviewId: string;
  transactionId: string;
  merchantId: string;
  merchantName: string;
  ratingStars: number;
  reviewText: string | null;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

export interface TransactionReviewCheckResult {
  reviewed: boolean;
  review: ExistingReviewItem | null;
}

/**
 * DTO สำหรับประวัติการประเมินรีวิวของผู้ใช้งาน
 */
export interface UserReviewHistoryItem {
  reviewId: string;
  transactionId: string;
  merchantId: string;
  merchantName: string;
  merchantAverageRating?: number;
  ratingStars: number;
  reviewText: string | null;
  isVerifiedPurchase: boolean;
  totalAmount?: number;
  citizenPaidAmount?: number;
  transactionDate?: string;
  createdAt: string;
}

/**
 * API Service สำหรับระบบรีวิวและข้อมูลสถิติร้านค้า
 */
export const reviewApi = {
  /**
   * ตรวจสอบและดึงข้อมูลการประเมินรีวิวของธุรกรรม (Authenticated)
   * GET /api/reviews/transaction/:transactionId
   */
  getReviewByTransaction: async (
    transactionId: string
  ): Promise<TransactionReviewCheckResult> => {
    const response = await api.get<ApiResponse<TransactionReviewCheckResult>>(
      `/reviews/transaction/${transactionId}`
    );
    return response.data.data;
  },

  /**
   * ส่งรีวิวร้านค้าหลังการซื้อสินค้าจริง (Authenticated)
   * POST /api/reviews
   */
  submitReview: async (payload: CreateReviewPayload): Promise<ReviewSubmissionResult> => {
    const response = await api.post<ApiResponse<ReviewSubmissionResult>>('/reviews', payload);
    return response.data.data;
  },

  /**
   * ดึงรายการประวัติการรีวิวทั้งหมดของผู้ใช้งานปัจจุบัน (Authenticated)
   * GET /api/reviews/my-reviews
   */
  getMyReviews: async (): Promise<UserReviewHistoryItem[]> => {
    const response = await api.get<ApiResponse<UserReviewHistoryItem[]>>('/reviews/my-reviews');
    return response.data.data;
  },

  /**
   * ดึงรายการรีวิวและสถิติคะแนนของร้านค้า (Public / Authenticated)
   * GET /api/reviews/merchant/:merchantId
   */
  getMerchantReviews: async (
    merchantId: string,
    page = 1,
    limit = 10
  ): Promise<MerchantReviewsData> => {
    const response = await api.get<ApiResponse<MerchantReviewsData>>(
      `/reviews/merchant/${merchantId}`,
      {
        params: { page, limit },
      }
    );
    return response.data.data;
  },
};

export default reviewApi;
