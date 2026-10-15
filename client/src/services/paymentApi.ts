import axios from '../lib/axios';

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

export interface CopayPreviewData {
  qrData: DynamicQrResponse;
  walletInfo?: WalletData;
  copaySplit?: {
    totalAmount: number;
    governmentCopayAmount: number;
    citizenPaidAmount: number;
    governmentPercentage: number;
    citizenPercentage: number;
    dailyQuotaRemainingBefore: number;
    dailyQuotaRemainingAfter: number;
  };
}

export interface CheckoutResult {
  transactionId: string;
  qrReference: string;
  shopName: string;
  status: 'SUCCESS' | 'FLAGGED' | 'REJECTED';
  totalAmount: number;
  governmentCopayAmount: number;
  citizenPaidAmount: number;
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
  createdAt: string;
  completedAt?: string;
  isEligibleForReview: boolean;
  hasReview: boolean;
  reviewExpiresAt: string;
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
  }>;
}

export interface FraudAlertItem {
  fraudCheckId: string;
  transactionId: string;
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
}

export interface SlipData {
  slipId: string;
  transactionId: string;
  qrReference: string;
  customerName: string;
  shopName: string;
  merchantTaxId: string;
  totalAmount: number;
  governmentCopayAmount: number;
  citizenPaidAmount: number;
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

export const topUpWallet = async (amount: number, paymentChannel = 'PROMPTPAY') => {
  const res = await axios.post('/wallet/top-up', { amount, paymentChannel });
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

export const getQrDetails = async (reference: string): Promise<CopayPreviewData> => {
  const res = await axios.get(`/payment/qr/${reference}`);
  return res.data.data;
};

export const checkoutCopay = async (payload: {
  qrReference: string;
  userLatitude: number;
  userLongitude: number;
  merchantId?: string;
  pin?: string;
}): Promise<CheckoutResult> => {
  const res = await axios.post('/payment/qr/checkout', payload);
  return res.data.data;
};

// 3. ประวัติธุรกรรม (Transactions)
export const getBuyerHistory = async (): Promise<TransactionItem[]> => {
  const res = await axios.get('/transactions/buyer/history');
  return res.data.data;
};

export const getMerchantHistory = async (merchantId?: string): Promise<MerchantSalesSummary> => {
  const res = await axios.get('/transactions/merchant/history', {
    params: merchantId ? { merchantId } : {},
  });
  return res.data.data;
};

export const getTransactionSlip = async (id: string): Promise<SlipData> => {
  const res = await axios.get(`/transactions/${id}/slip`);
  return res.data.data;
};

// 4. ระบบตรวจจับทุจริตสำหรับ Admin (Fraud Alerts)
export const getFraudAlerts = async (): Promise<FraudAlertItem[]> => {
  const res = await axios.get('/fraud/alerts');
  return res.data.data;
};

export const resolveFraudAlert = async (id: string, action: 'APPROVE' | 'REJECT', note?: string) => {
  const res = await axios.post(`/fraud/resolve/${id}`, { action, note });
  return res.data.data;
};
