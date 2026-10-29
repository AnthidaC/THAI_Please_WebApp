import api from '../lib/axios';
import { ApiResponse } from '../types';

export interface EligibleMerchant {
  merchantId: string;
  shopName: string;
  categoryNameTh?: string | null;
  lastPaymentAt: string;
  totalSuccessfulPayments: number;
  isCredited?: boolean;
}

export interface MyReferralCode {
  referralId: string;
  referralCode: string;
  discountAmount: number;
  shareUrl: string;
  status: 'pending' | 'redeemed' | 'expired';
  merchantId: string;
  shopName: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface ReferralFriendItem {
  referralId: string;
  referralCode: string;
  friendName: string;
  status: 'pending' | 'redeemed' | 'expired';
  discountAmount: number;
  merchantId: string | null;
  merchantName: string | null;
  invitedAt: string;
  redeemedAt: string | null;
}

export interface EarnedCouponItem {
  userRewardId: string;
  rewardCode: string;
  rewardName: string;
  discountValue: number;
  status: string;
  earnedAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  rewardType: 'REFEREE_WELCOME_10' | 'REFERRER_MILESTONE_40';
}

export interface ReferralStatsSummary {
  totalInvited: number;
  totalRedeemed: number;
  totalPending: number;
  totalSuccessfulMerchants?: number;
  milestonesCompleted: number;
  currentMilestoneProgress: number; // 0..4
  milestoneTarget: number; // 5
  merchantsNeededForNextMilestone?: number;
  friendsNeededForNextMilestone: number;
  totalMilestoneCouponsEarned: number;
}

export interface ReferralStatsResult {
  merchantId: string | null;
  merchantName: string | null;
  activeReferralCode: string | null;
  shareUrl: string | null;
  isUserReferredAtThisMerchant?: boolean;
  isMerchantCredited?: boolean;
  summary: ReferralStatsSummary;
  invitedFriends: ReferralFriendItem[];
  earnedCoupons: EarnedCouponItem[];
}

export interface ReferralValidationState {
  code: string;
  isValid: boolean | null;
  referrerName?: string;
  discountAmount?: number;
  merchantId?: string;
  shopName?: string;
  sourceDescription?: string;
  errorMessage?: string;
}

export const referralApi = {
  /**
   * ดึงรายการร้านค้าที่ผู้ใช้เคยชำระเงินสำเร็จ (Eligible Merchants)
   */
  async getEligibleMerchants(): Promise<EligibleMerchant[]> {
    const response = await api.get<ApiResponse<EligibleMerchant[]>>('/referrals/eligible-merchants');
    return response.data.data;
  },

  /**
   * ดึงหรือสร้างรหัสแนะนำเพื่อนสำหรับร้านค้าที่เลือก
   */
  async getMyReferralCode(merchantId?: string, customCode?: string): Promise<MyReferralCode> {
    const params: Record<string, string> = {};
    if (merchantId) params.merchantId = merchantId;
    if (customCode) params.customCode = customCode;

    const response = await api.get<ApiResponse<MyReferralCode>>('/referrals/my-code', { params });
    return response.data.data;
  },

  /**
   * ดึงสถิติคำชวนเพื่อน ไมล์สโตน และรายการเพื่อน
   */
  async getReferralStats(merchantId?: string): Promise<ReferralStatsResult> {
    const params: Record<string, string> = {};
    if (merchantId) params.merchantId = merchantId;

    const response = await api.get<ApiResponse<ReferralStatsResult>>('/referrals/stats', { params });
    return response.data.data;
  },

  /**
   * ตรวจสอบรหัสแนะนำเพื่อน (Validation Tool)
   */
  async validateReferralCode(code: string, merchantId?: string): Promise<{
    referralCode: string;
    isValid: boolean;
    discountAmount: number;
    referrerName: string;
    merchantId: string;
    shopName: string;
    sourceDescription: string;
  }> {
    const params: Record<string, string> = {};
    if (merchantId) params.merchantId = merchantId;

    const response = await api.get<ApiResponse<any>>(`/referrals/validate/${encodeURIComponent(code)}`, { params });
    return response.data.data;
  },
};
