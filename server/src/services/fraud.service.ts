import prisma from '../utils/prisma';

export interface FraudFeatureVector {
  userId: string;
  merchantId: string;
  amount: number;
  userLat: number;
  userLon: number;
  merchantLat: number;
  merchantLon: number;
  distanceMeters: number;
  recentTxCountIn10Min: number;
  estimatedSpeedKmH: number;
  timeHour: number;
  repeatedSuspiciousCount?: number;
  samePairRepeatCountToday?: number;
}

export interface AiFraudAssessment {
  riskScore: number; // 0.00 to 1.00
  decision: 'AUTO_APPROVED' | 'FLAGGED_FOR_REVIEW' | 'REJECTED';
  reason: string;
  confidence: number;
  model: string;
}

// รัศมีพิกัดสูงสุดที่อนุญาตให้ทำธุรกรรมหน้าร้านได้ (ไม่เกิน 2 กิโลเมตร = 2,000 เมตร)
export const MAX_ALLOWED_DISTANCE_METERS = 2000;

/**
 * คำนวณระยะห่างระหว่างจุดพิกัด 2 จุด ด้วยสูตร Haversine Formula (หน่วย: เมตร)
 */
export const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // รัศมีโลกเฉลี่ย (เมตร)
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 100) / 100;
};

/**
 * AI Fraud Detection Client (Semi-AI Model Interface)
 * นโยบายสำคัญ:
 * - อนุญาตให้ทำธุรกรรมได้ในรัศมีไม่เกิน 2 กิโลเมตร (2,000 เมตร)
 * - AI จะไม่บล็อกผู้ใช้หรือร้านค้าทันที (ไม่ส่งค่า REJECTED เพื่อขัดจังหวะการค้าขายปกติ)
 * - แต่ AI ทำหน้าที่ตรวจจับพฤติกรรมน่าสงสัย โดยเฉพาะ "ความน่าสงสัยซ้ำๆ" (Repeated Anomalies)
 *   เพื่อส่งเรื่องให้ Admin ตรวจสอบในคิว FLAGGED_FOR_REVIEW
 */
export class AiFraudEngine {
  private static instance: AiFraudEngine;
  private externalAiEndpoint: string | null = null;
  private aiApiKey: string | null = null;

  private constructor() {
    this.externalAiEndpoint = process.env.AI_FRAUD_ENDPOINT || null;
    this.aiApiKey = process.env.AI_FRAUD_API_KEY || null;
  }

  public static getInstance(): AiFraudEngine {
    if (!AiFraudEngine.instance) {
      AiFraudEngine.instance = new AiFraudEngine();
    }
    return AiFraudEngine.instance;
  }

  /**
   * ส่ง Feature Vector ไปวิเคราะห์ผ่าน AI Engine
   */
  public async evaluate(features: FraudFeatureVector): Promise<AiFraudAssessment> {
    // 1. หากมีการกำหนด External AI Endpoint และ Key ในอนาคต ให้ต่อ API AI ทันที
    if (this.externalAiEndpoint && this.aiApiKey) {
      try {
        const response = await fetch(this.externalAiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.aiApiKey}`,
          },
          body: JSON.stringify({
            features,
            prompt: `วิเคราะห์ความเสี่ยงการทุจริตธุรกรรม Co-pay โดยไม่บล็อกผู้ใช้ทันที แต่ให้ส่งเรื่องให้ Admin เมื่อพบความน่าสงสัยซ้ำๆ (ระยะทาง ${features.distanceMeters} เมตร, ความเร็ว ${features.estimatedSpeedKmH} กม./ชม., ยอดเงิน ${features.amount} บาท, ความถี่ ${features.recentTxCountIn10Min} ครั้งใน 10 นาที, ประวัติความน่าสงสัยซ้ำ ${features.repeatedSuspiciousCount || 0} ครั้ง)`,
          }),
        });

        if (response.ok) {
          const aiResult = (await response.json()) as any;
          const rawDecision = aiResult.decision || 'AUTO_APPROVED';
          // นโยบาย: AI ไม่บล็อกทันที หาก AI ภายนอกส่ง REJECTED ให้เปลี่ยนเป็น FLAGGED_FOR_REVIEW เพื่อให้ Admin ตัดสินใจ
          const safeDecision =
            rawDecision === 'REJECTED' ? 'FLAGGED_FOR_REVIEW' : rawDecision;
          return {
            riskScore: Number(aiResult.riskScore || 0),
            decision: safeDecision,
            reason: aiResult.reason || 'AI Model ประเมินผลสำเร็จ',
            confidence: Number(aiResult.confidence || 0.95),
            model: 'external-ai-api',
          };
        }
      } catch (err) {
        console.warn('[AI Fraud Engine] External API call failed, falling back to Local Anomaly Evaluator:', err);
      }
    }

    // 2. Intelligent Semi-AI Anomaly Scoring Engine (Local Multi-factor Model)
    const repeatSuspicious = features.repeatedSuspiciousCount ?? 0;
    const samePairRepeats = features.samePairRepeatCountToday ?? 1;

    // คำนวณน้ำหนักความเสี่ยงแต่ละมิติ
    const distanceRiskWeight = Math.min(1.0, features.distanceMeters / MAX_ALLOWED_DISTANCE_METERS);
    const speedRiskWeight = Math.min(1.0, features.estimatedSpeedKmH / 120);
    const frequencyRiskWeight = Math.min(1.0, Math.max(0, features.recentTxCountIn10Min - 1) / 3);
    const repeatOffenseWeight = Math.min(1.0, (repeatSuspicious * 0.35) + Math.max(0, samePairRepeats - 2) * 0.25);
    const amountRiskWeight = features.amount > 1500 ? 0.25 : 0.05;

    // คำนวณความเสี่ยงรวมแบบ Multi-factor Weighted Anomaly Score
    const combinedAnomalyScore =
      distanceRiskWeight * 0.30 +
      repeatOffenseWeight * 0.30 +
      frequencyRiskWeight * 0.20 +
      speedRiskWeight * 0.15 +
      amountRiskWeight * 0.05;

    const roundedScore = Math.min(0.99, Math.max(0.01, Math.round(combinedAnomalyScore * 100) / 100));

    let decision: 'AUTO_APPROVED' | 'FLAGGED_FOR_REVIEW' = 'AUTO_APPROVED';
    const reasons: string[] = [];

    if (repeatSuspicious >= 2) {
      reasons.push(`ตรวจพบประวัติความน่าสงสัยซ้ำสะสม (${repeatSuspicious} ครั้ง) จากบัญชีผู้ใช้หรือร้านค้านี้`);
    }

    if (samePairRepeats >= 3) {
      reasons.push(`ผู้ใช้สแกนชำระเงินซ้ำกับร้านค้าเดิม ${samePairRepeats} ครั้งภายในวันเดียวกัน (สงสัยการซอยบิล)`);
    }

    if (features.recentTxCountIn10Min >= 3) {
      reasons.push(`ความถี่ในการทำธุรกรรมซ้ำสูงผิดปกติ (${features.recentTxCountIn10Min} ครั้งภายใน 10 นาที)`);
    }

    if (features.distanceMeters > 1500) {
      reasons.push(`พิกัดผู้ซื้อห่างจากร้านค้า ${Math.round(features.distanceMeters)} เมตร (ใกล้ขอบรัศมี 2 กม. ที่กำหนด)`);
    }

    if (features.estimatedSpeedKmH > 90) {
      reasons.push(`ตรวจพบการเคลื่อนที่ข้ามพิกัดรวดเร็วผิดปกติ (${Math.round(features.estimatedSpeedKmH)} กม./ชม.)`);
    }

    // AI ไม่บล็อกผู้ใช้หรือร้านค้าทันที แต่ส่งเรื่องให้ Admin ตรวจสอบเมื่อมีพฤติกรรมน่าสงสัยซ้ำๆ หรือคะแนนความเสี่ยงถึงเกณฑ์
    const isSuspiciousForAdmin =
      roundedScore >= 0.45 ||
      repeatSuspicious >= 2 ||
      samePairRepeats >= 3 ||
      features.recentTxCountIn10Min >= 3 ||
      features.distanceMeters > 1500 ||
      features.estimatedSpeedKmH > 90;

    if (isSuspiciousForAdmin) {
      decision = 'FLAGGED_FOR_REVIEW';
      if (reasons.length === 0) {
        reasons.push('AI ตรวจพบรูปแบบพฤติกรรมน่าสงสัยซ้ำซ้อน จึงส่งเรื่องให้ผู้ดูแลระบบตรวจสอบ');
      }
    } else {
      decision = 'AUTO_APPROVED';
      reasons.push('พิกัดอยู่ในรัศมี 2 กม. และไม่พบรูปแบบความน่าสงสัยซ้ำ');
    }

    return {
      riskScore: roundedScore,
      decision,
      reason: reasons.join(' • '),
      confidence: 0.94,
      model: 'semi-ai-anomaly-detector-v2',
    };
  }
}

export class FraudService {
  private aiEngine = AiFraudEngine.getInstance();

  /**
   * ตรวจสอบธุรกรรมและสร้าง Feature Vector เพื่อให้ AI วิเคราะห์พฤติกรรมซ้ำๆ
   */
  public async evaluateTransaction(params: {
    userId: string;
    merchantId: string;
    amount: number;
    userLat: number;
    userLon: number;
    merchantLat: number;
    merchantLon: number;
  }): Promise<AiFraudAssessment & { distanceMeters: number }> {
    const distanceMeters = calculateHaversineDistance(
      params.userLat,
      params.userLon,
      params.merchantLat,
      params.merchantLon
    );

    const now = Date.now();
    const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. ดึงประวัติธุรกรรมล่าสุดของผู้ใช้ใน 10 นาที เพื่อดูความถี่และความเร็วการเปลี่ยนพิกัด
    const recentTx = await prisma.transactions.findMany({
      where: {
        user_id: params.userId,
        created_at: { gte: tenMinutesAgo },
      },
      include: {
        fraud_checks: true,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    // 2. นับจำนวนครั้งที่ผู้ใช้ทำรายการซ้ำกับร้านค้าเดิมในวันนี้ (ตรวจจับการซอยบิลซ้ำๆ)
    const samePairTodayCount = await prisma.transactions.count({
      where: {
        user_id: params.userId,
        merchant_id: params.merchantId,
        created_at: { gte: startOfToday },
      },
    });

    // 3. นับจำนวนประวัติความน่าสงสัยซ้ำๆ (FLAGGED_FOR_REVIEW / REJECTED) ของทั้งผู้ใช้และร้านค้า
    const [userPrevFlags, merchantPrevFlags] = await Promise.all([
      prisma.fraud_checks.count({
        where: {
          transactions: { user_id: params.userId },
          decision: { in: ['FLAGGED_FOR_REVIEW', 'REJECTED', 'REJECTED_BY_ADMIN'] },
        },
      }),
      prisma.fraud_checks.count({
        where: {
          transactions: { merchant_id: params.merchantId },
          decision: { in: ['FLAGGED_FOR_REVIEW', 'REJECTED', 'REJECTED_BY_ADMIN'] },
        },
      }),
    ]);

    let estimatedSpeedKmH = 0;
    if (recentTx.length > 0 && recentTx[0].fraud_checks) {
      const lastCheck = recentTx[0].fraud_checks;
      const lastLat = Number(lastCheck.user_latitude);
      const lastLon = Number(lastCheck.user_longitude);
      const prevDistanceMeters = calculateHaversineDistance(
        lastLat,
        lastLon,
        params.userLat,
        params.userLon
      );
      const diffHours = (now - new Date(recentTx[0].created_at).getTime()) / (1000 * 3600);
      if (diffHours > 0) {
        estimatedSpeedKmH = prevDistanceMeters / 1000 / diffHours;
      }
    }

    const featureVector: FraudFeatureVector = {
      userId: params.userId,
      merchantId: params.merchantId,
      amount: params.amount,
      userLat: params.userLat,
      userLon: params.userLon,
      merchantLat: params.merchantLat,
      merchantLon: params.merchantLon,
      distanceMeters,
      recentTxCountIn10Min: recentTx.length + 1,
      estimatedSpeedKmH: Math.round(estimatedSpeedKmH),
      timeHour: new Date().getHours(),
      repeatedSuspiciousCount: Math.max(userPrevFlags, merchantPrevFlags),
      samePairRepeatCountToday: samePairTodayCount + 1,
    };

    const assessment = await this.aiEngine.evaluate(featureVector);

    return {
      ...assessment,
      distanceMeters,
    };
  }

  /**
   * ดึงรายการที่ถูกส่งตรวจจับทุจริตสำหรับผู้ดูแลระบบ (Admin) พร้อมนับความถี่ซ้ำ
   */
  public async getFlaggedAlerts() {
    const [alerts, totalChecksCount, autoApprovedCount] = await Promise.all([
      prisma.fraud_checks.findMany({
        where: {
          decision: {
            in: ['FLAGGED_FOR_REVIEW', 'REJECTED'],
          },
        },
        include: {
          transactions: {
            include: {
              users: {
                select: {
                  user_id: true,
                  full_name: true,
                  province_code: true,
                  wallets: {
                    select: {
                      status: true,
                      eligibility_status: true,
                    },
                  },
                },
              },
              merchants: {
                select: {
                  merchant_id: true,
                  tax_id: true,
                  shop_name: true,
                  average_rating_stars: true,
                  is_approved: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.fraud_checks.count(),
      prisma.fraud_checks.count({
        where: {
          decision: { in: ['AUTO_APPROVED', 'MANUALLY_APPROVED'] },
        },
      }),
    ]);

    // นับความถี่ที่ผู้ใช้หรือร้านค้าปรากฏในรายการต้องสงสัยซ้ำๆ
    const userOccurrenceMap: Record<string, number> = {};
    const merchantOccurrenceMap: Record<string, number> = {};

    for (const a of alerts) {
      const uid = a.transactions?.user_id;
      const mid = a.transactions?.merchant_id;
      if (uid) userOccurrenceMap[uid] = (userOccurrenceMap[uid] || 0) + 1;
      if (mid) merchantOccurrenceMap[mid] = (merchantOccurrenceMap[mid] || 0) + 1;
    }

    const approvalRate =
      totalChecksCount > 0
        ? Math.round((autoApprovedCount / totalChecksCount) * 1000) / 10
        : 100.0;

    return alerts.map((a: any) => {
      const uid = a.transactions?.user_id;
      const mid = a.transactions?.merchant_id;
      const repeatCount = Math.max(
        uid ? userOccurrenceMap[uid] || 1 : 1,
        mid ? merchantOccurrenceMap[mid] || 1 : 1
      );

      return {
        fraudCheckId: a.fraud_check_id,
        transactionId: a.transaction_id,
        userId: uid,
        merchantId: mid,
        merchantTaxId: a.transactions.merchants?.tax_id || '-',
        isMerchantApproved: a.transactions.merchants?.is_approved ?? true,
        userWalletStatus: a.transactions.users?.wallets?.status || 'ACTIVE',
        totalAmount: Number(a.transactions.total_amount),
        copayAmount: Number(a.transactions.government_copay_amount),
        citizenPaidAmount: Number(a.transactions.citizen_paid_amount),
        customerName: a.transactions.users.full_name,
        shopName: a.transactions.merchants.shop_name,
        distanceMeters: Number(a.distance_meters),
        riskScore: Number(a.risk_score),
        fraudReason: a.fraud_reason,
        decision: a.decision,
        userLat: Number(a.user_latitude),
        userLon: Number(a.user_longitude),
        merchantLat: Number(a.merchant_latitude),
        merchantLon: Number(a.merchant_longitude),
        createdAt: a.created_at,
        repeatCount,
        systemStats: {
          totalChecksCount,
          autoApprovedCount,
          approvalRate,
        },
      };
    });
  }

  /**
   * ผู้ดูแลระบบจัดการรายการที่ถูก Flag (โดยไม่ดึงเงินคืนอัตโนมัติ เพื่อป้องกันร้านค้าเสียหายฟรีหลังส่งมอบสินค้าแล้ว)
   * รองรับ 4 มาตรการ:
   * - APPROVE: ยืนยันธุรกรรมปกติ
   * - REJECT: บันทึกเคสส่งตรวจสอบเบื้องหลัง (ไม่คืนเงินอัตโนมัติ)
   * - SUSPEND_MERCHANT: ระงับสิทธิ์ร้านค้าชั่วคราวเพื่อส่งเจ้าหน้าที่เข้าตรวจสอบร้านค้า
   * - SUSPEND_USER: ระงับสิทธิ์ Co-pay ของประชาชนที่น่าสงสัยชั่วคราว
   */
  public async resolveAlert(
    fraudCheckId: string,
    action: 'APPROVE' | 'REJECT' | 'SUSPEND_MERCHANT' | 'SUSPEND_USER',
    adminId?: string,
    note?: string
  ) {
    const fraudCheck = await prisma.fraud_checks.findUnique({
      where: { fraud_check_id: fraudCheckId },
      include: { transactions: true },
    });

    if (!fraudCheck) {
      throw new Error('ไม่พบข้อมูลรายการตรวจสอบทุจริตนี้');
    }

    const txRecord = fraudCheck.transactions;

    const decisionMap: Record<string, string> = {
      APPROVE: 'MANUALLY_APPROVED',
      REJECT: 'REJECTED_BY_ADMIN',
      SUSPEND_MERCHANT: 'MERCHANT_SUSPENDED',
      SUSPEND_USER: 'USER_SUSPENDED',
    };
    const newDecision = decisionMap[action] || 'REJECTED_BY_ADMIN';

    // ไม่ดึงเงินคืนอัตโนมัติ: คงสถานะธุรกรรมเดิมไว้เป็น SUCCESS (เมื่อชำระเงินแล้ว) หรือ REJECTED (เฉพาะรายการสแกนไม่ผ่าน 0 บาท)
    const newTxStatus =
      action === 'APPROVE'
        ? 'SUCCESS'
        : Number(txRecord?.total_amount || 0) > 0 && Number(txRecord?.citizen_paid_amount || 0) > 0
        ? 'SUCCESS'
        : 'REJECTED';

    await prisma.$transaction(async (tx: any) => {
      await tx.fraud_checks.update({
        where: { fraud_check_id: fraudCheckId },
        data: {
          decision: newDecision,
          fraud_reason: note
            ? `${fraudCheck.fraud_reason || ''} [มติ Admin (${action}): ${note}]`.slice(0, 255)
            : fraudCheck.fraud_reason,
          reviewed_by_admin_id: adminId || null,
        },
      });

      if (txRecord) {
        await tx.transactions.update({
          where: { transaction_id: fraudCheck.transaction_id },
          data: {
            status: newTxStatus,
            ...(action === 'APPROVE' && !txRecord.completed_at ? { completed_at: new Date() } : {}),
          },
        });

        // กรณี Admin สั่งระงับสิทธิ์ร้านค้าเพื่อเข้าตรวจสอบร้านค้า
        if (action === 'SUSPEND_MERCHANT' && txRecord.merchant_id) {
          await tx.merchants.update({
            where: { merchant_id: txRecord.merchant_id },
            data: {
              is_approved: false,
            },
          });
        }

        // กรณี Admin สั่งระงับสิทธิ์ประชาชนที่น่าสงสัย
        if (action === 'SUSPEND_USER' && txRecord.user_id) {
          await tx.wallets.updateMany({
            where: { user_id: txRecord.user_id },
            data: {
              status: 'SUSPENDED',
              eligibility_status: 'SUSPENDED',
            },
          });
        }
      }
    });

    return {
      success: true,
      action,
      decision: newDecision,
      transactionStatus: newTxStatus,
    };
  }
}

export const fraudService = new FraudService();

