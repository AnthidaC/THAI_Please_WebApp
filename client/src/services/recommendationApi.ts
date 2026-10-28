import api from '../lib/axios';
import { ApiResponse } from '../types';

/**
 * ข้อมูลร้านค้าแนะนำจากระบบ AI (Recommended Merchant Result DTO)
 */
export interface RecommendedMerchantItem {
  merchantId: string;
  shopName: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  formattedDistance: string;
  averageRating: number;
  transactionCount24h: number;
  baseScore: number;
  finalScore: number;
  recommendationReason: string;
  isAiEnhanced: boolean;
  recommendationId?: string;
  scoreBreakdown?: {
    distanceScore?: number;
    popularityScore?: number;
    ratingScore?: number;
    categoryScore?: number;
  };
}

/**
 * โครงสร้างข้อมูลตอบกลับจากระบบแนะนำร้านค้า
 */
export interface RecommendationResultData {
  totalCandidatesFound: number;
  provider: 'gemini' | 'openai' | 'rule_based_fallback';
  isFallback: boolean;
  latencyMs: number;
  recommendations: RecommendedMerchantItem[];
}

/**
 * พารามิเตอร์สำหรับค้นหาร้านค้าแนะนำรอบตัว
 */
export interface GetRecommendationsParams {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  limit?: number;
}

/**
 * ผลลัพธ์การบันทึกสถิติการคลิก
 */
export interface RecordClickResponse {
  recommendationId: string;
  isClicked: boolean;
  alreadyClicked: boolean;
  recordedAt: string;
}

/**
 * Service API สำหรับ Developer 3 AI Discovery & Recommendation
 */
export const recommendationApi = {
  /**
   * ค้นหาและแนะนำร้านค้ารอบตัว (AI Near-Me Discovery)
   * GET /api/recommendations/near-me
   * รองรับทั้ง Guest และ Authenticated Citizen
   */
  getNearMe: async (params: GetRecommendationsParams): Promise<RecommendationResultData> => {
    const response = await api.get<ApiResponse<RecommendationResultData>>('/recommendations/near-me', {
      params,
    });
    return response.data.data;
  },

  /**
   * บันทึกสถิติการคลิกการ์ดคำแนะนำร้านค้า (Recommendation Click Tracking)
   * POST /api/recommendations/:recommendationId/click
   * ใช้ fetch แยกส่วนเพื่อป้องกันไม่ให้ข้อผิดพลาด (เช่น 401) ไปกระตุ้น Axios Interceptor ที่จะลบ auth_token ใน localStorage
   */
  recordClick: async (recommendationId: string): Promise<RecordClickResponse | null> => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const baseUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await fetch(`${baseUrl}/recommendations/${recommendationId}/click`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        return null;
      }

      const json: ApiResponse<RecordClickResponse> = await response.json();
      return json.data;
    } catch (err) {
      console.warn('[ClickTelemetry] Silent telemetry recording error:', err);
      return null;
    }
  },
};

export default recommendationApi;
