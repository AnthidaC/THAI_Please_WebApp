import prisma from '../utils/prisma';

export class TransactionService {
  /**
   * ดึงประวัติการสั่งซื้อและสิทธิการประเมินรีวิวของประชาชน
   */
  public async getBuyerHistory(userId: string) {
    const transactions = await prisma.transactions.findMany({
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
    });

    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    return transactions.map((tx: any) => {
      const createdAtMs = new Date(tx.created_at).getTime();
      const isWithin24Hours = now - createdAtMs <= twentyFourHoursMs;
      const hasReview = Boolean(tx.reviews);
      const isEligibleForReview = tx.status === 'SUCCESS' && isWithin24Hours && !hasReview;

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
  }

  /**
   * เรียกดูสรุปยอดขาย ประวัติการขาย และยอดเงินอุดหนุนรัฐของร้านค้า
   */
  public async getMerchantHistory(merchantId?: string) {
    // หากไม่ระบุ merchantId ให้ใช้ร้านแรก หรือค้นหาร้านที่ได้รับความนิยม
    let targetMerchantId = merchantId;
    if (!targetMerchantId) {
      const firstMerchant = await prisma.merchants.findFirst();
      if (!firstMerchant) {
        return {
          merchant: null,
          summary: {
            totalRevenue: 0,
            governmentSubsidyTotal: 0,
            citizenPaidTotal: 0,
            totalTransactions: 0,
          },
          transactions: [],
        };
      }
      targetMerchantId = firstMerchant.merchant_id;
    }

    const merchant = await prisma.merchants.findUnique({
      where: { merchant_id: targetMerchantId },
    });

    const transactions = await prisma.transactions.findMany({
      where: { merchant_id: targetMerchantId },
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

    const mappedTransactions = transactions.map((tx: any) => {
      const total = Number(tx.total_amount);
      const gov = Number(tx.government_copay_amount);
      const cit = Number(tx.citizen_paid_amount);

      if (tx.status === 'SUCCESS') {
        totalRevenue += total;
        governmentSubsidyTotal += gov;
        citizenPaidTotal += cit;
      }

      return {
        transactionId: tx.transaction_id,
        qrReference: tx.qr_reference,
        customerName: tx.users.full_name,
        totalAmount: total,
        governmentCopayAmount: gov,
        citizenPaidAmount: cit,
        status: tx.status,
        createdAt: tx.created_at.toISOString(),
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
        totalTransactions: transactions.length,
      },
      transactions: mappedTransactions,
    };
  }

  /**
   * ดึงข้อมูลหลักฐานการชำระเงิน (e-Slip) สำหรับออกใบเสร็จ
   */
  public async getTransactionSlip(transactionId: string) {
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
      },
    });

    if (!tx) {
      throw new Error('ไม่พบข้อมูลรายการทำธุรกรรม');
    }

    return {
      slipId: `SLIP-${tx.transaction_id.substring(0, 8).toUpperCase()}`,
      transactionId: tx.transaction_id,
      qrReference: tx.qr_reference,
      customerName: tx.users.full_name,
      shopName: tx.merchants.shop_name,
      merchantTaxId: tx.merchants.tax_id,
      totalAmount: Number(tx.total_amount),
      governmentCopayAmount: Number(tx.government_copay_amount),
      citizenPaidAmount: Number(tx.citizen_paid_amount),
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
