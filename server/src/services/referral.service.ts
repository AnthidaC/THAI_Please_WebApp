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
  merchantId?: string | null;
  shopName?: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ReferralFriendItem {
  referralId: string;
  referralCode: string;
  friendName: string;
  status: 'pending' | 'redeemed' | 'expired';
  discountAmount: number;
  merchantName: string | null;
  invitedAt: string;
  redeemedAt: string | null;
}

export interface ReferralStatsResult {
  activeReferralCode: string | null;
  shareUrl: string | null;
  summary: {
    totalInvited: number;
    totalRedeemed: number;
    totalPending: number;
    totalDiscountGiven: number;
  };
  invitedFriends: ReferralFriendItem[];
}

export interface ReferralValidationResult {
  referralCode: string;
  isValid: boolean;
  discountAmount: number;
  referrerName: string;
  merchantId: string | null;
  shopName: string | null;
  sourceDescription: string;
  expiresAt: string | null;
}

const DEFAULT_DISCOUNT_AMOUNT = 30.0;

export class ReferralService {
  /**
   * ซ่อนข้อมูลชื่อเพื่อนหรือผู้ชวนเพื่อความเป็นส่วนตัว (Privacy-preserving Masking)
   * ตัวอย่าง: "สมชาย ใจดี" -> "สมชาย ใ***"
   */
  private maskName(fullName: string): string {
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
   * สุ่มสร้างรหัส Referral Code สไตล์โครงการ THAI Please
   * ตัวอย่าง: TP-8F3K9A
   */
  private generateRandomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `TP-${suffix}`;
  }

  /**
   * ดึงหรือสร้างรหัสคำชวนเพื่อนสำหรับผู้ใช้งาน (Single-Use per code ตาม Schema)
   */
  public async getOrCreateMyReferralCode(
    userId: string,
    options?: CreateCustomReferralCodeInput
  ): Promise<MyReferralCodeResult> {
    // 1. ตรวจสอบว่าผู้ใช้มีโค้ดที่สถานะยังว่าง (pending) อยู่หรือไม่
    let referral = await prisma.referrals.findFirst({
      where: {
        referrer_user_id: userId,
        status: 'pending',
      },
      include: {
        merchants: {
          select: { shop_name: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // 2. ถ้ายังไม่มี หรือโค้ดเดิมถูกใช้ไปแล้ว ให้สร้างโค้ดใหม่
    if (!referral) {
      let codeToUse = options?.customCode ? options.customCode.trim().toUpperCase() : this.generateRandomCode();

      // ตรวจสอบความซ้ำซ้อนในระดับฐานข้อมูล
      let existing = await prisma.referrals.findUnique({
        where: { referral_code: codeToUse },
      });

      if (options?.customCode && existing) {
        throw new ReferralError('รหัสแนะนำเพื่อนนี้ถูกใช้งานแล้ว กรุณาระบุรหัสอื่น', 400);
      }

      // หากเป็นการสุ่มแล้วซ้ำ ให้สุ่มใหม่จนกว่าจะไม่ซ้ำ
      while (existing) {
        codeToUse = this.generateRandomCode();
        existing = await prisma.referrals.findUnique({
          where: { referral_code: codeToUse },
        });
      }

      referral = await prisma.referrals.create({
        data: {
          referrer_user_id: userId,
          referral_code: codeToUse,
          discount_amount: DEFAULT_DISCOUNT_AMOUNT,
          merchant_id: options?.merchantId || null,
          status: 'pending',
          expires_at: null, // ตาม Schema ให้ Nullable (ไม่มีวันหมดอายุโดยพลการ)
        },
        include: {
          merchants: {
            select: { shop_name: true },
          },
        },
      });
    }

    const appClientUrl = process.env.CLIENT_URL || 'https://thai-please.gov.th';
    const shareUrl = `${appClientUrl}/register?ref=${referral.referral_code}`;

    return {
      referralId: referral.referral_id,
      referralCode: referral.referral_code,
      discountAmount: Number(referral.discount_amount),
      shareUrl,
      status: referral.status,
      merchantId: referral.merchant_id,
      shopName: referral.merchants?.shop_name || null,
      expiresAt: referral.expires_at ? referral.expires_at.toISOString() : null,
      createdAt: referral.created_at.toISOString(),
    };
  }

  /**
   * ดึงสถิติ Dashboard การแนะนำเพื่อนทั้งหมดของผู้ใช้งาน (Citizen Referral Dashboard)
   */
  public async getReferralStats(userId: string): Promise<ReferralStatsResult> {
    // 1. ดึงโค้ดที่กำลัง Active (ถ้ามี)
    const activeReferral = await prisma.referrals.findFirst({
      where: {
        referrer_user_id: userId,
        status: 'pending',
      },
      orderBy: { created_at: 'desc' },
    });

    const appClientUrl = process.env.CLIENT_URL || 'https://thai-please.gov.th';
    const shareUrl = activeReferral
      ? `${appClientUrl}/register?ref=${activeReferral.referral_code}`
      : null;

    // 2. ดึงประวัติคำชวนทั้งหมดของผู้ใช้ พร้อมดึงชื่อเพื่อนผ่าน transactions.users
    const allReferrals = await prisma.referrals.findMany({
      where: { referrer_user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        merchants: {
          select: { shop_name: true },
        },
        users_referrals_referred_user_idTousers: {
          select: { full_name: true },
        },
        transactions: {
          select: {
            users: {
              select: { full_name: true },
            },
          },
        },
      },
    });

    const totalInvited = allReferrals.length;
    let totalRedeemed = 0;
    let totalPending = 0;
    let totalDiscountGiven = 0;

    const invitedFriends: ReferralFriendItem[] = allReferrals.map((r) => {
      const isRedeemed = r.status === 'redeemed';
      const isExpired = Boolean(r.expires_at && new Date(r.expires_at).getTime() < Date.now());
      const status: 'pending' | 'redeemed' | 'expired' = isRedeemed
        ? 'redeemed'
        : isExpired
        ? 'expired'
        : 'pending';

      const discount = Number(r.discount_amount);
      if (isRedeemed) {
        totalRedeemed += 1;
        totalDiscountGiven += discount;
      } else {
        totalPending += 1;
      }

      // ดึงชื่อเพื่อน: ถ้ามี transaction ให้ดึงจากผู้ทำธุรกรรม หรือดึงจาก referred_user_id
      const actualFriendName =
        r.transactions?.users?.full_name ||
        r.users_referrals_referred_user_idTousers?.full_name ||
        null;

      const friendName = actualFriendName
        ? this.maskName(actualFriendName)
        : isRedeemed
        ? 'เพื่อนผู้ร่วมโครงการ'
        : 'รอเพื่อนลงทะเบียนและใช้สิทธิ์';

      return {
        referralId: r.referral_id,
        referralCode: r.referral_code,
        friendName,
        status,
        discountAmount: discount,
        merchantName: r.merchants?.shop_name || null,
        invitedAt: r.created_at.toISOString(),
        redeemedAt: r.converted_at ? r.converted_at.toISOString() : null,
      };
    });

    return {
      activeReferralCode: activeReferral ? activeReferral.referral_code : null,
      shareUrl,
      summary: {
        totalInvited,
        totalRedeemed,
        totalPending,
        totalDiscountGiven,
      },
      invitedFriends,
    };
  }

  /**
   * ตรวจสอบความถูกต้องของรหัสแนะนำเพื่อนก่อนนำไปใช้ลดราคา (ตรงกับมาตรฐาน Payment Engine)
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
          select: { shop_name: true },
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

    // ตรวจสอบเงื่อนไขร้านค้า (ถ้าโค้ดนี้ระบุร้านเฉพาะ)
    if (referral.merchant_id && merchantId && referral.merchant_id !== merchantId) {
      throw new ReferralError(
        `รหัสแนะนำเพื่อนนี้สามารถใช้ได้เฉพาะกับร้าน ${referral.merchants?.shop_name || 'ที่กำหนด'} เท่านั้น`,
        400
      );
    }

    const referrerFullName = referral.users_referrals_referrer_user_idTousers.full_name;
    const maskedReferrer = this.maskName(referrerFullName);
    const discountAmount = Number(referral.discount_amount);

    return {
      referralCode: referral.referral_code,
      isValid: true,
      discountAmount,
      referrerName: maskedReferrer,
      merchantId: referral.merchant_id,
      shopName: referral.merchants?.shop_name || null,
      sourceDescription: `ส่วนลด ฿${discountAmount.toFixed(0)} จากคำชวนของ ${maskedReferrer}`,
      expiresAt: referral.expires_at ? referral.expires_at.toISOString() : null,
    };
  }
}

export const referralService = new ReferralService();
