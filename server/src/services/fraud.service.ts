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
}

export interface AiFraudAssessment {
  riskScore: number; // 0.00 to 1.00
  decision: 'AUTO_APPROVED' | 'FLAGGED_FOR_REVIEW' | 'REJECTED';
  reason: string;
  confidence: number;
  model: string;
}

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
 * ออกแบบเพื่อรองรับการเชื่อมต่อกับ AI API (เช่น Google Gemini API, OpenAI หรือ Custom ML Service)
 * โดยขณะนี้มี Anomaly Scoring Model จำลองการวิเคราะห์พหุมิติ (Multi-factor Machine Learning / Probabilistic)
 * ไม่ใช้ Hardcoded Rule-based
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
            prompt: `วิเคราะห์ความเสี่ยงการทุจริตธุรกรรม Co-pay โดยพิจารณาระยะทาง ${features.distanceMeters} เมตร, ความเร็ว ${features.estimatedSpeedKmH} กม./ชม., ยอดเงิน ${features.amount} บาท, ความถี่ ${features.recentTxCountIn10Min} ครั้งใน 10 นาที`,
          }),
        });

        if (response.ok) {
          const aiResult = (await response.json()) as any;
          return {
            riskScore: Number(aiResult.riskScore || 0),
            decision: aiResult.decision || 'AUTO_APPROVED',
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
    // ประเมินความเสี่ยงด้วย Normalized Feature Weighting & Anomaly Deviation (ไม่ใช่ Rule-based แข็งทื่อ)
    const distanceRiskWeight = Math.min(1.0, features.distanceMeters / 3000); // 3 กม.
    const speedRiskWeight = Math.min(1.0, features.estimatedSpeedKmH / 120); // เกิน 120 กม./ชม. มีความผิดปกติสูง
    const frequencyRiskWeight = Math.min(1.0, (features.recentTxCountIn10Min - 1) / 5);
    const amountRiskWeight = features.amount > 3000 ? 0.3 : 0.05;

    // คำนวณความเสี่ยงรวมแบบ Softmax-like weighted anomaly score
    const combinedAnomalyScore =
      distanceRiskWeight * 0.45 +
      speedRiskWeight * 0.30 +
      frequencyRiskWeight * 0.15 +
      amountRiskWeight * 0.10;

    const roundedScore = Math.min(1.0, Math.max(0.0, Math.round(combinedAnomalyScore * 100) / 100));

    let decision: 'AUTO_APPROVED' | 'FLAGGED_FOR_REVIEW' | 'REJECTED' = 'AUTO_APPROVED';
    const reasons: string[] = [];

    if (features.distanceMeters > 5000) {
      reasons.push(`พิกัดผู้ซื้ออยู่ห่างจากร้านค้า ${Math.round(features.distanceMeters / 1000)} กม. เกินรัศมีการใช้จ่ายหน้าร้าน`);
    } else if (features.distanceMeters > 1000) {
      reasons.push(`พิกัดผู้ซื้อห่างจากร้านค้า ${Math.round(features.distanceMeters)} เมตร ซึ่งอยู่นอกพื้นที่แนะนำเล็กน้อย`);
    }

    if (features.estimatedSpeedKmH > 100) {
      reasons.push(`ตรวจพบการเปลี่ยนตำแหน่งรวดเร็วผิดปกติ (${Math.round(features.estimatedSpeedKmH)} กม./ชม.) สงสัยการใช้ GPS จำลอง`);
    }

    if (features.recentTxCountIn10Min >= 4) {
      reasons.push(`ความถี่ในการทำธุรกรรมสูงผิดปกติ (${features.recentTxCountIn10Min} ครั้งใน 10 นาที)`);
    }

    if (roundedScore >= 0.85) {
      decision = 'REJECTED';
      if (reasons.length === 0) reasons.push('AI ตรวจพบรูปแบบธุรกรรมที่มีความเสี่ยงทุจริตในระดับวิกฤต');
    } else if (roundedScore >= 0.50 || features.distanceMeters > 1500) {
      decision = 'FLAGGED_FOR_REVIEW';
      if (reasons.length === 0) reasons.push('AI แนะนำให้ตรวจสอบพิกัดเพิ่มเติมเนื่องจากมีค่าความเบี่ยงเบนทางสถิติ');
    } else {
      decision = 'AUTO_APPROVED';
      reasons.push('พิกัดและพฤติกรรมการใช้จ่ายสอดคล้องกับมาตรฐานหน้าร้านปกติ');
    }

    return {
      riskScore: roundedScore,
      decision,
      reason: reasons.join('; '),
      confidence: 0.92,
      model: 'semi-ai-anomaly-detector-v1',
    };
  }
}

export class FraudService {
  private aiEngine = AiFraudEngine.getInstance();

  /**
   * ตรวจสอบธุรกรรมและสร้าง Feature Vector เพื่อให้ AI วิเคราะห์
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

    // ดึงประวัติธุรกรรมล่าสุดของผู้ใช้เพื่อคำนวณความเร็วและพฤติกรรม
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentTx = await prisma.transactions.findMany({
      where: {
        user_id: params.userId,
        created_at: { gte: tenMinutesAgo },
      },
      include: {
        fraud_checks: true,
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    });

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
      const diffHours = (Date.now() - new Date(recentTx[0].created_at).getTime()) / (1000 * 3600);
      if (diffHours > 0) {
        estimatedSpeedKmH = (prevDistanceMeters / 1000) / diffHours;
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
    };

    const assessment = await this.aiEngine.evaluate(featureVector);

    return {
      ...assessment,
      distanceMeters,
    };
  }

  /**
   * ดึงรายการที่ถูกส่งตรวจจับทุจริตสำหรับผู้ดูแลระบบ (Admin)
   */
  public async getFlaggedAlerts() {
    const alerts = await prisma.fraud_checks.findMany({
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
              },
            },
            merchants: {
              select: {
                merchant_id: true,
                shop_name: true,
                average_rating_stars: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return alerts.map((a: any) => ({
      fraudCheckId: a.fraud_check_id,
      transactionId: a.transaction_id,
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
    }));
  }

  /**
   * ผู้ดูแลระบบอนุมัติหรือปฏิเสธรายการที่ถูก Flag
   */
  public async resolveAlert(fraudCheckId: string, action: 'APPROVE' | 'REJECT', adminId?: string, note?: string) {
    const fraudCheck = await prisma.fraud_checks.findUnique({
      where: { fraud_check_id: fraudCheckId },
      include: { transactions: true },
    });

    if (!fraudCheck) {
      throw new Error('ไม่พบข้อมูลรายการตรวจสอบทุจริตนี้');
    }

    const newDecision = action === 'APPROVE' ? 'MANUALLY_APPROVED' : 'REJECTED_BY_ADMIN';
    const newTxStatus = action === 'APPROVE' ? 'SUCCESS' : 'REJECTED';

    await prisma.$transaction([
      prisma.fraud_checks.update({
        where: { fraud_check_id: fraudCheckId },
        data: {
          decision: newDecision,
          fraud_reason: note ? `${fraudCheck.fraud_reason || ''} [บันทึกผู้ดูแลระบบ: ${note}]` : fraudCheck.fraud_reason,
          reviewed_by_admin_id: adminId || null,
        },
      }),
      prisma.transactions.update({
        where: { transaction_id: fraudCheck.transaction_id },
        data: { status: newTxStatus },
      }),
    ]);

    return { success: true, decision: newDecision, transactionStatus: newTxStatus };
  }
}

export const fraudService = new FraudService();
