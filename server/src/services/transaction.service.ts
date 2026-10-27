import prisma from '../utils/prisma';
import { thaiDayRange } from '../utils/thai-date';

export class TransactionService {
  /**
   * ดึงประวัติการสั่งซื้อ การเติมเงินกระเป๋า และสิทธิการประเมินรีวิวของประชาชน
   */
  public async getBuyerHistory(userId: string) {
    const [transactions, userWallet] = await Promise.all([
      prisma.transactions.findMany({
        where: { user_id: userId },
        include: {
          merchants: {
            select: {
              merchant_id: true,
              shop_name: true,
              average_rating_stars: true,
            },
          },
          reviews: true,
          fraud_checks: true,
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.wallets.findUnique({
        where: { user_id: userId },
        include: {
          wallet_transactions: {
            where: {
              transaction_type: { in: ['TOPUP', 'REFUND'] },
            },
            orderBy: { created_at: 'desc' },
          },
        },
      }),
    ]);

    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    // กรองเฉพาะธุรกรรมที่มีการทำรายการชำระเงินจริง (ไม่นำ Silent Log จากการสแกนพิกัดไกลเกิน 2 กม. ที่ยอดชำระ 0 บาท มาปะปนในหน้ากระเป๋าประชาชน)
    const copayHistory = transactions
      .filter((tx: any) => !(tx.status === 'REJECTED' && Number(tx.citizen_paid_amount) === 0))
      .map((tx: any) => {
        const createdAtMs = new Date(tx.created_at).getTime();
        const isWithin24Hours = now - createdAtMs <= twentyFourHoursMs;
        const hasReview = Boolean(tx.reviews);
        const isEligibleForReview =
          (tx.status === 'SUCCESS' || tx.status === 'FLAGGED') && isWithin24Hours && !hasReview;

        return {
          transactionId: tx.transaction_id,
          qrReference: tx.qr_reference,
          merchantId: tx.merchant_id,
          shopName: tx.merchants.shop_name,
          merchantRating: Number(tx.merchants.average_rating_stars),
          totalAmount: Number(tx.total_amount),
          governmentCopayAmount: Number(tx.government_copay_amount),
          citizenPaidAmount: Number(tx.citizen_paid_amount),
          status: tx.status,
          transactionType: 'COPAY' as const,
          createdAt: tx.created_at.toISOString(),
          completedAt: tx.completed_at ? tx.completed_at.toISOString() : null,
          isEligibleForReview,
          hasReview,
          reviewExpiresAt: new Date(createdAtMs + twentyFourHoursMs).toISOString(),
          fraudCheck: tx.fraud_checks
            ? {
                distanceMeters: Number(tx.fraud_checks.distance_meters),
                decision: tx.fraud_checks.decision,
                riskScore: Number(tx.fraud_checks.risk_score),
              }
            : null,
        };
      });

    // รวมรายการเติมเงินเข้ากระเป๋า (TOPUP) และเงินคืน (REFUND)
    const walletTopUps = (userWallet?.wallet_transactions || []).map((wtx: any) => {
      const isRefund = wtx.transaction_type === 'REFUND';
      const amt = Number(wtx.amount);
      return {
        transactionId: wtx.transaction_id || wtx.wallet_transaction_id,
        qrReference: wtx.reference_number || undefined,
        merchantId: 'wallet-system',
        shopName: isRefund
          ? 'คืนเงินเข้ากระเป๋า (รายการถูกยกเลิก)'
          : `เติมเงินเข้ากระเป๋า (${wtx.payment_channel || 'PROMPTPAY'})`,
        merchantRating: 5.0,
        totalAmount: amt,
        governmentCopayAmount: 0,
        citizenPaidAmount: amt,
        status: 'SUCCESS',
        transactionType: (isRefund ? 'REFUND' : 'TOPUP') as 'TOPUP' | 'REFUND',
        paymentChannel: wtx.payment_channel || 'PROMPTPAY',
        createdAt: wtx.created_at.toISOString(),
        completedAt: wtx.created_at.toISOString(),
        isEligibleForReview: false,
        hasReview: false,
        reviewExpiresAt: wtx.created_at.toISOString(),
        fraudCheck: null,
      };
    });

    return [...copayHistory, ...walletTopUps].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * เรียกดูสรุปยอดขาย ประวัติการขาย และยอดเงินอุดหนุนรัฐของร้านค้า
   */
  public async getMerchantHistory(merchantId: string, date?: string) {
    const targetMerchantId = merchantId;
    if (!targetMerchantId) throw new Error('ไม่พบร้านค้าที่ผูกกับบัญชี');
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(`${date}T00:00:00+07:00`)) ||
        new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) {
      throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
    }
    const range = date ? thaiDayRange(new Date(`${date}T12:00:00+07:00`)) : null;

    const merchant = await prisma.merchants.findUnique({
      where: { merchant_id: targetMerchantId },
    });

    const transactions = await prisma.transactions.findMany({
      where: { merchant_id: targetMerchantId, ...(range ? { created_at: { gte: range.start, lt: range.end } } : {}) },
      include: {
        users: {
          select: {
            user_id: true,
            full_name: true,
          },
        },
        fraud_checks: true,
      },
      orderBy: { created_at: 'desc' },
    });

    let totalRevenue = 0;
    let governmentSubsidyTotal = 0;
    let citizenPaidTotal = 0;
    let validSalesCount = 0;

    const mappedTransactions = transactions.map((tx: any) => {
      const total = Number(tx.total_amount);
      const gov = Number(tx.government_copay_amount);
      const cit = Number(tx.citizen_paid_amount);

      // นโยบาย: AI ไม่บล็อกร้านค้าทันที ดังนั้นทั้ง SUCCESS และ FLAGGED นับเป็นยอดขายของร้านค้า (ยกเว้น REJECTED)
      if (tx.status === 'SUCCESS' || tx.status === 'FLAGGED') {
        totalRevenue += total;
        governmentSubsidyTotal += gov;
        citizenPaidTotal += cit;
        validSalesCount += 1;
      }

      return {
        transactionId: tx.transaction_id,
        qrReference: tx.qr_reference,
        customerName: tx.users ? tx.users.full_name : 'ผู้ใช้งานในระบบ',
        totalAmount: total,
        governmentCopayAmount: gov,
        citizenPaidAmount: cit,
        status: tx.status,
        createdAt: tx.created_at.toISOString(),
        fraudReason: tx.fraud_checks?.fraud_reason || null,
        distanceMeters: tx.fraud_checks ? Number(tx.fraud_checks.distance_meters) : null,
      };
    });

    return {
      merchant: merchant
        ? {
            merchantId: merchant.merchant_id,
            shopName: merchant.shop_name,
            taxId: merchant.tax_id,
            averageRatingStars: Number(merchant.average_rating_stars),
            latitude: Number(merchant.latitude),
            longitude: Number(merchant.longitude),
          }
        : null,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        governmentSubsidyTotal: Math.round(governmentSubsidyTotal * 100) / 100,
        citizenPaidTotal: Math.round(citizenPaidTotal * 100) / 100,
        totalTransactions: validSalesCount,
      },
      transactions: mappedTransactions,
    };
  }

  /**
   * ดึงข้อมูลหลักฐานการชำระเงิน (e-Slip) สำหรับออกใบเสร็จ
   */
  public async getTransactionSlip(transactionId: string, userId: string) {
    const tx = await prisma.transactions.findUnique({
      where: { transaction_id: transactionId },
      include: {
        merchants: true,
        users: {
          select: {
            user_id: true,
            full_name: true,
          },
        },
        fraud_checks: true,
        referrals: true,
        user_rewards: {
          include: { rewards: true },
        },
      },
    });

    if (!tx || tx.user_id !== userId) {
      throw new Error('ไม่พบข้อมูลรายการทำธุรกรรม');
    }

    let discountAmount = 0;
    let discountCode: string | null = null;
    let discountDescription: string | null = null;

    if (tx.referrals && tx.referrals.length > 0) {
      discountAmount = Number(tx.referrals[0].discount_amount || 0);
      discountCode = tx.referrals[0].referral_code;
      discountDescription = `ส่วนลดจากโค้ดคำชวนของเพื่อน (${discountCode})`;
    } else if (tx.user_rewards && tx.user_rewards.length > 0) {
      discountAmount = Number(tx.user_rewards[0].rewards?.discount_value || 0);
      discountCode = tx.user_rewards[0].reward_code;
      discountDescription = `คูปองส่วนลด: ${tx.user_rewards[0].rewards?.reward_name || discountCode}`;
    }

    const netAmount = Number(tx.total_amount);
    const originalAmount = netAmount + discountAmount;

    return {
      slipId: `SLIP-${tx.transaction_id.substring(0, 8).toUpperCase()}`,
      transactionId: tx.transaction_id,
      qrReference: tx.qr_reference,
      customerName: tx.users.full_name,
      shopName: tx.merchants.shop_name,
      merchantTaxId: tx.merchants.tax_id,
      originalTotalAmount: originalAmount,
      discountAmount,
      discountCode,
      discountDescription,
      netTotalAmount: netAmount,
      totalAmount: netAmount,
      governmentCopayAmount: Number(tx.government_copay_amount),
      citizenPaidAmount: Number(tx.citizen_paid_amount),
      totalSavingsAmount: Math.round((discountAmount + Number(tx.government_copay_amount)) * 100) / 100,
      copayRatio: '60/40',
      status: tx.status,
      timestamp: (tx.completed_at || tx.created_at).toISOString(),
      securityVerification: {
        verifiedBy: 'THAI Please AI Security Guard',
        isGpsVerified: tx.fraud_checks ? tx.fraud_checks.is_distance_valid : true,
        distanceMeters: tx.fraud_checks ? Number(tx.fraud_checks.distance_meters) : 0,
        riskScore: tx.fraud_checks ? Number(tx.fraud_checks.risk_score) : 0,
        decision: tx.fraud_checks ? tx.fraud_checks.decision : 'AUTO_APPROVED',
      },
    };
  }
}

export const transactionService = new TransactionService();
