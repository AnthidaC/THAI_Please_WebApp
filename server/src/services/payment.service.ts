import prisma from '../utils/prisma';
import { walletService } from './wallet.service';
import { fraudService } from './fraud.service';

export interface CopayCalculationResult {
  totalAmount: number;
  governmentCopayAmount: number;
  citizenPaidAmount: number;
  governmentPercentage: number;
  citizenPercentage: number;
  dailyQuotaRemainingBefore: number;
  dailyQuotaRemainingAfter: number;
  totalQuotaRemainingBefore: number;
  totalQuotaRemainingAfter: number;
}

export interface DynamicQrData {
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

// In-memory cache สำหรับเก็บ Dynamic QR ชั่วคราว (มีอายุ 15 นาที) ควบคู่กับฐานข้อมูล
const qrStore = new Map<string, DynamicQrData>();

export class PaymentService {
  /**
   * คำนวณยอด Co-pay 60/40 ตามสูตรและเพดานสิทธิ์
   */
  public calculateCopay(
    totalAmount: number,
    dailyQuotaRemaining: number,
    totalQuotaRemaining: number
  ): CopayCalculationResult {
    const tentativeGovCopay = Math.round(totalAmount * 0.6 * 100) / 100;
    const maxGovAllowable = Math.max(
      0,
      Math.min(tentativeGovCopay, dailyQuotaRemaining, totalQuotaRemaining)
    );
    const governmentCopayAmount = Math.round(maxGovAllowable * 100) / 100;
    const citizenPaidAmount = Math.round((totalAmount - governmentCopayAmount) * 100) / 100;

    const governmentPercentage =
      totalAmount > 0 ? Math.round((governmentCopayAmount / totalAmount) * 100) : 0;
    const citizenPercentage = 100 - governmentPercentage;

    return {
      totalAmount,
      governmentCopayAmount,
      citizenPaidAmount,
      governmentPercentage,
      citizenPercentage,
      dailyQuotaRemainingBefore: dailyQuotaRemaining,
      dailyQuotaRemainingAfter:
        Math.round((dailyQuotaRemaining - governmentCopayAmount) * 100) / 100,
      totalQuotaRemainingBefore: totalQuotaRemaining,
      totalQuotaRemainingAfter:
        Math.round((totalQuotaRemaining - governmentCopayAmount) * 100) / 100,
    };
  }

  /**
   * ร้านค้าสร้าง Dynamic QR Code ระบุยอดเงินและพิกัด GPS
   */
  public async generateDynamicQr(params: {
    merchantId?: string;
    amount: number;
    latitude: number;
    longitude: number;
    shopName?: string;
  }): Promise<DynamicQrData> {
    let merchantId = params.merchantId;
    let shopName = params.shopName || 'ร้านค้าประชารัฐร่วมใจ';

    // ถ้าไม่มี merchantId หรือส่งมาว่าง ให้ค้นหาหรือสร้างร้านค้าตัวอย่าง
    if (!merchantId) {
      const existingMerchant = await prisma.merchants.findFirst();
      if (existingMerchant) {
        merchantId = existingMerchant.merchant_id;
        shopName = existingMerchant.shop_name;
      } else {
        const newMerchant = await prisma.merchants.create({
          data: {
            tax_id: `TAX-${Date.now().toString().slice(-10)}`,
            shop_name: shopName,
            latitude: params.latitude,
            longitude: params.longitude,
            average_rating_stars: 4.8,
            is_approved: true,
          },
        });
        merchantId = newMerchant.merchant_id;
      }
    }

    const qrReference = `TP-QR-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // มีอายุ 15 นาที

    const tentativeGov = Math.min(Math.round(params.amount * 0.6 * 100) / 100, 150.0);
    const tentativeCit = Math.round((params.amount - tentativeGov) * 100) / 100;

    const qrData: DynamicQrData = {
      qrReference,
      merchantId: merchantId || 'sample-merchant-id',
      shopName,
      totalAmount: params.amount,
      merchantLatitude: params.latitude,
      merchantLongitude: params.longitude,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      estimatedGovCopay: tentativeGov,
      estimatedCitizenPay: tentativeCit,
    };

    qrStore.set(qrReference, qrData);

    return qrData;
  }

  /**
   * ดึงข้อมูล QR Code เพื่อพรีวิวยอดชำระเงินร่วม Co-pay 60/40
   */
  public async getQrDetails(qrReference: string, userId?: string) {
    let qrData = qrStore.get(qrReference);

    if (!qrData) {
      // ค้นหาจากฐานข้อมูลธุรกรรมหากมี
      const tx = await prisma.transactions.findFirst({
        where: { qr_reference: qrReference },
        include: { merchants: true },
      });

      if (tx) {
        qrData = {
          qrReference,
          merchantId: tx.merchant_id,
          shopName: tx.merchants.shop_name,
          totalAmount: Number(tx.total_amount),
          merchantLatitude: Number(tx.merchants.latitude),
          merchantLongitude: Number(tx.merchants.longitude),
          createdAt: tx.created_at.toISOString(),
          expiresAt: new Date(tx.created_at.getTime() + 15 * 60 * 1000).toISOString(),
          estimatedGovCopay: Number(tx.government_copay_amount),
          estimatedCitizenPay: Number(tx.citizen_paid_amount),
        };
      } else {
        throw new Error('ไม่พบข้อมูล QR Code นี้ หรือ QR Code อาจหมดอายุแล้ว');
      }
    }

    // หากมี userId คำนวณยอดจริงตามโควตาคงเหลือของผู้ใช้นั้น
    let copaySplit: CopayCalculationResult | null = null;
    let walletInfo = null;

    if (userId) {
      walletInfo = await walletService.getWalletByUserId(userId);
      copaySplit = this.calculateCopay(
        qrData.totalAmount,
        walletInfo.dailyQuotaRemaining,
        walletInfo.totalQuotaRemaining
      );
    }

    return {
      qrData,
      walletInfo,
      copaySplit,
    };
  }

  /**
   * ประชาชนยืนยันชำระเงินร่วม (Co-pay Checkout)
   * พร้อมประเมินพิกัด GPS และส่งวิเคราะห์ Semi-AI Fraud Engine
   */
  public async checkout(params: {
    userId: string;
    qrReference: string;
    userLatitude: number;
    userLongitude: number;
    merchantId?: string;
  }) {
    const { qrData } = await this.getQrDetails(params.qrReference);

    const merchantId = params.merchantId || qrData.merchantId;
    const merchant = await prisma.merchants.findUnique({
      where: { merchant_id: merchantId },
    });

    const merchantLat = merchant ? Number(merchant.latitude) : qrData.merchantLatitude;
    const merchantLon = merchant ? Number(merchant.longitude) : qrData.merchantLongitude;
    const shopName = merchant ? merchant.shop_name : qrData.shopName;

    // 1. ดึงข้อมูลกระเป๋าเงินและคำนวณ Co-pay 60/40
    const wallet = await walletService.getWalletByUserId(params.userId);
    const copay = this.calculateCopay(
      qrData.totalAmount,
      wallet.dailyQuotaRemaining,
      wallet.totalQuotaRemaining
    );

    // ตรวจสอบยอดเงินคงเหลือในกระเป๋า
    if (wallet.balance < copay.citizenPaidAmount) {
      throw new Error(
        `ยอดเงินคงเหลือในกระเป๋าไม่เพียงพอ (ต้องการ ฿${copay.citizenPaidAmount.toFixed(
          2
        )} แต่มี ฿${wallet.balance.toFixed(2)}) กรุณาเติมเงินก่อนทำรายการ`
      );
    }

    // 2. เรียกใช้ระบบตรวจสอบทุจริตพิกัด GPS & Semi-AI Anomaly Engine
    const fraudAssessment = await fraudService.evaluateTransaction({
      userId: params.userId,
      merchantId,
      amount: qrData.totalAmount,
      userLat: params.userLatitude,
      userLon: params.userLongitude,
      merchantLat,
      merchantLon,
    });

    // หากระบบ AI ตัดสินว่าเสี่ยงทุจริตรุนแรง ให้ปฏิเสธรายการทันที
    if (fraudAssessment.decision === 'REJECTED') {
      throw new Error(
        `ระบบปฏิเสธการทำรายการชั่วคราว: ตรวจพบความเสี่ยงทุจริต (${fraudAssessment.reason})`
      );
    }

    const txStatus =
      fraudAssessment.decision === 'FLAGGED_FOR_REVIEW' ? 'FLAGGED' : 'SUCCESS';

    // 3. หักเงินในกระเป๋าและบันทึกฐานข้อมูลใน Atomic Transaction
    const transactionRecord = await prisma.$transaction(async (tx: any) => {
      // 3.1 ตัดยอดเงินในกระเป๋าประชาชน
      const newWalletBalance =
        Math.round((wallet.balance - copay.citizenPaidAmount) * 100) / 100;
      const newDailyQuotaUsed =
        Math.round((wallet.dailyQuotaUsed + copay.governmentCopayAmount) * 100) / 100;
      const newTotalQuotaRemaining =
        Math.round((wallet.totalQuotaRemaining - copay.governmentCopayAmount) * 100) / 100;

      await tx.wallets.update({
        where: { wallet_id: wallet.walletId },
        data: {
          balance: newWalletBalance,
          daily_quota_used: newDailyQuotaUsed,
          total_quota_remaining: newTotalQuotaRemaining,
        },
      });

      // 3.2 สร้างรายการธุรกรรมหลัก (Transactions)
      const newTx = await tx.transactions.create({
        data: {
          qr_reference: params.qrReference,
          user_id: params.userId,
          merchant_id: merchantId,
          total_amount: copay.totalAmount,
          government_copay_amount: copay.governmentCopayAmount,
          citizen_paid_amount: copay.citizenPaidAmount,
          status: txStatus,
          completed_at: txStatus === 'SUCCESS' ? new Date() : null,
        },
      });

      // 3.3 บันทึกประวัติการเคลื่อนไหวของกระเป๋าเงิน (Wallet Transactions)
      await tx.wallet_transactions.create({
        data: {
          wallet_id: wallet.walletId,
          transaction_id: newTx.transaction_id,
          transaction_type: 'COPAY_PAYMENT',
          amount: copay.citizenPaidAmount,
          payment_channel: 'COPAY_WALLET',
          reference_number: params.qrReference,
          balance_after: newWalletBalance,
        },
      });

      // 3.4 บันทึกการตรวจสอบทุจริต (Fraud Checks)
      await tx.fraud_checks.create({
        data: {
          transaction_id: newTx.transaction_id,
          user_latitude: params.userLatitude,
          user_longitude: params.userLongitude,
          merchant_latitude: merchantLat,
          merchant_longitude: merchantLon,
          distance_meters: fraudAssessment.distanceMeters,
          is_distance_valid: fraudAssessment.distanceMeters <= 1000,
          risk_score: fraudAssessment.riskScore,
          fraud_reason: fraudAssessment.reason,
          decision: fraudAssessment.decision,
        },
      });

      return newTx;
    });

    // ล้าง QR หลังใช้งานเสร็จ
    qrStore.delete(params.qrReference);

    return {
      transactionId: transactionRecord.transaction_id,
      qrReference: params.qrReference,
      shopName,
      status: txStatus,
      totalAmount: copay.totalAmount,
      governmentCopayAmount: copay.governmentCopayAmount,
      citizenPaidAmount: copay.citizenPaidAmount,
      completedAt: transactionRecord.created_at.toISOString(),
      distanceMeters: fraudAssessment.distanceMeters,
      riskScore: fraudAssessment.riskScore,
      fraudDecision: fraudAssessment.decision,
      fraudReason: fraudAssessment.reason,
      reviewEligible: true,
      reviewWindowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}

export const paymentService = new PaymentService();
