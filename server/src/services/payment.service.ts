import { EventEmitter } from 'events';
import prisma from '../utils/prisma';
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

// In-memory cache สำหรับเก็บ Dynamic QR ชั่วคราว (มีอายุ 3 นาที) ควบคู่กับฐานข้อมูล
const qrStore = new Map<string, DynamicQrData>();

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

    // 3. ประชาชนจ่าย 40% ของยอดสุทธิ หรือส่วนที่เกินจากสิทธิรัฐ
    const citizenPaidAmount = Math.round((netTotalAmount - governmentCopayAmount) * 100) / 100;

    const governmentPercentage =
      netTotalAmount > 0 ? Math.round((governmentCopayAmount / netTotalAmount) * 100) : 0;
    const citizenPercentage = 100 - governmentPercentage;
    const totalSavingsAmount = Math.round((discountAmount + governmentCopayAmount) * 100) / 100;

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

    if (demoCodes[cleanCode]) {
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
    let merchantId = params.merchantId;
    let shopName = params.shopName || 'ร้านค้าประชารัฐร่วมใจ';

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
    const expiresAt = new Date(now.getTime() + QR_EXPIRATION_MS);

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
      status: 'ACTIVE',
    };

    qrStore.set(qrReference, qrData);

    return qrData;
  }

  /**
   * ตรวจสอบสถานะ QR Code สำหรับฝั่งร้านค้า (POS Real-time Polling)
   * เพื่อให้หน้าจอร้านค้าเด้งแจ้งเตือนมาตรฐานและเล่นเสียงเมื่อลูกค้าจ่ายเงินสำเร็จ
   */
  public async getQrPaymentStatus(qrReference: string) {
    let qrData = qrStore.get(qrReference);

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

      if (qrData) {
        qrData.status = 'USED';
        qrData.paidTransaction = paidInfo;
        qrStore.set(qrReference, qrData);
      }

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
      qrStore.set(qrReference, qrData);
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
    let qrData = qrStore.get(qrReference);

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
      qrStore.set(qrReference, qrData);
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
    if (userLocation && userLocation.lat && userLocation.lon) {
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
        qrStore.set(qrReference, qrData);

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
      copaySplit = this.calculateCopay(
        qrData.totalAmount,
        walletInfo.dailyQuotaRemaining,
        walletInfo.totalQuotaRemaining,
        discountAmount,
        discountInfo?.code,
        discountInfo?.sourceDescription
      );
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
    pin?: string;
  }) {
    if (params.pin !== undefined && !/^\d{6}$/.test(params.pin)) {
      throw new Error('กรุณาระบุรหัส PIN ยืนยันการชำระเงิน 6 หลักให้ถูกต้อง');
    }

    const { qrData } = await this.getQrDetails(params.qrReference);

    const merchantId = params.merchantId || qrData.merchantId;
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

    const copay = this.calculateCopay(
      qrData.totalAmount,
      wallet.dailyQuotaRemaining,
      wallet.totalQuotaRemaining,
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
      qrStore.set(params.qrReference, qrData);

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
      // 4.1 ตัดยอดเงินในกระเป๋าประชาชน
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
        await tx.referrals.update({
          where: { referral_id: discountInfo.referralId },
          data: {
            status: 'redeemed',
            transaction_id: newTx.transaction_id,
            converted_at: completedAtDate,
          },
        });
      } else if (discountInfo?.userRewardId) {
        await tx.user_rewards.update({
          where: { user_reward_id: discountInfo.userRewardId },
          data: {
            status: 'used',
            transaction_id: newTx.transaction_id,
            used_at: completedAtDate,
          },
        });
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
    qrStore.set(params.qrReference, qrData);

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
  public _simulateExpireQr(qrReference: string): void {
    const qrData = qrStore.get(qrReference);
    if (qrData) {
      qrData.expiresAt = new Date(Date.now() - 5000).toISOString();
      qrStore.set(qrReference, qrData);
    }
  }
}

export const paymentService = new PaymentService();
