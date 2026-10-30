import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { CreateCustomReferralCodeInput } from '../validations/referral.validation';

export class ReferralError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ReferralError';
    this.statusCode = statusCode;
  }
}

export interface MyReferralCodeResult {
  referralId: string;
  referralCode: string;
  discountAmount: number;
  shareUrl: string;
  status: string;
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

export interface ReferralStatsResult {
  merchantId: string | null;
  merchantName: string | null;
  activeReferralCode: string | null;
  shareUrl: string | null;
  isUserReferredAtThisMerchant?: boolean;
  isMerchantCredited?: boolean;
  summary: {
    totalInvited: number;
    totalRedeemed: number;
    totalPending: number;
    totalSuccessfulMerchants?: number;
  };
  invitedFriends: ReferralFriendItem[];
}

export interface ReferralValidationResult {
  referralCode: string;
  isValid: boolean;
  discountAmount: number;
  referrerName: string;
  merchantId: string;
  shopName: string;
  sourceDescription: string;
  expiresAt: string | null;
}

export interface EligibleMerchantItem {
  merchantId: string;
  shopName: string;
  categoryNameTh?: string | null;
  lastPaymentAt: string;
  totalSuccessfulPayments: number;
  isCredited?: boolean;
}

export interface ReferralConversionResult {
  success: boolean;
  referralId: string;
  referralCode: string;
  referrerUserId: string;
  refereeUserId: string;
  merchantId: string;
  transactionId: string;
  /** @deprecated Referral rewards are issued by missions. This is retained as an empty legacy field. */
  referrerMilestoneCoupons: Array<{
    userRewardId: string;
    rewardCode: string;
    discountValue: number;
    milestoneIndex: number;
  }>;
}

/** @deprecated Kept for the legacy referral test fixtures; conversion no longer issues this reward. */
export const REFERRER_MILESTONE_DISCOUNT_AMOUNT = 40.0;
/** @deprecated Kept for existing referral progress fixtures. */
export const REFERRER_MILESTONE_STEP = 5;
/** @deprecated Kept for the legacy referral test fixtures; conversion no longer issues this reward. */
export const REFERRER_MILESTONE_VALID_DAYS = 14;

export class ReferralService {
  /**
   * ซ่อนข้อมูลชื่อเพื่อความเป็นส่วนตัว (Privacy-preserving Masking)
   */
  public maskName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return 'เพื่อนผู้ใช้สิทธิ์';
    if (parts.length === 1) {
      const name = parts[0];
      return name.length > 2 ? `${name.slice(0, 2)}***` : `${name}*`;
    }
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    return `${firstName} ${lastName.charAt(0)}***`;
  }

  /**
   * @deprecated Legacy helper retained for existing test fixtures. Conversion no longer creates or awards this reward.
   */
  public async getOrCreateRewardTemplates(
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<{ reward40: { reward_id: string } }> {
    let reward40 = await tx.rewards.findFirst({
      where: {
        reward_type: 'discount',
        discount_type: 'fixed',
        discount_value: new Prisma.Decimal(REFERRER_MILESTONE_DISCOUNT_AMOUNT),
        status: 'active',
      },
      select: { reward_id: true },
    });

    if (!reward40) {
      reward40 = await tx.rewards.create({
        data: {
          reward_name: 'คูปองไมล์สโตนชวนเพื่อน (Referrer Milestone ฿40)',
          description: 'รางวัลเก่าจากระบบ referral; รางวัลใหม่ออกผ่านภารกิจเท่านั้น',
          reward_type: 'discount',
          discount_type: 'fixed',
          discount_value: new Prisma.Decimal(REFERRER_MILESTONE_DISCOUNT_AMOUNT),
          valid_days: REFERRER_MILESTONE_VALID_DAYS,
          status: 'active',
        },
        select: { reward_id: true },
      });
    }

    return { reward40 };
  }

  /**
   * สร้างรหัสคำชวนแบบสุ่ม เช่น TP-8F3K9A
   */
  public generateRandomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `TP-${suffix}`;
  }

  /**
   * ตรวจสอบว่าผู้ใช้เคยชำระเงินที่ร้านค้าสำเร็จอย่างน้อย 1 ครั้งหรือไม่
   */
  public async assertReferrerEligibleAtMerchant(
    userId: string,
    merchantId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<void> {
    const successfulTx = await db.transactions.findFirst({
      where: {
        user_id: userId,
        merchant_id: merchantId,
        status: 'SUCCESS',
      },
      select: { transaction_id: true },
    });

    if (!successfulTx) {
      throw new ReferralError(
        'คุณต้องเคยชำระเงินที่ร้านค้านี้สำเร็จอย่างน้อย 1 ครั้ง ก่อนจึงจะสามารถแนะนำเพื่อนสำหรับร้านนี้ได้',
        400
      );
    }
  }

  /**
   * ตรวจสอบว่าผู้แนะนำยังไม่เคยได้รับสิทธิ์แนะนำเพื่อนสำเร็จสำหรับร้านค้านี้
   * (กฎ UC 2.4.3: ผู้แนะนำได้รับสิทธิ์การแนะนำสำเร็จสูงสุด 1 ครั้งต่อร้านค้าตลอดอายุโครงการ)
   */
  public async assertMerchantNotYetCredited(
    referrerUserId: string,
    merchantId: string,
    excludeTransactionId?: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<void> {
    const existingRedeemed = await db.referrals.findFirst({
      where: {
        referrer_user_id: referrerUserId,
        merchant_id: merchantId,
        status: 'redeemed',
        ...(excludeTransactionId ? { transaction_id: { not: excludeTransactionId } } : {}),
      },
      select: { referral_id: true },
    });

    if (existingRedeemed) {
      throw new ReferralError(
        'คุณได้รับสิทธิ์แนะนำเพื่อนสำหรับร้านนี้สำเร็จครบแล้ว (จำกัด 1 สิทธิ์สำเร็จต่อ 1 ร้านค้า)',
        400
      );
    }
  }

  /**
   * ตรวจสอบว่าผู้ถูกแนะนำ (Referee) ไม่เคยชำระเงินที่ร้านค้านี้มาก่อน (ต้องเป็นลูกค้าใหม่)
   * และไม่เคยได้รับคำเชิญสำหรับร้านนี้มาก่อน (Uniqueness on referee + merchant across all referrers, pending and redeemed)
   */
  public async assertRefereeEligibleAtMerchant(
    refereeUserId: string,
    merchantId: string,
    excludeTransactionId?: string,
    db: Prisma.TransactionClient | typeof prisma = prisma,
    excludeReferralId?: string
  ): Promise<void> {
    const priorTx = await db.transactions.findFirst({
      where: {
        user_id: refereeUserId,
        merchant_id: merchantId,
        status: 'SUCCESS',
        ...(excludeTransactionId ? { transaction_id: { not: excludeTransactionId } } : {}),
      },
      select: { transaction_id: true, created_at: true },
    });

    if (priorTx) {
      throw new ReferralError(
        'ผู้ได้รับการแนะนำต้องไม่เคยชำระเงินที่ร้านค้านี้มาก่อน (เฉพาะลูกค้าใหม่ของร้านเท่านั้น)',
        400
      );
    }

    // ตรวจสอบว่ามีคำเชิญสำหรับร้านค้านี้อยู่แล้วหรือไม่ (เฉพาะสถานะ pending, accepted, และ redeemed)
    // เงื่อนไข UC 2.4.3: ผู้ได้รับการแนะนำ 1 คน สามารถมีคำเชิญที่ใช้งานอยู่หรือแปลงสิทธิ์แล้วได้เพียง 1 รายการต่อร้านค้า
    // คำเชิญที่ถูกยกเลิก (cancelled) หรือหมดอายุ (expired) จะไม่บล็อกคำเชิญใหม่ หากผู้ถูกแนะนำยังไม่เคยชำระเงินที่ร้านค้านั้นสำเร็จมาก่อน
    const existingReferral = await db.referrals.findFirst({
      where: {
        referred_user_id: refereeUserId,
        merchant_id: merchantId,
        status: { in: ['pending', 'accepted', 'redeemed'] },
        ...(excludeReferralId ? { referral_id: { not: excludeReferralId } } : {}),
        ...(excludeTransactionId ? { transaction_id: { not: excludeTransactionId } } : {}),
      },
      select: { referral_id: true, status: true, expires_at: true },
    });

    if (existingReferral) {
      // หากเป็น pending หรือ accepted แต่ expires_at ได้ล่วงเลยเวลาปัจจุบันไปแล้ว ให้ถือว่าหมดอายุ (expired) ไม่บล็อกคำเชิญใหม่
      const isExpired =
        existingReferral.status !== 'redeemed' &&
        existingReferral.expires_at !== null &&
        new Date(existingReferral.expires_at).getTime() < Date.now();

      if (!isExpired) {
        throw new ReferralError(
          'คุณได้รับคำเชิญสำหรับร้านนี้แล้ว',
          400
        );
      }
    }
  }

  /**
   * ดึงรายการร้านค้าที่ผู้ใช้เคยชำระเงินสำเร็จ และมีสิทธิ์สร้างรหัสแนะนำเพื่อน
   */
  public async getEligibleMerchantsForUser(userId: string): Promise<EligibleMerchantItem[]> {
    const transactions = await prisma.transactions.findMany({
      where: {
        user_id: userId,
        status: 'SUCCESS',
      },
      include: {
        merchants: {
          select: {
            merchant_id: true,
            shop_name: true,
            category: {
              select: {
                category_name_th: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // ดึงรายการร้านค้าที่ผู้แนะนำได้รับสิทธิ์การแนะนำสำเร็จไปแล้ว (status = 'redeemed')
    const creditedReferrals = await prisma.referrals.findMany({
      where: {
        referrer_user_id: userId,
        status: 'redeemed',
        merchant_id: { not: null },
      },
      select: { merchant_id: true },
    });
    const creditedMerchantIds = new Set(
      creditedReferrals.map((r) => r.merchant_id).filter((id): id is string => Boolean(id))
    );

    const merchantMap = new Map<string, EligibleMerchantItem>();

    for (const tx of transactions) {
      if (!tx.merchants) continue;
      const mId = tx.merchants.merchant_id;
      if (!merchantMap.has(mId)) {
        merchantMap.set(mId, {
          merchantId: mId,
          shopName: tx.merchants.shop_name,
          categoryNameTh: tx.merchants.category?.category_name_th || null,
          lastPaymentAt: tx.created_at.toISOString(),
          totalSuccessfulPayments: 1,
          isCredited: creditedMerchantIds.has(mId),
        });
      } else {
        const item = merchantMap.get(mId)!;
        item.totalSuccessfulPayments += 1;
      }
    }

    return Array.from(merchantMap.values());
  }

  /**
   * ดึงหรือสร้างรหัสคำชวนเพื่อนสำหรับร้านค้าที่กำหนด (Merchant-Based Single-Use Referral Code)
   */
  public async getOrCreateMyReferralCode(
    userId: string,
    options: CreateCustomReferralCodeInput
  ): Promise<MyReferralCodeResult> {
    const merchantId = options.merchantId;

    // 1. ตรวจสอบความมีอยู่ของร้านค้า
    const merchant = await prisma.merchants.findUnique({
      where: { merchant_id: merchantId },
      select: { merchant_id: true, shop_name: true, is_approved: true },
    });

    if (!merchant || !merchant.is_approved) {
      throw new ReferralError('ไม่พบข้อมูลร้านค้า หรือร้านค้านี้ยังไม่ได้รับการอนุมัติในระบบ', 404);
    }

    // 2. ตรวจสอบสิทธิ์ผู้แนะนำ (Referrer must have previously paid at this merchant)
    await this.assertReferrerEligibleAtMerchant(userId, merchantId);

    // 2.5 ตรวจสอบว่าผู้แนะนำได้รับสิทธิ์การแนะนำสำหรับร้านนี้สำเร็จไปแล้วหรือไม่ (จำกัด 1 สิทธิ์สำเร็จต่อ 1 ร้านค้า)
    await this.assertMerchantNotYetCredited(userId, merchantId);

    // 3. ตรวจสอบว่ามีรหัส pending ที่ยังไม่ได้ใช้งานสำหรับร้านค้านี้อยู่แล้วหรือไม่
    let referral = await prisma.referrals.findFirst({
      where: {
        referrer_user_id: userId,
        merchant_id: merchantId,
        status: 'pending',
      },
      include: {
        merchants: { select: { shop_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    // 4. ถ้ายังไม่มี ให้สร้างรหัสใหม่
    if (!referral) {
      let codeToUse = options.customCode
        ? options.customCode.trim().toUpperCase()
        : this.generateRandomCode();

      let existing = await prisma.referrals.findUnique({
        where: { referral_code: codeToUse },
      });

      if (options.customCode && existing) {
        throw new ReferralError('รหัสแนะนำเพื่อนนี้ถูกใช้งานแล้ว กรุณาระบุรหัสอื่น', 400);
      }

      while (existing) {
        codeToUse = this.generateRandomCode();
        existing = await prisma.referrals.findUnique({
          where: { referral_code: codeToUse },
        });
      }

      referral = await prisma.referrals.create({
        data: {
          referrer_user_id: userId,
          merchant_id: merchantId,
          referral_code: codeToUse,
          discount_amount: new Prisma.Decimal(0),
          status: 'pending',
          expires_at: null,
        },
        include: {
          merchants: { select: { shop_name: true } },
        },
      });
    }

    const baseUrl = process.env.CLIENT_URL || 'https://thai-please.gov.th';
    const shareUrl = `${baseUrl}/citizen/scan-copay?ref=${referral.referral_code}&merchantId=${merchantId}`;

    return {
      referralId: referral.referral_id,
      referralCode: referral.referral_code,
      discountAmount: Number(referral.discount_amount),
      shareUrl,
      status: referral.status,
      merchantId,
      shopName: referral.merchants?.shop_name || merchant.shop_name,
      expiresAt: referral.expires_at ? referral.expires_at.toISOString() : null,
      createdAt: referral.created_at.toISOString(),
    };
  }

  /**
   * ตรวจสอบความถูกต้องของรหัสคำชวนเพื่อนก่อนนำไปใช้ (Validation Contract)
   */
  public async validateReferralCode(
    rawCode: string,
    currentUserId?: string,
    merchantId?: string
  ): Promise<ReferralValidationResult> {
    const cleanCode = rawCode.trim().toUpperCase();

    const referral = await prisma.referrals.findUnique({
      where: { referral_code: cleanCode },
      include: {
        users_referrals_referrer_user_idTousers: {
          select: { full_name: true },
        },
        merchants: {
          select: { merchant_id: true, shop_name: true, is_approved: true },
        },
      },
    });

    if (!referral) {
      throw new ReferralError('ไม่พบรหัสแนะนำเพื่อนนี้ในระบบ', 404);
    }

    if (referral.status === 'redeemed') {
      throw new ReferralError('รหัสแนะนำเพื่อนนี้ถูกใช้งานไปแล้ว', 400);
    }

    if (referral.expires_at && new Date(referral.expires_at).getTime() < Date.now()) {
      throw new ReferralError('รหัสแนะนำเพื่อนนี้หมดอายุแล้ว', 400);
    }

    if (currentUserId && referral.referrer_user_id === currentUserId) {
      throw new ReferralError('ไม่สามารถใช้รหัสแนะนำเพื่อนของตนเองได้', 400);
    }

    if (!referral.merchant_id) {
      throw new ReferralError('รหัสคำชวนนี้ไม่ได้ผูกกับร้านค้าที่กำหนด', 400);
    }

    if (merchantId && referral.merchant_id !== merchantId) {
      throw new ReferralError(
        `รหัสแนะนำเพื่อนนี้สามารถใช้ได้เฉพาะกับร้าน "${referral.merchants?.shop_name || 'ที่กำหนด'}" เท่านั้น`,
        400
      );
    }

    // ตรวจสอบคุณสมบัติผู้แนะนำว่าเคยจ่ายเงินที่ร้านนี้จริงหรือไม่
    await this.assertReferrerEligibleAtMerchant(
      referral.referrer_user_id,
      referral.merchant_id
    );

    // ตรวจสอบว่าผู้แนะนำได้รับสิทธิ์การแนะนำสำหรับร้านค้านี้สำเร็จไปแล้วหรือไม่ (ปฏิเสธรหัสคำชวนเก่าหากร้านนี้สำเร็จแล้ว)
    await this.assertMerchantNotYetCredited(
      referral.referrer_user_id,
      referral.merchant_id
    );

    // หากระบุ currentUserId ให้ตรวจสอบว่า Referee มีสิทธิ์สำหรับร้านนี้หรือไม่
    if (currentUserId) {
      await this.assertRefereeEligibleAtMerchant(
        currentUserId,
        referral.merchant_id,
        undefined,
        prisma,
        referral.referral_id
      );
    }

    const referrerFullName = referral.users_referrals_referrer_user_idTousers.full_name;
    const maskedReferrer = this.maskName(referrerFullName);
    const discountAmount = 0; // Referees receive NO coupon or referral discount

    return {
      referralCode: referral.referral_code,
      isValid: true,
      discountAmount,
      referrerName: maskedReferrer,
      merchantId: referral.merchant_id,
      shopName: referral.merchants?.shop_name || 'ร้านค้าโครงการ',
      sourceDescription: `รหัสคำชวนเพื่อนจาก ${maskedReferrer}`,
      expiresAt: referral.expires_at ? referral.expires_at.toISOString() : null,
    };
  }

  /**
   * บันทึกการแนะนำเพื่อนที่สำเร็จอย่างปลอดภัยใน Transaction (Idempotent)
   * รางวัลสำหรับการแนะนำเพื่อนจะมอบผ่านภารกิจที่เปิดใช้งานเท่านั้น
   */
  public async processReferralConversion(params: {
    referralCode: string;
    refereeUserId: string;
    merchantId: string;
    transactionId: string;
  }): Promise<ReferralConversionResult> {
    const cleanCode = params.referralCode.trim().toUpperCase();

    return await prisma.$transaction(async (tx) => {
      // 1. ค้นหาและ Lock แถวของ referral code
      const lockedRows = await tx.$queryRaw<any[]>`
        SELECT referral_id, referrer_user_id, referred_user_id, merchant_id, transaction_id, status, discount_amount, referral_code
        FROM referrals
        WHERE referral_code = ${cleanCode}
        FOR UPDATE
      `;

      if (!lockedRows || lockedRows.length === 0) {
        throw new ReferralError('ไม่พบรหัสแนะนำเพื่อนนี้ในระบบ', 404);
      }

      const referral = lockedRows[0];
      const alreadyRedeemedForTransaction =
        referral.status === 'redeemed' && referral.transaction_id === params.transactionId;

      if (
        alreadyRedeemedForTransaction &&
        referral.referred_user_id &&
        referral.referred_user_id !== params.refereeUserId
      ) {
        throw new ReferralError('Referral conversion does not match the completed transaction', 409);
      }

      if (referral.status === 'redeemed' && !alreadyRedeemedForTransaction) {
        throw new ReferralError('รหัสแนะนำเพื่อนนี้ถูกใช้งานไปแล้ว', 400);
      }

      // ตรวจสอบเงื่อนไข Self-referral
      if (referral.referrer_user_id === params.refereeUserId) {
        throw new ReferralError('ไม่สามารถใช้รหัสแนะนำเพื่อนของตนเองได้', 400);
      }

      // ตรวจสอบร้านค้า
      if (referral.merchant_id !== params.merchantId) {
        throw new ReferralError('รหัสแนะนำเพื่อนนี้ใช้สำหรับร้านค้าอื่น ไม่ตรงกับร้านที่ชำระเงิน', 400);
      }

      // ตรวจสอบว่าผู้แนะนำเคยจ่ายเงินสำเร็จที่ร้านนี้จริง
      await this.assertReferrerEligibleAtMerchant(
        referral.referrer_user_id,
        referral.merchant_id,
        tx
      );

      // ตรวจสอบว่าผู้แนะนำได้รับสิทธิ์การแนะนำสำหรับร้านนี้ไปแล้วหรือไม่ (จำกัด 1 สิทธิ์สำเร็จต่อ 1 ร้านค้าตลอดอายุโครงการ)
      // ป้องกัน concurrent conversions ไม่ให้เคลมสิทธิ์ร้านเดิมซ้ำซ้อน
      await this.assertMerchantNotYetCredited(
        referral.referrer_user_id,
        referral.merchant_id,
        params.transactionId,
        tx
      );

      // ตรวจสอบการทับซ้อนของคำเชิญจากผู้แนะนำคนอื่น (Competing Referrers)
      const competingReferral = await tx.referrals.findFirst({
        where: {
          referred_user_id: params.refereeUserId,
          merchant_id: referral.merchant_id,
          referral_id: { not: referral.referral_id },
          status: { in: ['pending', 'accepted', 'redeemed'] },
        },
        select: { referral_id: true, status: true, expires_at: true },
      });

      if (competingReferral) {
        const isCompetingExpired =
          competingReferral.status !== 'redeemed' &&
          competingReferral.expires_at !== null &&
          new Date(competingReferral.expires_at).getTime() < Date.now();

        if (!isCompetingExpired) {
          throw new ReferralError('คุณได้รับคำเชิญสำหรับร้านนี้แล้ว', 400);
        }
      }

      // ตรวจสอบว่าผู้ถูกแนะนำไม่เคยจ่ายเงินสำเร็จที่ร้านนี้มาก่อน และไม่ได้รับคำเชิญร้านนี้ซ้ำ
      await this.assertRefereeEligibleAtMerchant(
        params.refereeUserId,
        referral.merchant_id,
        params.transactionId,
        tx,
        referral.referral_id
      );

      // 3. อัปเดต referral เมื่อ checkout ยังไม่ได้ทำเครื่องหมายว่าใช้แล้ว
      const completedAt = new Date();
      if (!alreadyRedeemedForTransaction) {
        await tx.referrals.update({
          where: { referral_id: referral.referral_id },
          data: {
            status: 'redeemed',
            referred_user_id: params.refereeUserId,
            transaction_id: params.transactionId,
            converted_at: completedAt,
            updated_at: completedAt,
          },
        });
      } else if (!referral.referred_user_id) {
        await tx.referrals.update({
          where: { referral_id: referral.referral_id },
          data: { referred_user_id: params.refereeUserId },
        });
      }

      return {
        success: true,
        referralId: referral.referral_id,
        referralCode: referral.referral_code,
        referrerUserId: referral.referrer_user_id,
        refereeUserId: params.refereeUserId,
        merchantId: referral.merchant_id,
        transactionId: params.transactionId,
        referrerMilestoneCoupons: [],
      };
    });
  }

  /**
   * ดึงสถิติคำชวนเพื่อนและประวัติเพื่อน (Dashboard API)
   */
  public async getReferralStats(
    userId: string,
    merchantIdFilter?: string
  ): Promise<ReferralStatsResult> {
    let merchantName: string | null = null;
    let selectedMerchantId: string | null = merchantIdFilter || null;

    if (selectedMerchantId) {
      const merchant = await prisma.merchants.findUnique({
        where: { merchant_id: selectedMerchantId },
        select: { shop_name: true },
      });
      merchantName = merchant?.shop_name || null;
    } else {
      // หากไม่ระบุ ให้ค้นหาร้านแรกที่ผู้ใช้มีสิทธิ์
      const eligible = await this.getEligibleMerchantsForUser(userId);
      if (eligible.length > 0) {
        selectedMerchantId = eligible[0].merchantId;
        merchantName = eligible[0].shopName;
      }
    }

    // 1. ดึงสถานะการได้รับสิทธิ์ และรหัส Active Pending สำหรับร้านที่เลือก
    let activeReferralCode: string | null = null;
    let shareUrl: string | null = null;
    let isUserReferredAtThisMerchant = false;
    let isMerchantCredited = false;

    if (selectedMerchantId) {
      const creditedReferral = await prisma.referrals.findFirst({
        where: {
          referrer_user_id: userId,
          merchant_id: selectedMerchantId,
          status: 'redeemed',
        },
        select: { referral_id: true },
      });
      isMerchantCredited = Boolean(creditedReferral);

      const myReceivedReferral = await prisma.referrals.findFirst({
        where: {
          referred_user_id: userId,
          merchant_id: selectedMerchantId,
          status: { in: ['pending', 'accepted', 'redeemed'] },
        },
        select: { referral_id: true },
      });
      isUserReferredAtThisMerchant = !!myReceivedReferral;

      // หากร้านค้านี้ยังไม่ถูกเคลมสิทธิ์ (ยังไม่ credited) ให้ดึงรหัส pending เพื่อแชร์
      if (!isMerchantCredited) {
        const activeReferral = await prisma.referrals.findFirst({
          where: {
            referrer_user_id: userId,
            merchant_id: selectedMerchantId,
            status: 'pending',
          },
          orderBy: { created_at: 'desc' },
        });

        if (activeReferral) {
          activeReferralCode = activeReferral.referral_code;
          const baseUrl = process.env.CLIENT_URL || 'https://thai-please.gov.th';
          shareUrl = `${baseUrl}/citizen/scan-copay?ref=${activeReferral.referral_code}&merchantId=${selectedMerchantId}`;
        }
      }
    }

    // 2. ดึงรายการคำชวนทั้งหมดของผู้ใช้ (รวมทุกร้านค้า เพื่อแสดงประวัติการแนะนำเพื่อนโดยรวม)
    const allReferrals = await prisma.referrals.findMany({
      where: {
        referrer_user_id: userId,
      },
      orderBy: [
        { converted_at: 'desc' },
        { created_at: 'desc' },
      ],
      include: {
        merchants: { select: { shop_name: true } },
        users_referrals_referred_user_idTousers: { select: { full_name: true } },
        transactions: {
          select: {
            users: { select: { full_name: true } },
          },
        },
      },
    });

    const totalInvited = allReferrals.length;
    let totalRedeemed = 0;
    let totalPending = 0;

    const invitedFriends: ReferralFriendItem[] = allReferrals.map((r) => {
      const isRedeemed = r.status === 'redeemed';
      const isExpired = Boolean(r.expires_at && new Date(r.expires_at).getTime() < Date.now());
      const status: 'pending' | 'redeemed' | 'expired' = isRedeemed
        ? 'redeemed'
        : isExpired
        ? 'expired'
        : 'pending';

      if (isRedeemed) {
        totalRedeemed += 1;
      } else {
        totalPending += 1;
      }

      const friendRawName =
        r.transactions?.users?.full_name ||
        r.users_referrals_referred_user_idTousers?.full_name ||
        null;

      const friendName = friendRawName
        ? this.maskName(friendRawName)
        : isRedeemed
        ? 'เพื่อนผู้ร่วมโครงการ'
        : 'รอเพื่อนชำระเงินที่ร้านค้า';

      return {
        referralId: r.referral_id,
        referralCode: r.referral_code,
        friendName,
        status,
        discountAmount: Number(r.discount_amount),
        merchantId: r.merchant_id,
        merchantName: r.merchants?.shop_name || null,
        invitedAt: r.created_at.toISOString(),
        redeemedAt: r.converted_at ? r.converted_at.toISOString() : null,
      };
    });

    // 3. นับร้านค้าที่มีเพื่อนชำระเงินสำเร็จ เพื่อแสดงสถิติ referral
    const distinctSuccessfulMerchants = await prisma.referrals.findMany({
      where: {
        referrer_user_id: userId,
        status: 'redeemed',
        merchant_id: { not: null },
      },
      select: { merchant_id: true },
      distinct: ['merchant_id'],
    });

    const totalSuccessfulMerchants = distinctSuccessfulMerchants.length;
    return {
      merchantId: selectedMerchantId,
      merchantName,
      activeReferralCode,
      shareUrl,
      isUserReferredAtThisMerchant,
      isMerchantCredited,
      summary: {
        totalInvited,
        totalRedeemed,
        totalPending,
        totalSuccessfulMerchants,
      },
      invitedFriends,
    };
  }
}

export const referralService = new ReferralService();
