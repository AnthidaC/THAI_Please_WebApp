import { EventEmitter } from 'events';
import { randomUUID } from 'node:crypto';
import prisma from '../utils/prisma';
import { qrStore } from './payment-qr.store';
import { paymentPinService } from './payment-pin.service';
import { thaiDateKey } from '../utils/thai-date';
import { walletService } from './wallet.service';
import {
  fraudService,
  calculateHaversineDistance,
  MAX_ALLOWED_DISTANCE_METERS,
} from './fraud.service';


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

export interface CopayCalculationResult {
  originalTotalAmount: number;
  discountAmount: number;
  discountCode?: string;
  discountDescription?: string;
  netTotalAmount: number;
  totalAmount: number; // compatible with netTotalAmount
  governmentCopayAmount: number;
  citizenPaidAmount: number;
  governmentPercentage: number;
  citizenPercentage: number;
  totalSavingsAmount: number;
  dailyQuotaRemainingBefore: number;
  dailyQuotaRemainingAfter: number;
  totalQuotaRemainingBefore: number;
  totalQuotaRemainingAfter: number;
  quotaWarning?: string | null;
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
  status?: 'ACTIVE' | 'USED' | 'SUSPENDED' | 'EXPIRED' | 'REJECTED';
  paidTransaction?: {
    transactionId: string;
    customerName: string;
    totalAmount: number;
    governmentCopayAmount: number;
    citizenPaidAmount: number;
    completedAt: string;
  };
}

// อายุของ Dynamic QR Code ทุกรายการในระบบกำหนดไว้ที่ 3 นาที (180,000 มิลลิวินาที)
export const QR_EXPIRATION_MS = 3 * 60 * 1000;

export class PaymentService {
  // Real-time Event Emitter สำหรับ Server-Sent Events (SSE) แจ้งเตือน POS ทันที
  public qrPaymentEvents = new EventEmitter();

  /**
   * คำนวณยอด Co-pay 60/40 ตามสูตรและเพดานสิทธิ์ ร่วมกับคูปอง/โค้ดคำชวนของเพื่อน
   */
  public calculateCopay(
    totalAmount: number,
    dailyQuotaRemaining: number,
    totalQuotaRemaining: number,
    discountAmount = 0,
    discountCode?: string,
    discountDescription?: string
  ): CopayCalculationResult {
    // 1. คำนวณยอดสุทธิหลังหักส่วนลดคูปอง/โค้ดชวนเพื่อน (Net Amount)
    const netTotalAmount = Math.max(0, Math.round((totalAmount - discountAmount) * 100) / 100);

    // 2. คำนวณส่วนที่รัฐช่วย 60% จากยอดสุทธิ (ไม่เกินโควตารายวัน 150 บาท และโควตารวม 3,000 บาท)
    const tentativeGovCopay = Math.round(netTotalAmount * 0.6 * 100) / 100;
    const maxGovAllowable = Math.max(
      0,
      Math.min(tentativeGovCopay, dailyQuotaRemaining, totalQuotaRemaining)
    );
    const governmentCopayAmount = Math.round(maxGovAllowable * 100) / 100;

    // 3. ประชาชนจ่าย 40% ของยอดสุทธิ หรือส่วนที่เกินจากสิทธิรัฐ (จ่ายส่วนต่างเพิ่มเองอัตโนมัติ)
    const citizenPaidAmount = Math.round((netTotalAmount - governmentCopayAmount) * 100) / 100;

    const governmentPercentage =
      netTotalAmount > 0 ? Math.round((governmentCopayAmount / netTotalAmount) * 100) : 0;
    const citizenPercentage = 100 - governmentPercentage;
    const totalSavingsAmount = Math.round((discountAmount + governmentCopayAmount) * 100) / 100;

    // ตรวจสอบแจ้งเตือนโควตาเต็มหรือเหลือน้อยกว่าสิทธิ์ 60%
    let quotaWarning: string | null = null;
    if (netTotalAmount > 0 && tentativeGovCopay > 0) {
      if (dailyQuotaRemaining <= 0 && totalQuotaRemaining <= 0) {
        quotaWarning = 'โควตารัฐช่วยจ่ายของคุณหมดแล้ว คุณต้องชำระยอดเต็มเอง';
      } else if (dailyQuotaRemaining <= 0) {
        quotaWarning = 'โควตาวันนี้หมดแล้ว คุณต้องชำระยอดเต็มเอง';
      } else if (totalQuotaRemaining <= 0) {
        quotaWarning = 'โควตารอบปัจจุบันหมดแล้ว คุณต้องชำระยอดเต็มเอง';
      } else if (governmentCopayAmount < tentativeGovCopay) {
        const shortQuota = tentativeGovCopay > dailyQuotaRemaining ? 'โควตารายวัน' : 'โควตารอบย่อย';
        quotaWarning = `${shortQuota}ไม่พอรับสิทธิ์ 60% เต็มจำนวน คุณต้องจ่ายส่วนขาดเพิ่มเอง`;
      }
    }

    return {
      originalTotalAmount: totalAmount,
      discountAmount,
      discountCode,
      discountDescription,
      netTotalAmount,
      totalAmount: netTotalAmount,
      governmentCopayAmount,
      citizenPaidAmount,
      governmentPercentage,
      citizenPercentage,
      totalSavingsAmount,
      dailyQuotaRemainingBefore: dailyQuotaRemaining,
      dailyQuotaRemainingAfter:
        Math.round((dailyQuotaRemaining - governmentCopayAmount) * 100) / 100,
      totalQuotaRemainingBefore: totalQuotaRemaining,
      totalQuotaRemainingAfter:
        Math.round((totalQuotaRemaining - governmentCopayAmount) * 100) / 100,
      quotaWarning,
    };
  }

  /**
   * ตรวจสอบรหัสคูปองส่วนลด หรือโค้ดคำชวนของเพื่อน (Friend Referral Code)
   */
  public async validateDiscountCode(params: {
    code: string;
    userId?: string;
    merchantId?: string;
    totalAmount: number;
  }): Promise<DiscountValidationResult> {
    const cleanCode = params.code.trim().toUpperCase();
    if (!cleanCode) {
      throw new Error('กรุณาระบุรหัสคูปองหรือโค้ดคำชวนของเพื่อน');
    }

    // 1. ตรวจสอบในตาราง referrals (โค้ดคำชวนของเพื่อน / Friend Referral)
    try {
      const referral = await prisma.referrals.findUnique({
        where: { referral_code: cleanCode },
        include: {
          users_referrals_referrer_user_idTousers: {
            select: { full_name: true },
          },
        },
      });

      if (referral) {
        if (referral.status === 'redeemed') {
          throw new Error('โค้ดคำชวนของเพื่อนนี้ถูกใช้งานไปแล้ว');
        }
        if (referral.expires_at && new Date(referral.expires_at).getTime() < Date.now()) {
          throw new Error('โค้ดคำชวนของเพื่อนนี้หมดอายุแล้ว');
        }
        if (params.userId && referral.referrer_user_id === params.userId) {
          throw new Error('ไม่สามารถใช้โค้ดชวนเพื่อนของตนเองได้');
        }
        if (referral.merchant_id && params.merchantId && referral.merchant_id !== params.merchantId) {
          throw new Error('โค้ดนี้สามารถใช้ได้เฉพาะกับร้านค้าที่กำหนดเท่านั้น');
        }

        const discountAmount = Math.min(params.totalAmount, Number(referral.discount_amount || 30));
        const referrerName = referral.users_referrals_referrer_user_idTousers.full_name;

        return {
          code: cleanCode,
          isValid: true,
          discountAmount,
          discountType: 'FIXED',
          discountSource: 'FRIEND_REFERRAL',
          sourceDescription: `ส่วนลด ฿${discountAmount.toFixed(0)} จากโค้ดคำชวนของเพื่อน (${referrerName})`,
          referrerName,
          referralId: referral.referral_id,
        };
      }
    } catch (e: any) {
      if (e.message && !e.message.includes('PrismaClient')) {
        throw e;
      }
    }

    // 2. ตรวจสอบในตาราง user_rewards (คูปองรางวัล / Discount Coupons)
    try {
      const userReward = await prisma.user_rewards.findUnique({
        where: { reward_code: cleanCode },
        include: { rewards: true },
      });

      if (userReward) {
        if (params.userId && userReward.user_id !== params.userId) {
          throw new Error('คูปองนี้ไม่ได้เป็นของบัญชีคุณ');
        }
        if (userReward.status !== 'available') {
          throw new Error('คูปองนี้ถูกใช้งานไปแล้วหรือหมดสิทธิ์');
        }
        if (userReward.expires_at && new Date(userReward.expires_at).getTime() < Date.now()) {
          throw new Error('คูปองนี้หมดอายุแล้ว');
        }

        let discountVal = 0;
        if (userReward.rewards.discount_type === 'percent') {
          const pct = Number(userReward.rewards.discount_value || 10);
          discountVal = Math.round(params.totalAmount * (pct / 100) * 100) / 100;
        } else {
          discountVal = Number(userReward.rewards.discount_value || 30);
        }
        const finalDiscount = Math.min(params.totalAmount, discountVal);

        return {
          code: cleanCode,
          isValid: true,
          discountAmount: finalDiscount,
          discountType: userReward.rewards.discount_type === 'percent' ? 'PERCENT' : 'FIXED',
          discountSource: 'COUPON',
          sourceDescription: `คูปองส่วนลด: ${userReward.rewards.reward_name} (ลด ฿${finalDiscount.toFixed(0)})`,
          userRewardId: userReward.user_reward_id,
        };
      }
    } catch (e: any) {
      if (e.message && !e.message.includes('PrismaClient')) {
        throw e;
      }
    }

    // 3. โค้ดโปรโมชันและคำชวนเพื่อนจำลองมาตรฐาน (Duo Coupon & Demo Codes)
    const demoCodes: Record<
      string,
      { amount: number; desc: string; source: 'FRIEND_REFERRAL' | 'COUPON'; referrer?: string }
    > = {
      FRIEND30: {
        amount: 30,
        desc: 'ส่วนลด ฿30 จากโค้ดคำชวนของเพื่อน (สมชาย ใจดี)',
        source: 'FRIEND_REFERRAL',
        referrer: 'สมชาย ใจดี',
      },
      DUO50: {
        amount: 50,
        desc: 'คูปองชวนเพื่อน Duo Special (ลด ฿50)',
        source: 'FRIEND_REFERRAL',
        referrer: 'วิภาดา พารวย',
      },
      WELCOME20: {
        amount: 20,
        desc: 'คูปองต้อนรับสมาชิกใหม่ (ลด ฿20)',
        source: 'COUPON',
      },
      THAIPLUS30: {
        amount: 30,
        desc: 'คูปองกระตุ้นเศรษฐกิจไทยช่วยไทยพลีส (ลด ฿30)',
        source: 'COUPON',
      },
    };

    if (process.env.NODE_ENV !== 'production' && demoCodes[cleanCode]) {
      const demo = demoCodes[cleanCode];
      const discount = Math.min(params.totalAmount, demo.amount);
      return {
        code: cleanCode,
        isValid: true,
        discountAmount: discount,
        discountType: 'FIXED',
        discountSource: demo.source,
        sourceDescription: demo.desc,
        referrerName: demo.referrer,
      };
    }

    throw new Error(`ไม่พบรหัสคูปองหรือโค้ดคำชวนของเพื่อน '${cleanCode}' ในระบบ`);
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
    const merchantId = params.merchantId;
    if (!merchantId) throw new Error('กรุณาระบุร้านค้าที่ผูกกับบัญชี');
    const merchant = await prisma.merchants.findUnique({ where: { merchant_id: merchantId } });
    if (!merchant?.is_approved) throw new Error('ร้านค้ายังไม่ได้รับอนุมัติหรือถูกระงับสิทธิ์');
    const shopName = merchant.shop_name;
    const qrReference = `TP-QR-${randomUUID()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + QR_EXPIRATION_MS);

    // ดึงเพดานรายวันจากโครงการที่เปิดใช้งานล่าสุดในระบบ (ค่าเริ่มต้น 200 บาท / รัฐช่วย 60%)
    const activeCampaign = await prisma.campaigns.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { created_at: 'desc' },
    });
    const campaignDailyLimit = activeCampaign ? Number(activeCampaign.daily_quota_limit) : 200.0;
    const govRate = activeCampaign ? Number(activeCampaign.government_copay_rate_percent) / 100 : 0.6;

    const tentativeGov = Math.min(Math.round(params.amount * govRate * 100) / 100, campaignDailyLimit);
    const tentativeCit = Math.round((params.amount - tentativeGov) * 100) / 100;

    const qrData: DynamicQrData = {
      qrReference,
      merchantId,
      shopName,
      totalAmount: params.amount,
      merchantLatitude: Number(merchant.latitude),
      merchantLongitude: Number(merchant.longitude),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      estimatedGovCopay: tentativeGov,
      estimatedCitizenPay: tentativeCit,
      status: 'ACTIVE',
    };

    await qrStore.set(qrReference, qrData);

    return qrData;
  }

  /**
   * ตรวจสอบสถานะ QR Code สำหรับฝั่งร้านค้า (POS Real-time Polling)
   * เพื่อให้หน้าจอร้านค้าเด้งแจ้งเตือนมาตรฐานและเล่นเสียงเมื่อลูกค้าจ่ายเงินสำเร็จ
   */
  public async getQrPaymentStatus(qrReference: string, merchantId?: string) {
    let qrData = await qrStore.get(qrReference);
    if (merchantId && (!qrData || qrData.merchantId !== merchantId)) {
      throw new Error('ไม่พบ QR Code ของร้านค้านี้');
    }

    // ตรวจสอบในฐานข้อมูลเผื่อมีรายการชำระเงินสำเร็จแล้ว
    const completedTx = await prisma.transactions.findFirst({
      where: {
        qr_reference: qrReference,
        status: { in: ['SUCCESS', 'FLAGGED'] },
      },
      include: {
        users: { select: { full_name: true } },
        merchants: { select: { shop_name: true, latitude: true, longitude: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    if (completedTx) {
      const paidInfo = {
        transactionId: completedTx.transaction_id,
        customerName: completedTx.users?.full_name || 'ประชาชนผู้ได้รับสิทธิ',
        totalAmount: Number(completedTx.total_amount),
        governmentCopayAmount: Number(completedTx.government_copay_amount),
        citizenPaidAmount: Number(completedTx.citizen_paid_amount),
        completedAt: (completedTx.completed_at || completedTx.created_at).toISOString(),
      };

      return {
        qrReference,
        status: 'USED' as const,
        shopName: qrData?.shopName || completedTx.merchants?.shop_name || 'ร้านค้าโครงการ',
        totalAmount: qrData?.totalAmount || Number(completedTx.total_amount),
        paidTransaction: paidInfo,
      };
    }

    if (!qrData) {
      return {
        qrReference,
        status: 'EXPIRED' as const,
        paidTransaction: null,
      };
    }

    const isExpired = new Date() > new Date(qrData.expiresAt) || qrData.status === 'EXPIRED';
    if (isExpired && qrData.status !== 'USED') {
      qrData.status = 'EXPIRED';
      await qrStore.set(qrReference, qrData);
    }

    return {
      qrReference: qrData.qrReference,
      status: qrData.status || 'ACTIVE',
      shopName: qrData.shopName,
      totalAmount: qrData.totalAmount,
      expiresAt: qrData.expiresAt,
      paidTransaction: qrData.paidTransaction || null,
    };
  }

  /**
   * ดึงข้อมูล QR Code เพื่อพรีวิวยอดชำระเงินร่วม Co-pay 60/40 (รองรับส่วนลดคูปอง/โค้ดเพื่อน และตรวจสอบพิกัด GPS 2 กม.)
   */
  public async getQrDetails(
    qrReference: string,
    userId?: string,
    discountCode?: string,
    userLocation?: { lat: number; lon: number }
  ) {
    let qrData = await qrStore.get(qrReference);

    if (!qrData) {
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
          expiresAt: new Date(tx.created_at.getTime() + QR_EXPIRATION_MS).toISOString(),
          estimatedGovCopay: Number(tx.government_copay_amount),
          estimatedCitizenPay: Number(tx.citizen_paid_amount),
          status: tx.status === 'SUCCESS' || tx.status === 'FLAGGED' ? 'USED' : (tx.status as any),
        };
      } else {
        throw new Error('ไม่พบข้อมูล QR Code นี้ หรือ QR Code อาจหมดอายุหรือถูกยกเลิกแล้ว');
      }
    }

    // 1. ตรวจสอบเวลาหมดอายุของ QR Code (อายุ 3 นาที)
    const isExpired = new Date() > new Date(qrData.expiresAt) || qrData.status === 'EXPIRED';
    if (isExpired) {
      qrData.status = 'EXPIRED';
      await qrStore.set(qrReference, qrData);
      throw new Error('QR หมดอายุ กรุณาทำรายการใหม่');
    }

    // 2. ตรวจสอบสถานะของ QR Code (ไม่ลบข้อมูลออกจากระบบ แค่ตรวจสอบสถานะ)
    if (qrData.status === 'REJECTED' || qrData.status === 'SUSPENDED') {
      throw new Error('ไม่พบข้อมูล QR Code นี้ หรือ QR Code อาจหมดอายุหรือถูกยกเลิกแล้ว');
    }

    if (qrData.status === 'USED') {
      throw new Error('QR Code นี้ถูกใช้งานชำระเงินเรียบร้อยแล้ว ไม่สามารถชำระซ้ำได้');
    }

    // 3. ตรวจสอบพิกัดระยะทางตั้งแต่ขั้นตอนสแกน QR (อนุญาตให้ทำธุรกรรมในรัศมีไม่เกิน 2 กิโลเมตร = 2,000 เมตร)
    if (userLocation && Number.isFinite(userLocation.lat) && Number.isFinite(userLocation.lon)) {
      const distanceMeters = calculateHaversineDistance(
        userLocation.lat,
        userLocation.lon,
        qrData.merchantLatitude,
        qrData.merchantLongitude
      );

      // ถ้าระยะห่างเกิน 2,000 เมตร (2 กิโลเมตร)
      if (distanceMeters > MAX_ALLOWED_DISTANCE_METERS) {
        // 1. ระงับ QR Code โดยปรับสถานะเป็น REJECTED (ไม่ลบข้อมูลออกจากระบบหรือ DB เพื่อเก็บประวัติไว้ตรวจสอบ)
        qrData.status = 'REJECTED';
        await qrStore.set(qrReference, qrData);

        // 2. จด log เก็บไว้เงียบๆ ในฐานข้อมูล เพื่อให้ Admin ตรวจสอบกรณีมีความน่าสงสัยซ้ำๆ
        try {
          let targetUserId = userId;
          if (!targetUserId) {
            const firstUser = await prisma.user.findFirst({ select: { user_id: true } });
            targetUserId = firstUser?.user_id;
          }

          if (targetUserId) {
            const rejectedTx = await prisma.transactions.create({
              data: {
                qr_reference: qrReference,
                user_id: targetUserId,
                merchant_id: qrData.merchantId,
                total_amount: qrData.totalAmount,
                government_copay_amount: 0,
                citizen_paid_amount: 0,
                status: 'REJECTED',
                completed_at: null,
              },
            });

            await prisma.fraud_checks.create({
              data: {
                transaction_id: rejectedTx.transaction_id,
                user_latitude: userLocation.lat,
                user_longitude: userLocation.lon,
                merchant_latitude: qrData.merchantLatitude,
                merchant_longitude: qrData.merchantLongitude,
                distance_meters: distanceMeters,
                is_distance_valid: false,
                risk_score: Math.min(1.0, Math.round((distanceMeters / 5000) * 100) / 100),
                fraud_reason: `พยายามสแกน QR นอกรัศมี 2 กม. ที่กำหนด (ห่าง ${(distanceMeters / 1000).toFixed(2)} กม. จากร้าน ${qrData.shopName})`,
                decision: 'REJECTED',
              },
            });
          }
        } catch (logErr) {
          console.error('[Fraud Log] Failed to save silent rejected log on scan:', logErr);
        }

        // 3. แจ้งเตือนผู้ใช้ด้วยข้อความสุภาพ แจ้งว่าไกลเกินรัศมี 2 กิโลเมตร (ไม่กล่าวหาว่าทุจริต)
        throw new Error(
          'ไม่สามารถทำรายการได้ เนื่องจากตำแหน่งของคุณอยู่ห่างจากร้านค้าเกินระยะที่กำหนด (ไม่เกิน 2 กิโลเมตร) กรุณาสแกน QR Code ใหม่อีกครั้งที่หน้าร้าน'
        );
      }
    }

    let discountInfo: DiscountValidationResult | null = null;
    let discountAmount = 0;

    if (discountCode) {
      try {
        discountInfo = await this.validateDiscountCode({
          code: discountCode,
          userId,
          merchantId: qrData.merchantId,
          totalAmount: qrData.totalAmount,
        });
        discountAmount = discountInfo.discountAmount;
      } catch (err: any) {
        console.warn('Discount validation error in preview:', err.message);
      }
    }

    let copaySplit: CopayCalculationResult | null = null;
    let walletInfo = null;

    if (userId) {
      walletInfo = await walletService.getWalletByUserId(userId);
      const isEligible = walletInfo.eligibilityStatus === 'ELIGIBLE';
      const isOutside = !!walletInfo.isOutsidePeriod;

      const effectiveDailyQuota = (isEligible && !isOutside) ? walletInfo.dailyQuotaRemaining : 0;
      const effectiveCap = (isEligible && !isOutside)
        ? Math.min(walletInfo.totalQuotaRemaining, walletInfo.currentPeriod?.quotaRemaining ?? walletInfo.totalQuotaRemaining)
        : 0;

      copaySplit = this.calculateCopay(
        qrData.totalAmount,
        effectiveDailyQuota,
        effectiveCap,
        discountAmount,
        discountInfo?.code,
        discountInfo?.sourceDescription
      );

      if (!isEligible) {
        if (walletInfo.eligibilityStatus === 'CAMPAIGN_EXPIRED') {
          copaySplit.quotaWarning = 'โครงการสิ้นสุดระยะเวลาแล้ว คุณต้องชำระยอดเต็ม 100% เอง';
        } else {
          copaySplit.quotaWarning = 'คุณยังไม่ได้ลงทะเบียนเข้าร่วมโครงการ จึงไม่มีสิทธิ์รับเงินสมทบจากรัฐ (ต้องชำระยอดเต็ม 100%)';
        }
      } else if (isOutside) {
        copaySplit.quotaWarning = 'ปัจจุบันอยู่นอกรอบโครงการ จึงไม่มีสิทธิ์รับเงินสมทบจากรัฐในขณะนี้ (ต้องชำระยอดเต็ม 100%)';
      }
    }

    return {
      qrData,
      walletInfo,
      copaySplit,
      discountInfo,
    };
  }

  /**
   * ประชาชนยืนยันชำระเงินร่วม (Co-pay Checkout)
   * คำนวณ Co-pay 60/40 + ส่วนลดคูปอง/โค้ดเพื่อน + ตรวจพิกัด GPS (ไม่เกิน 2 กม.) & Semi-AI
   * นโยบาย: AI จะไม่บล็อกผู้ใช้หรือร้านค้าทันที แต่หากพบความน่าสงสัยซ้ำๆ จะส่งแจ้งเตือนให้ Admin ตรวจสอบ
   */
  public async checkout(params: {
    userId: string;
    qrReference: string;
    userLatitude: number;
    userLongitude: number;
    merchantId?: string;
    discountCode?: string;
    pin: string;
  }) {
    await paymentPinService.verify(params.userId, params.pin);

    const { qrData } = await this.getQrDetails(params.qrReference);

    if (params.merchantId && params.merchantId !== qrData.merchantId) {
      throw new Error('ร้านค้าไม่ตรงกับ QR Code');
    }
    const merchantId = qrData.merchantId;
    const [merchant, buyerUser] = await Promise.all([
      prisma.merchants.findUnique({
        where: { merchant_id: merchantId },
      }),
      prisma.user.findUnique({
        where: { user_id: params.userId },
        select: { full_name: true },
      }),
    ]);

    const merchantLat = merchant ? Number(merchant.latitude) : qrData.merchantLatitude;
    const merchantLon = merchant ? Number(merchant.longitude) : qrData.merchantLongitude;
    const shopName = merchant ? merchant.shop_name : qrData.shopName;
    const customerName = buyerUser?.full_name || 'ประชาชนผู้ได้รับสิทธิ';

    if (merchant && merchant.is_approved === false) {
      throw new Error(
        'ไม่สามารถทำรายการได้ เนื่องจากร้านค้านี้ถูกระงับสิทธิ์ชั่วคราวเพื่อรอการตรวจสอบจากผู้ดูแลระบบ'
      );
    }

    // 1. ตรวจสอบโค้ดส่วนลด/โค้ดชวนเพื่อน (ถ้ามี)
    let discountInfo: DiscountValidationResult | null = null;
    let discountAmount = 0;

    if (params.discountCode) {
      discountInfo = await this.validateDiscountCode({
        code: params.discountCode,
        userId: params.userId,
        merchantId,
        totalAmount: qrData.totalAmount,
      });
      discountAmount = discountInfo.discountAmount;
    }

    // 2. ดึงข้อมูลกระเป๋าเงินและตรวจสอบสถานะการระงับสิทธิ์ของประชาชน
    const wallet = await walletService.getWalletByUserId(params.userId);
    if (wallet.status === 'SUSPENDED' || wallet.eligibilityStatus === 'SUSPENDED') {
      throw new Error(
        'สิทธิ์การใช้จ่ายโครงการของคุณถูกระงับชั่วคราวเนื่องจากพบความผิดปกติ กรุณาติดต่อผู้ดูแลระบบเพื่อยืนยันตัวตน'
      );
    }

    // ตรวจสอบสิทธิ์โครงการ: หากไม่มีสิทธิ์, หมดโครงการ, หรืออยู่นอกรอบโครงการ ให้ชำระเต็มจำนวน 100% (ไม่บล็อกการซื้อ)
    const isEligible = wallet.eligibilityStatus === 'ELIGIBLE';
    const isOutside = !!wallet.isOutsidePeriod;
    const effectiveDailyQuota = (isEligible && !isOutside) ? wallet.dailyQuotaRemaining : 0;
    const effectiveCap = (isEligible && !isOutside)
      ? Math.min(wallet.totalQuotaRemaining, wallet.currentPeriod?.quotaRemaining ?? wallet.totalQuotaRemaining)
      : 0;

    const copay = this.calculateCopay(
      qrData.totalAmount,
      effectiveDailyQuota,
      effectiveCap,
      discountAmount,
      discountInfo?.code,
      discountInfo?.sourceDescription
    );

    // ตรวจสอบยอดเงินคงเหลือในกระเป๋า
    if (wallet.balance < copay.citizenPaidAmount) {
      throw new Error(
        `ยอดเงินคงเหลือในกระเป๋าไม่เพียงพอ (ต้องการ ฿${copay.citizenPaidAmount.toFixed(
          2
        )} แต่มี ฿${wallet.balance.toFixed(2)}) กรุณาเติมเงินก่อนทำรายการ`
      );
    }

    // 3. เรียกใช้ระบบตรวจสอบพิกัด GPS (รัศมี 2 กม.) & Semi-AI Anomaly Engine
    const fraudAssessment = await fraudService.evaluateTransaction({
      userId: params.userId,
      merchantId,
      amount: qrData.totalAmount,
      userLat: params.userLatitude,
      userLon: params.userLongitude,
      merchantLat,
      merchantLon,
    });

    // บล็อกเฉพาะกรณีอยู่นอกรัศมี 2 กิโลเมตร (2,000 เมตร) เท่านั้น — AI ไม่บล็อกผู้ใช้หรือร้านค้าทันที
    if (fraudAssessment.distanceMeters > MAX_ALLOWED_DISTANCE_METERS) {
      qrData.status = 'REJECTED';
      await qrStore.set(params.qrReference, qrData);

      try {
        const rejectedTx = await prisma.transactions.create({
          data: {
            qr_reference: params.qrReference,
            user_id: params.userId,
            merchant_id: merchantId,
            total_amount: copay.netTotalAmount,
            government_copay_amount: 0,
            citizen_paid_amount: 0,
            status: 'REJECTED',
            completed_at: null,
          },
        });

        await prisma.fraud_checks.create({
          data: {
            transaction_id: rejectedTx.transaction_id,
            user_latitude: params.userLatitude,
            user_longitude: params.userLongitude,
            merchant_latitude: merchantLat,
            merchant_longitude: merchantLon,
            distance_meters: fraudAssessment.distanceMeters,
            is_distance_valid: false,
            risk_score: fraudAssessment.riskScore,
            fraud_reason: `ตำแหน่งขณะชำระเงินห่างเกินรัศมี 2 กม. ที่กำหนด (ห่าง ${(fraudAssessment.distanceMeters / 1000).toFixed(2)} กม.)`,
            decision: 'REJECTED',
          },
        });
      } catch (logErr) {
        console.error('[Fraud Log] Failed to save rejected log on checkout:', logErr);
      }

      throw new Error(
        'ไม่สามารถทำรายการได้ เนื่องจากตำแหน่งของคุณอยู่ห่างจากร้านค้าเกินระยะที่กำหนด (ไม่เกิน 2 กิโลเมตร) กรุณาสแกน QR Code ใหม่อีกครั้งที่หน้าร้าน'
      );
    }

    // หากอยู่ในระยะ <= 2 กม. อนุญาตให้ทำธุรกรรมสำเร็จได้เสมอ (ไม่บล็อกผู้ใช้หรือร้านค้า)
    // แต่หาก AI พบความน่าสงสัยซ้ำๆ จะบันทึกเป็น FLAGGED เพื่อให้ Admin ตรวจสอบย้อนหลังได้
    const txStatus =
      fraudAssessment.decision === 'FLAGGED_FOR_REVIEW' ? 'FLAGGED' : 'SUCCESS';
    const completedAtDate = new Date();

    // 4. บันทึกและตัดยอดเงินใน Atomic Transaction
    const transactionRecord = await prisma.$transaction(async (tx: any) => {
      // Claim the QR in the same transaction as the debit; rollback releases the claim.
      const claim = await tx.payment_qr_codes.updateMany({
        where: { qr_reference: params.qrReference, status: 'ACTIVE', expires_at: { gt: new Date() } },
        data: { status: 'USED' },
      });
      if (claim.count !== 1) throw new Error('QR นี้ถูกชำระแล้ว ถูกยกเลิก หรือหมดอายุ กรุณาตรวจสอบประวัติ');
      await tx.$queryRaw`SELECT wallet_id FROM wallets WHERE wallet_id = ${wallet.walletId}::uuid FOR UPDATE`;
      const latestWallet = await tx.wallets.findUnique({ where: { wallet_id: wallet.walletId } });
      if (!latestWallet || latestWallet.status === 'SUSPENDED' ||
          latestWallet.eligibility_status === 'SUSPENDED' ||
          (copay.governmentCopayAmount > 0 && latestWallet.eligibility_status !== 'ELIGIBLE') ||
          (latestWallet.campaign_id !== wallet.campaignInfo?.campaignId && latestWallet.campaign_id !== null) ||
          thaiDateKey() !== wallet.lastQuotaResetDate.slice(0, 10) ||
          Number(latestWallet.balance) !== wallet.balance ||
          Number(latestWallet.daily_quota_used) !== wallet.dailyQuotaUsed ||
          (wallet.eligibilityStatus === 'ELIGIBLE' && Number(latestWallet.total_quota_remaining) !== wallet.totalQuotaRemaining)) {
        throw new Error('ข้อมูลกระเป๋าเงินเปลี่ยนแปลง กรุณาตรวจสอบยอดและลองชำระใหม่');
      }
      if (copay.governmentCopayAmount > 0 &&
          (wallet.campaignInfo && new Date() > new Date(wallet.campaignInfo.endDate) ||
           wallet.currentPeriod && new Date() > new Date(wallet.currentPeriod.endDate))) {
        throw new Error('สิทธิ์โครงการเปลี่ยนแปลง กรุณาตรวจสอบยอดชำระใหม่');
      }
      // 4.1 ตัดยอดเงินในกระเป๋าประชาชน
      const newWalletBalance =
        Math.round((wallet.balance - copay.citizenPaidAmount) * 100) / 100;
      const newDailyQuotaUsed =
        Math.round((wallet.dailyQuotaUsed + copay.governmentCopayAmount) * 100) / 100;
      const newTotalQuotaRemaining =
        Math.round((Number(latestWallet.total_quota_remaining) - copay.governmentCopayAmount) * 100) / 100;

      await tx.wallets.update({
        where: { wallet_id: wallet.walletId },
        data: {
          balance: newWalletBalance,
          daily_quota_used: newDailyQuotaUsed,
          total_quota_remaining: newTotalQuotaRemaining,
        },
      });

      // 4.1.1 ตัดยอดในรอบโครงการปัจจุบัน (wallet_period_quotas) หากมีรอบที่กำลังดำเนินการ
      if (wallet.currentPeriod && copay.governmentCopayAmount > 0) {
        await tx.$queryRaw`SELECT wallet_period_quota_id FROM wallet_period_quotas
          WHERE wallet_id = ${wallet.walletId}::uuid AND period_id = ${wallet.currentPeriod.periodId}::uuid FOR UPDATE`;
        const periodQuota = await tx.wallet_period_quotas.findUnique({
          where: {
            wallet_id_period_id: {
              wallet_id: wallet.walletId,
              period_id: wallet.currentPeriod.periodId,
            },
          },
        });

        if (!periodQuota) throw new Error('ไม่พบโควตารอบปัจจุบัน กรุณาตรวจสอบยอดและลองใหม่');
        if (periodQuota) {
          if (Number(periodQuota.quota_remaining) < copay.governmentCopayAmount) {
            throw new Error('โควตารอบปัจจุบันเปลี่ยนแปลง กรุณาตรวจสอบยอดและลองใหม่');
          }
          const newPeriodUsed =
            Math.round((Number(periodQuota.quota_used) + copay.governmentCopayAmount) * 100) / 100;
          const newPeriodRemaining =
            Math.max(0, Math.round((Number(periodQuota.quota_remaining) - copay.governmentCopayAmount) * 100) / 100);

          await tx.wallet_period_quotas.update({
            where: {
              wallet_id_period_id: {
                wallet_id: wallet.walletId,
                period_id: wallet.currentPeriod.periodId,
              },
            },
            data: {
              quota_used: newPeriodUsed,
              quota_remaining: newPeriodRemaining,
            },
          });
        }
      }

      // 4.2 สร้างรายการธุรกรรมหลัก
      const newTx = await tx.transactions.create({
        data: {
          qr_reference: params.qrReference,
          user_id: params.userId,
          merchant_id: merchantId,
          total_amount: copay.netTotalAmount,
          government_copay_amount: copay.governmentCopayAmount,
          citizen_paid_amount: copay.citizenPaidAmount,
          status: txStatus,
          completed_at: completedAtDate,
        },
      });

      // 4.3 ตัดสิทธิ์โค้ดชวนเพื่อน หรือ คูปอง หากมีการใช้งาน
      if (discountInfo?.referralId) {
        const redeemed = await tx.referrals.updateMany({
          where: { referral_id: discountInfo.referralId, status: { not: 'redeemed' } },
          data: {
            status: 'redeemed',
            transaction_id: newTx.transaction_id,
            converted_at: completedAtDate,
          },
        });
        if (redeemed.count !== 1) throw new Error('โค้ดคำชวนถูกใช้งานแล้ว กรุณาตรวจสอบใหม่');
      } else if (discountInfo?.userRewardId) {
        const redeemed = await tx.user_rewards.updateMany({
          where: { user_reward_id: discountInfo.userRewardId, user_id: params.userId, status: 'available' },
          data: {
            status: 'used',
            transaction_id: newTx.transaction_id,
            used_at: completedAtDate,
          },
        });
        if (redeemed.count !== 1) throw new Error('คูปองถูกใช้งานแล้ว กรุณาตรวจสอบใหม่');
      }

      // 4.4 บันทึกประวัติการเคลื่อนไหวของกระเป๋าเงิน
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

      // 4.5 บันทึกการตรวจสอบของ AI (หากเป็น FLAGGED_FOR_REVIEW จะไปปรากฏในหน้า Admin ทันที)
      await tx.fraud_checks.create({
        data: {
          transaction_id: newTx.transaction_id,
          user_latitude: params.userLatitude,
          user_longitude: params.userLongitude,
          merchant_latitude: merchantLat,
          merchant_longitude: merchantLon,
          distance_meters: fraudAssessment.distanceMeters,
          is_distance_valid: fraudAssessment.distanceMeters <= MAX_ALLOWED_DISTANCE_METERS,
          risk_score: fraudAssessment.riskScore,
          fraud_reason: fraudAssessment.reason,
          decision: fraudAssessment.decision,
        },
      });

      await tx.payment_qr_codes.update({
        where: { qr_reference: params.qrReference },
        data: { payload: JSON.parse(JSON.stringify({ ...qrData, status: 'USED', paidTransaction: {
          transactionId: newTx.transaction_id, customerName, totalAmount: copay.netTotalAmount,
          governmentCopayAmount: copay.governmentCopayAmount, citizenPaidAmount: copay.citizenPaidAmount,
          completedAt: completedAtDate.toISOString(),
        } })) },
      });

      return newTx;
    });

    // ปรับสถานะ QR Code เป็น USED พร้อมแนบข้อมูลการจ่ายเงินเพื่อให้หน้าจอ POS ร้านค้ารับรู้ได้ทันที
    qrData.status = 'USED';
    qrData.paidTransaction = {
      transactionId: transactionRecord.transaction_id,
      customerName,
      totalAmount: copay.netTotalAmount,
      governmentCopayAmount: copay.governmentCopayAmount,
      citizenPaidAmount: copay.citizenPaidAmount,
      completedAt: completedAtDate.toISOString(),
    };
    // ส่งสัญญาณ Real-time ผ่าน SSE ไปยังหน้าจอ POS ของร้านค้าทันที (0 ms Latency)
    this.qrPaymentEvents.emit(`payment:${params.qrReference}`, qrData.paidTransaction);

    return {
      transactionId: transactionRecord.transaction_id,
      qrReference: params.qrReference,
      shopName,
      status: txStatus,
      originalTotalAmount: copay.originalTotalAmount,
      discountAmount: copay.discountAmount,
      discountCode: copay.discountCode,
      discountDescription: copay.discountDescription,
      netTotalAmount: copay.netTotalAmount,
      totalAmount: copay.netTotalAmount,
      governmentCopayAmount: copay.governmentCopayAmount,
      citizenPaidAmount: copay.citizenPaidAmount,
      totalSavingsAmount: copay.totalSavingsAmount,
      completedAt: completedAtDate.toISOString(),
      distanceMeters: fraudAssessment.distanceMeters,
      riskScore: fraudAssessment.riskScore,
      fraudDecision: fraudAssessment.decision,
      fraudReason: fraudAssessment.reason,
      reviewEligible: true,
      reviewWindowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * สำหรับใช้ในการทดสอบ Unit Test หรือจำลองสถานะ QR Code หมดอายุ (ตั้งเวลาถอยหลังเป็นอดีต)
   */
  public async _simulateExpireQr(qrReference: string): Promise<void> {
    await prisma.payment_qr_codes.updateMany({
      where: { qr_reference: qrReference, status: 'ACTIVE' },
      data: { expires_at: new Date(Date.now() - 5000), status: 'EXPIRED' },
    });
  }
}

export const paymentService = new PaymentService();
