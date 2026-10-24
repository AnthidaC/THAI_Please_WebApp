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
 * API Service สำหรับระบบรีวิวและข้อมูลสถิติร้านค้า
 */
export const reviewApi = {
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
