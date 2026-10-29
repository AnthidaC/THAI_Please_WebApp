import axios from '../lib/axios';

export interface MonthlyCycleInfo {
  currentMonthName: string;
  validUntilDate?: string;
  nextQuotaDate?: string;
  cumulativeToMonthLabel?: string;
  monthlyAllocationAmount?: number;
}

export interface AvailableCampaignInfo {
  campaignId: string;
  campaignName: string;
  governmentCopayRatePercent: number;
  citizenPaymentRatePercent: number;
  dailyQuotaLimit: number;
  totalQuotaLimit: number;
  startDate: string;
  endDate: string;
  status: string;
  isRegistrationOpen: boolean;
  periodCount: number;
  configuredPeriodQuota: number;
}

export interface WalletCampaignPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  quotaLimit: number;
  quotaUsed: number;
  quotaRemaining: number;
}

export interface WalletPeriodQuotaInfo {
  enabled: boolean;
  status: 'ACTIVE' | 'BEFORE_FIRST' | 'BETWEEN_PERIODS' | 'AFTER_LAST' | 'ALLOCATION_MISSING' | 'INVALID_OVERLAP' | 'NOT_CONFIGURED';
  currentPeriod: WalletCampaignPeriod | null;
  nextPeriod: WalletCampaignPeriod | null;
}

export interface WalletData {
  walletId: string;
  userId: string;
  balance: number;
  dailyQuotaLimit: number;
  dailyQuotaUsed: number;
  dailyQuotaRemaining: number;
  totalQuotaRemaining: number;
  eligibilityStatus: string;
  status: string;
  lastQuotaResetDate: string;
  monthlyCycle?: MonthlyCycleInfo;
  periodQuota: WalletPeriodQuotaInfo;
  campaignInfo?: {
    campaignId: string;
    campaignName: string;
    startDate: string;
    endDate: string;
    dailyLimit: number;
    totalLimit: number;
    isStarted: boolean;
    isExpired: boolean;
    isActive: boolean;
  } | null;
  availableCampaignForRegistration?: AvailableCampaignInfo | null;
}

export interface DynamicQrResponse {
  qrReference: string;
  merchantId: string;
  shopName: string;
  totalAmount: number;
  merchantLatitude: number;
  merchantLongitude: number;
  createdAt: string;
  expiresAt: string;
  estimatedGovCopay: number;
  estimatedCitizenPay: number;
}

export interface DiscountValidationResult {
  code: string;
  isValid: boolean;
  discountAmount: number;
  discountType: 'FIXED' | 'PERCENT';
  discountSource: 'FRIEND_REFERRAL' | 'COUPON' | 'DEMO_PROMO';
  sourceDescription: string;
  referrerName?: string;
  referralId?: string;
  userRewardId?: string;
}

export interface CopayPreviewData {
  qrData: DynamicQrResponse;
  walletInfo?: WalletData;
  copaySplit?: {
    originalTotalAmount?: number;
    discountAmount?: number;
    discountCode?: string;
    discountDescription?: string;
    netTotalAmount?: number;
    totalAmount: number;
    governmentCopayAmount: number;
    citizenPaidAmount: number;
    governmentPercentage: number;
    citizenPercentage: number;
    totalSavingsAmount?: number;
    dailyQuotaRemainingBefore: number;
    dailyQuotaRemainingAfter: number;
  };
  discountInfo?: DiscountValidationResult | null;
}

export interface CheckoutResult {
  transactionId: string;
  qrReference: string;
  shopName: string;
  status: 'SUCCESS' | 'FLAGGED' | 'REJECTED';
  originalTotalAmount?: number;
  discountAmount?: number;
  discountCode?: string;
  discountDescription?: string;
  netTotalAmount?: number;
  totalAmount: number;
  governmentCopayAmount: number;
  citizenPaidAmount: number;
  totalSavingsAmount?: number;
  completedAt: string;
  distanceMeters: number;
  riskScore: number;
  fraudDecision: string;
  fraudReason: string;
  reviewEligible: boolean;
  reviewWindowExpiresAt: string;
}

export interface TransactionItem {
  transactionId: string;
  qrReference?: string;
  merchantId: string;
  shopName: string;
  merchantRating: number;
  totalAmount: number;
  governmentCopayAmount: number;
  citizenPaidAmount: number;
  status: string;
  transactionType?: 'COPAY' | 'TOPUP' | 'REFUND';
  paymentChannel?: string;
  createdAt: string;
  completedAt?: string;
  isEligibleForReview: boolean;
  hasReview: boolean;
  reviewExpiresAt: string;
}

export interface QrPaymentStatusResponse {
  qrReference: string;
  status: 'ACTIVE' | 'USED' | 'SUSPENDED' | 'EXPIRED' | 'REJECTED' | 'SCANNED';
  shopName?: string;
  totalAmount?: number;
  expiresAt?: string;
  scannedAt?: string | null;
  isScanned?: boolean;
  paidTransaction?: {
    transactionId: string;
    customerName: string;
    totalAmount: number;
    governmentCopayAmount: number;
    citizenPaidAmount: number;
    completedAt: string;
  } | null;
}

export interface MerchantSalesSummary {
  merchant: {
    merchantId: string;
    shopName: string;
    taxId: string;
    averageRatingStars: number;
    latitude: number;
    longitude: number;
  } | null;
  summary: {
    totalRevenue: number;
    governmentSubsidyTotal: number;
    citizenPaidTotal: number;
    totalTransactions: number;
  };
  transactions: Array<{
    transactionId: string;
    qrReference: string;
    customerName: string;
    totalAmount: number;
    governmentCopayAmount: number;
    citizenPaidAmount: number;
    status: string;
    createdAt: string;
    fraudReason?: string | null;
    distanceMeters?: number | null;
  }>;
}

export type FraudResolveAction = 'APPROVE' | 'REJECT' | 'SUSPEND_MERCHANT' | 'SUSPEND_USER';

export type DossierResolveAction = 'APPROVE_ALL' | 'REJECT_ALL' | 'SUSPEND_USER' | 'SUSPEND_MERCHANT';

export interface UserFraudDossier {
  userId: string;
  customerName: string;
  provinceCode: string;
  walletStatus: string;
  flaggedCount: number;
  totalAmount: number;
  governmentCopayAtRisk: number;
  citizenPaidTotal: number;
  averageRiskScore: number;
  maxRiskScore: number;
  primaryRiskPattern: string;
  aiCaseSummary: string;
  isActionable: boolean;
  latestActivityAt: string;
  merchantsInvolved: Array<{
    merchantId: string;
    shopName: string;
    transactionCount: number;
  }>;
  transactions: FraudAlertItem[];
}

export interface MerchantFraudDossier {
  merchantId: string;
  shopName: string;
  merchantTaxId: string;
  isMerchantApproved: boolean;
  flaggedCount: number;
  totalAmount: number;
  governmentCopayAtRisk: number;
  averageRiskScore: number;
  maxRiskScore: number;
  primaryRiskPattern: string;
  aiCaseSummary: string;
  isActionable: boolean;
  latestActivityAt: string;
  uniqueCustomersCount: number;
  transactions: FraudAlertItem[];
}

export interface FraudDossierResponse {
  summary: {
    totalPendingChecks: number;
    actionableUserDossiersCount: number;
    actionableMerchantDossiersCount: number;
    suppressedNoiseCount: number;
    totalGovernmentAtRisk: number;
  };
  userDossiers: UserFraudDossier[];
  merchantDossiers: MerchantFraudDossier[];
}

export interface FraudAlertItem {
  fraudCheckId: string;
  transactionId: string;
  userId?: string;
  merchantId?: string;
  merchantTaxId?: string;
  isMerchantApproved?: boolean;
  userWalletStatus?: string;
  totalAmount: number;
  copayAmount: number;
  citizenPaidAmount: number;
  customerName: string;
  shopName: string;
  distanceMeters: number;
  riskScore: number;
  fraudReason: string;
  decision: string;
  userLat: number;
  userLon: number;
  merchantLat: number;
  merchantLon: number;
  createdAt: string;
  repeatCount?: number;
  systemStats?: {
    totalChecksCount: number;
    autoApprovedCount: number;
    approvalRate: number;
  };
}

export interface SlipData {
  slipId: string;
  transactionId: string;
  qrReference: string;
  customerName: string;
  shopName: string;
  merchantTaxId: string;
  originalTotalAmount?: number;
  discountAmount?: number;
  discountCode?: string | null;
  discountDescription?: string | null;
  netTotalAmount?: number;
  totalAmount: number;
  governmentCopayAmount: number;
  citizenPaidAmount: number;
  totalSavingsAmount?: number;
  copayRatio: string;
  status: string;
  timestamp: string;
  securityVerification: {
    verifiedBy: string;
    isGpsVerified: boolean;
    distanceMeters: number;
    riskScore: number;
    decision: string;
  };
}

// 1. กระเป๋าเงิน (Wallet)
export const getWalletBalance = async (): Promise<WalletData> => {
  const res = await axios.get('/wallet/balance');
  return res.data.data;
};

export const getPaymentPinStatus = async (): Promise<{ isSet: boolean; lockedUntil: string | null }> => {
  const res = await axios.get('/wallet/pin/status');
  return res.data.data;
};

export const setPaymentPin = async (payload: { pin: string; confirmPin: string; currentPin?: string }) => {
  const res = await axios.put('/wallet/pin', payload);
  return res.data.data;
};

/** Forgot PIN: server accepts only a freshly signed-in session (code REAUTH_REQUIRED otherwise). */
export const resetPaymentPin = async (payload: { pin: string; confirmPin: string }) => {
  const res = await axios.post('/wallet/pin/reset', payload);
  return res.data.data;
};

export const topUpWallet = async (amount: number, paymentChannel = 'PROMPTPAY') => {
  const res = await axios.post('/wallet/top-up', { amount, paymentChannel });
  return res.data.data;
};

export const enrollInCampaign = async (campaignId?: string) => {
  const res = await axios.post('/wallet/enroll', { campaignId });
  return res.data.data;
};

// 2. ระบบชำระเงินและคิวอาร์โค้ด (Payment & QR)
export const generateDynamicQr = async (payload: {
  amount: number;
  latitude: number;
  longitude: number;
  shopName?: string;
  merchantId?: string;
}): Promise<DynamicQrResponse> => {
  const res = await axios.post('/payment/qr/generate', payload);
  return res.data.data;
};

export const getQrPaymentStatus = async (
  reference: string
): Promise<QrPaymentStatusResponse> => {
  const res = await axios.get(`/payment/qr/${reference}/status`);
  return res.data.data;
};

export interface MerchantStreamEvent {
  type: 'CONNECTED' | 'PAYMENT_RECEIVED' | 'QR_SCANNED';
  merchantId?: string;
  qrReference?: string;
  status?: string;
  expiresAt?: string;
  scannedAt?: string;
  totalAmount?: number;
  paidTransaction?: {
    transactionId: string;
    customerName: string;
    totalAmount: number;
    governmentCopayAmount: number;
    citizenPaidAmount: number;
    completedAt: string;
  };
}

/** Fetch streaming supports Bearer auth, unlike the browser's native EventSource. */
export const streamQrPaymentStatus = async (
  reference: string,
  onStatus: (status: QrPaymentStatusResponse) => void,
  signal: AbortSignal
) => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(axios.getUri({ url: `/payment/qr/${encodeURIComponent(reference)}/stream` }), {
    headers: token ? { Authorization: `Bearer ${token}` } : {}, signal,
  });
  if (!response.ok || !response.body) throw new Error('Unable to stream payment status');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const data = event.split('\n').find(line => line.startsWith('data: '));
        if (data) onStatus(JSON.parse(data.slice(6)));
      }
    }
  } finally { reader.releaseLock(); }
};

/**
 * Server-Sent Events (SSE) ระดับร้านค้าทั้งระบบ
 * ติดตามเงินเข้าและสถานะสแกน QR แบบต่อเนื่อง ไม่ว่าจะเปิดอยู่หน้าจอใด หรือกำลังสร้างบิลถัดไป
 */
export const streamMerchantPayments = async (
  onEvent: (event: MerchantStreamEvent) => void,
  signal: AbortSignal
) => {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(axios.getUri({ url: '/payment/merchant/stream' }), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!response.ok || !response.body) throw new Error('Unable to stream merchant payments');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = event.split('\n').find((line) => line.startsWith('data: '));
        if (data) {
          try {
            onEvent(JSON.parse(data.slice(6)));
          } catch {
            // ignore malformed frame
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
};

export const getQrDetails = async (
  reference: string,
  discountCode?: string,
  userLocation?: { lat: number; lon: number }
): Promise<CopayPreviewData> => {
  const res = await axios.get(`/payment/qr/${reference}`, {
    params: {
      ...(discountCode ? { discountCode } : {}),
      ...(userLocation
        ? { userLatitude: userLocation.lat, userLongitude: userLocation.lon }
        : {}),
    },
  });
  return res.data.data;
};

export const validateDiscountCode = async (params: {
  code: string;
  totalAmount: number;
  merchantId?: string;
}): Promise<DiscountValidationResult> => {
  const res = await axios.post('/payment/discount/validate', params);
  return res.data.data;
};

export const checkoutCopay = async (payload: {
  qrReference: string;
  userLatitude: number;
  userLongitude: number;
  merchantId?: string;
  pin: string;
  discountCode?: string;
}): Promise<CheckoutResult> => {
  const res = await axios.post('/payment/qr/checkout', payload);
  return res.data.data;
};

// 3. ประวัติธุรกรรม (Transactions)
export const getBuyerHistory = async (): Promise<TransactionItem[]> => {
  const res = await axios.get('/transactions/buyer/history');
  return res.data.data;
};

export const getMerchantHistory = async (merchantId?: string, date?: string): Promise<MerchantSalesSummary> => {
  const res = await axios.get('/transactions/merchant/history', {
    params: { ...(merchantId ? { merchantId } : {}), ...(date ? { date } : {}) },
  });
  return res.data.data;
};

export const getTransactionSlip = async (id: string): Promise<SlipData> => {
  const res = await axios.get(`/transactions/${id}/slip`);
  return res.data.data;
};

// 3.1 รีวิวร้านค้าหลังชำระเงิน (บันทึกแล้วประเมินตราความสำเร็จฝั่งเซิร์ฟเวอร์)
export const createReview = async (payload: {
  transactionId: string;
  ratingStars: number;
  reviewText?: string;
}): Promise<void> => {
  await axios.post('/reviews', payload);
};

// 4. ระบบตรวจจับทุจริตสำหรับ Admin (Fraud Alerts & User Dossiers)
export const getFraudDossiers = async (includeNoise: boolean = false): Promise<FraudDossierResponse> => {
  const res = await axios.get('/fraud/dossiers', {
    params: { includeNoise },
  });
  return res.data.data;
};

export const resolveFraudDossier = async (params: {
  targetType: 'USER' | 'MERCHANT';
  targetId: string;
  action: DossierResolveAction;
  note?: string;
}) => {
  const res = await axios.post('/fraud/dossier/resolve', params);
  return res.data.data;
};

export const getFraudAlerts = async (): Promise<FraudAlertItem[]> => {
  const res = await axios.get('/fraud/alerts');
  return res.data.data;
};

export const resolveFraudAlert = async (
  id: string,
  action: FraudResolveAction,
  note?: string
) => {
  const res = await axios.post(`/fraud/resolve/${id}`, { action, note });
  return res.data.data;
};

