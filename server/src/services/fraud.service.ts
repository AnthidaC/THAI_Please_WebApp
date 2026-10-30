import prisma from '../utils/prisma';
import { thaiDayRange } from '../utils/thai-date';

export interface MerchantBehaviorBaseline {
  totalTxCount: number;
  avgAmount: number;
  amountStdDev: number;
  inStoreTxCount: number;
  remoteTxCount: number;
  inStoreRatio: number; // สัดส่วนธุรกรรมหน้าร้าน เช่น 0.85 = 85%
  uniqueCustomerCount: number;
}

export interface CitizenBehaviorBaseline {
  lifetimeTxCount: number;
  avgAmount: number;
  amountStdDev: number;
  accountAgeDays: number;
  cleanTxRatio: number; // สัดส่วนประวัติขาวสะอาด 1.0 = 100%
}

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
  merchantBaseline?: MerchantBehaviorBaseline;
  citizenBaseline?: CitizenBehaviorBaseline;
  amountZScoreVsMerchant?: number;
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
/**
 * AI Fraud Detection Client (Semi-AI Model Interface with Zero-Token Gating)
 * นโยบายสำคัญ:
 * - Stage 1 (0-Token Filter): กรองธุรกรรมปกติ 90-95% ด้วย Rule-based & Heuristics ทันที ไม่ส่ง AI เพื่อประหยัด Token
 * - Stage 2 (Targeted AI Prompt): ส่ง Prompt เข้า AI เฉพาะเคสที่ตกเกณฑ์น่าสงสัย (Gray Zone)
 * - AI จะไม่บล็อกผู้ใช้หรือร้านค้าทันที (ไม่ส่งค่า REJECTED เพื่อขัดจังหวะการค้าขายปกติ)
 * - บันทึกสถานะ FLAGGED_FOR_REVIEW เพื่อส่งเรื่องให้ Admin ตรวจสอบย้อนหลัง
 */
export class AiFraudEngine {
  private static instance: AiFraudEngine;
  private provider: 'gemini' | 'openai' | 'custom' = 'gemini';
  private externalAiEndpoint: string | null = null;
  private aiApiKey: string | null = null;
  private aiModel: string = 'gemini-1.5-flash';

  private constructor() {
    this.provider = ((process.env.AI_PROVIDER as any) || 'gemini').toLowerCase();
    this.externalAiEndpoint = process.env.AI_FRAUD_ENDPOINT || null;
    this.aiApiKey = process.env.AI_FRAUD_API_KEY || null;
    this.aiModel = process.env.AI_FRAUD_MODEL || 'gemini-1.5-flash';
  }

  public static getInstance(): AiFraudEngine {
    if (!AiFraudEngine.instance) {
      AiFraudEngine.instance = new AiFraudEngine();
    }
    return AiFraudEngine.instance;
  }

  /**
   * กฎการตัดสินใจส่ง Prompt (Heuristic Pre-Filtering / Zero-Token Gating)
   * หากเข้าเกณฑ์ข้อใดข้อหนึ่ง จะส่ง Prompt เข้า AI เพื่อวิเคราะห์เชิงลึก
   */
  public shouldInvokeAi(features: FraudFeatureVector): { shouldInvoke: boolean; triggers: string[] } {
    const triggers: string[] = [];
    const repeatSuspicious = features.repeatedSuspiciousCount ?? 0;
    const samePairRepeats = features.samePairRepeatCountToday ?? 1;

    // กฎที่ 1: พิกัดห่างเกิน 1,500 เมตร (ใกล้กรอบเพดาน 2,000 เมตร)
    if (features.distanceMeters > 1500) {
      triggers.push(`พิกัดห่าง ${Math.round(features.distanceMeters)} ม. (เกินเกณฑ์เฝ้าระวัง 1,500 ม.)`);
    }

    // กฎที่ 2: ความเร็วการเปลี่ยนพิกัดเกิน 70 กม./ชม.
    if (features.estimatedSpeedKmH > 70) {
      triggers.push(`ความเร็วการเคลื่อนที่ผิดปกติ (${Math.round(features.estimatedSpeedKmH)} กม./ชม.)`);
    }

    // กฎที่ 3: สแกนถี่เกิน 2 ครั้งใน 10 นาที (>= 3 ครั้ง)
    if (features.recentTxCountIn10Min >= 3) {
      triggers.push(`ความถี่ทำธุรกรรมสูงผิดปกติ (${features.recentTxCountIn10Min} ครั้งใน 10 นาที)`);
    }

    // กฎที่ 4: สแกนร้านเดิมซ้ำเกิน 2 ครั้งในวันเดียว (>= 3 ครั้ง เสี่ยงซอยบิล)
    if (samePairRepeats >= 3) {
      triggers.push(`สแกนซ้ำร้านเดิม ${samePairRepeats} ครั้งในวันเดียว`);
    }

    // กฎที่ 5: มีประวัติความน่าสงสัยสะสม
    if (repeatSuspicious >= 1) {
      triggers.push(`พบบัญชีมีประวัติถูกตั้งข้อสงสัย ${repeatSuspicious} ครั้ง`);
    }

    // กฎที่ 6: ยอดเงินสูงกว่า 1,500 บาท ร่วมกับระยะห่างเกิน 1,000 เมตร
    if (features.amount > 1500 && features.distanceMeters > 1000) {
      triggers.push(`ยอดเงินสูง (${features.amount} บาท) ร่วมกับระยะห่างมากกว่า 1 กม.`);
    }

    return {
      shouldInvoke: triggers.length > 0,
      triggers,
    };
  }

  /**
   * ส่ง Feature Vector ไปวิเคราะห์ผ่าน AI Engine พร้อมระบบประหยัด Token
   */
  public async evaluate(features: FraudFeatureVector): Promise<AiFraudAssessment> {
    const { shouldInvoke, triggers } = this.shouldInvokeAi(features);

    // =========================================================================
    // 🌟 STAGE 1: 0-TOKEN FILTER (ธุรกรรมปกติ 90-95% จบตรงนี้ทันที)
    // =========================================================================
    if (!shouldInvoke) {
      return {
        riskScore: 0.06,
        decision: 'AUTO_APPROVED',
        reason: 'พิกัดและพฤติกรรมอยู่ในเกณฑ์ปลอดภัยสมบูรณ์ (Zero-Token Gated)',
        confidence: 0.99,
        model: 'heuristic-zero-token-v2',
      };
    }

    // =========================================================================
    // 🤖 STAGE 2: TARGETED AI PROMPT (เรียก AI เฉพาะธุรกรรมน่าสงสัย)
    // =========================================================================
    if (this.aiApiKey || this.externalAiEndpoint) {
      try {
        const aiAssessment = await this.invokeExternalAi(features, triggers);
        if (aiAssessment) {
          return aiAssessment;
        }
      } catch (err) {
        console.warn('[AI Fraud Engine] External API call failed, falling back to Local Anomaly Evaluator:', err);
      }
    }

    // =========================================================================
    // 🛡️ STAGE 3: FALLBACK TO LOCAL MULTI-FACTOR ENGINE
    // =========================================================================
    return this.evaluateLocally(features, triggers);
  }

  /**
   * เรียกใช้งานโมเดล AI ภายนอก (Google Gemini Flash / OpenAI / Custom Endpoint)
   * โดยคุม Token ให้สั้นที่สุด (max_tokens: 80) และบังคับ Output JSON
   */
  private async invokeExternalAi(
    features: FraudFeatureVector,
    triggers: string[]
  ): Promise<AiFraudAssessment | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // ไม่ให้หน้าร้านค้างเกิน 2.5 วินาที

    try {
      const compactPrompt = `TxFeatures: dist=${Math.round(features.distanceMeters)}m, speed=${Math.round(features.estimatedSpeedKmH)}km/h, tx10m=${features.recentTxCountIn10Min}, sameShopToday=${features.samePairRepeatCountToday ?? 1}, prevFlags=${features.repeatedSuspiciousCount ?? 0}, amt=${features.amount}THB, triggers=[${triggers.join('; ')}]`;

      let riskScore = 0.75;
      let decision: 'AUTO_APPROVED' | 'FLAGGED_FOR_REVIEW' = 'FLAGGED_FOR_REVIEW';
      let reason = triggers.join(' • ');
      let confidence = 0.95;
      let usedModel = this.aiModel;

      // 1. Google Gemini Flash API (ประหยัด Token และเร็วสูงสุด)
      if (this.provider === 'gemini' && this.aiApiKey) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.aiModel}:generateContent?key=${this.aiApiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: compactPrompt }] }],
            systemInstruction: {
              parts: [{
                text: 'You are an anti-fraud risk engine for Thailand Co-pay. Evaluate risk. Output ONLY valid JSON: {"riskScore": number(0-1), "decision": "AUTO_APPROVED"|"FLAGGED_FOR_REVIEW", "reason": "สรุปสั้นๆภาษาไทย 1 ประโยค"}. Never return REJECTED directly; always FLAGGED_FOR_REVIEW if suspicious.',
              }],
            },
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens: 80, // ป้องกันการเปลือง token
              temperature: 0.1,
            },
          }),
        });

        if (res.ok) {
          const json: any = await res.json();
          const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            riskScore = Number(parsed.riskScore ?? 0.75);
            decision = parsed.decision === 'REJECTED' ? 'FLAGGED_FOR_REVIEW' : (parsed.decision || 'FLAGGED_FOR_REVIEW');
            reason = parsed.reason || reason;
            confidence = 0.96;
            usedModel = this.aiModel;
          }
        }
      }
      // 2. OpenAI API (เช่น gpt-4o-mini)
      else if (this.provider === 'openai' && this.aiApiKey) {
        const url = 'https://api.openai.com/v1/chat/completions';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.aiApiKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.aiModel || 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are an anti-fraud risk engine. Output ONLY JSON: {"riskScore": number(0-1), "decision": "AUTO_APPROVED"|"FLAGGED_FOR_REVIEW", "reason": "สรุปสั้นๆภาษาไทย 1 ประโยค"}.',
              },
              { role: 'user', content: compactPrompt },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 80,
            temperature: 0.1,
          }),
        });

        if (res.ok) {
          const json: any = await res.json();
          const content = json.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            riskScore = Number(parsed.riskScore ?? 0.75);
            decision = parsed.decision === 'REJECTED' ? 'FLAGGED_FOR_REVIEW' : (parsed.decision || 'FLAGGED_FOR_REVIEW');
            reason = parsed.reason || reason;
            confidence = 0.95;
            usedModel = this.aiModel || 'gpt-4o-mini';
          }
        }
      }
      // 3. Custom AI Endpoint
      else if (this.externalAiEndpoint) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.aiApiKey) headers['Authorization'] = `Bearer ${this.aiApiKey}`;
        const res = await fetch(this.externalAiEndpoint, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({ features, triggers, prompt: compactPrompt }),
        });

        if (res.ok) {
          const json: any = await res.json();
          riskScore = Number(json.riskScore ?? 0.75);
          decision = json.decision === 'REJECTED' ? 'FLAGGED_FOR_REVIEW' : (json.decision || 'FLAGGED_FOR_REVIEW');
          reason = json.reason || reason;
          confidence = Number(json.confidence ?? 0.92);
          usedModel = 'custom-ai-service';
        }
      }

      return {
        riskScore: Math.min(0.99, Math.max(0.01, Math.round(riskScore * 100) / 100)),
        decision,
        reason,
        confidence,
        model: usedModel,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Intelligent Semi-AI Anomaly Scoring Engine (Local Multi-factor Model Fallback)
   */
  public evaluateLocally(features: FraudFeatureVector, triggers: string[] = []): AiFraudAssessment {
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
    const reasons: string[] = triggers.length > 0 ? [...triggers] : [];

    if (repeatSuspicious >= 2 && !reasons.some(r => r.includes('ประวัติ'))) {
      reasons.push(`ตรวจพบประวัติความน่าสงสัยซ้ำสะสม (${repeatSuspicious} ครั้ง)`);
    }
    if (samePairRepeats >= 3 && !reasons.some(r => r.includes('สแกนซ้ำ'))) {
      reasons.push(`ผู้ใช้สแกนชำระเงินซ้ำกับร้านค้าเดิม ${samePairRepeats} ครั้งในวันเดียวกัน`);
    }
    if (features.recentTxCountIn10Min >= 3 && !reasons.some(r => r.includes('10 นาที'))) {
      reasons.push(`ความถี่ทำธุรกรรมซ้ำสูงผิดปกติ (${features.recentTxCountIn10Min} ครั้งใน 10 นาที)`);
    }

    const isSuspiciousForAdmin =
      roundedScore >= 0.45 ||
      repeatSuspicious >= 2 ||
      samePairRepeats >= 3 ||
      features.recentTxCountIn10Min >= 3 ||
      features.distanceMeters > 1500 ||
      features.estimatedSpeedKmH > 70;

    if (isSuspiciousForAdmin) {
      decision = 'FLAGGED_FOR_REVIEW';
      if (reasons.length === 0) {
        reasons.push('ระบบตรวจพบรูปแบบพฤติกรรมน่าสงสัยซ้ำซ้อน จึงส่งเรื่องให้ผู้ดูแลระบบตรวจสอบ');
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
    const startOfToday = thaiDayRange().start;

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

    // 4. ดึงสถิติภาพรวมย้อนหลังของร้านค้าและประชาชน (Merchant & Citizen Baseline Profiling)
    const [merchantPastTxs, userPastTxs] = await Promise.all([
      prisma.transactions.findMany({
        where: {
          merchant_id: params.merchantId,
          status: { in: ['SUCCESS', 'FLAGGED'] },
        },
        select: {
          total_amount: true,
          user_id: true,
          fraud_checks: {
            select: { distance_meters: true },
          },
        },
        take: 50,
        orderBy: { created_at: 'desc' },
      }),
      prisma.transactions.findMany({
        where: {
          user_id: params.userId,
          status: { in: ['SUCCESS', 'FLAGGED'] },
        },
        select: {
          total_amount: true,
          created_at: true,
          fraud_checks: {
            select: { decision: true },
          },
        },
        take: 30,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    // คำนวณ Merchant Baseline (ยอดเฉลี่ย, ความผันผวน, สัดส่วนหน้าร้าน vs ส่งรอบร้าน)
    let merchantBaseline: MerchantBehaviorBaseline = {
      totalTxCount: 0,
      avgAmount: 150,
      amountStdDev: 30,
      inStoreTxCount: 0,
      remoteTxCount: 0,
      inStoreRatio: 1.0,
      uniqueCustomerCount: 0,
    };

    if (merchantPastTxs.length > 0) {
      const amounts = merchantPastTxs.map((t) => Number(t.total_amount));
      const sumAmount = amounts.reduce((a, b) => a + b, 0);
      const avgAmount = Math.round((sumAmount / amounts.length) * 100) / 100;

      const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length;
      const amountStdDev = Math.round(Math.sqrt(variance) * 100) / 100;

      let inStoreCount = 0;
      let remoteCount = 0;
      const uniqueUsers = new Set<string>();

      for (const tx of merchantPastTxs) {
        if (tx.user_id) uniqueUsers.add(tx.user_id);
        const dist = tx.fraud_checks ? Number(tx.fraud_checks.distance_meters) : 0;
        if (dist <= 200) {
          inStoreCount++;
        } else {
          remoteCount++;
        }
      }

      const inStoreRatio = Math.round((inStoreCount / merchantPastTxs.length) * 100) / 100;

      merchantBaseline = {
        totalTxCount: merchantPastTxs.length,
        avgAmount,
        amountStdDev: amountStdDev || 20,
        inStoreTxCount: inStoreCount,
        remoteTxCount: remoteCount,
        inStoreRatio,
        uniqueCustomerCount: uniqueUsers.size,
      };
    }

    // คำนวณ Citizen Baseline
    let citizenBaseline: CitizenBehaviorBaseline = {
      lifetimeTxCount: 0,
      avgAmount: 150,
      amountStdDev: 30,
      accountAgeDays: 30,
      cleanTxRatio: 1.0,
    };

    if (userPastTxs.length > 0) {
      const userAmounts = userPastTxs.map((t) => Number(t.total_amount));
      const userSum = userAmounts.reduce((a, b) => a + b, 0);
      const userAvg = Math.round((userSum / userAmounts.length) * 100) / 100;
      const userVar = userAmounts.reduce((sum, amt) => sum + Math.pow(amt - userAvg, 2), 0) / userAmounts.length;
      const userStd = Math.round(Math.sqrt(userVar) * 100) / 100;

      let cleanCount = 0;
      for (const tx of userPastTxs) {
        const dec = tx.fraud_checks?.decision;
        if (!dec || dec === 'AUTO_APPROVED') {
          cleanCount++;
        }
      }

      const oldestTxDate = new Date(userPastTxs[userPastTxs.length - 1].created_at).getTime();
      const accountAgeDays = Math.max(1, Math.round((Date.now() - oldestTxDate) / (1000 * 3600 * 24)));

      citizenBaseline = {
        lifetimeTxCount: userPastTxs.length,
        avgAmount: userAvg,
        amountStdDev: userStd || 20,
        accountAgeDays,
        cleanTxRatio: Math.round((cleanCount / userPastTxs.length) * 100) / 100,
      };
    }

    // Z-Score ของยอดเงินบิลนี้เทียบกับความผันผวนของร้านค้า
    const amountZScoreVsMerchant = merchantBaseline.amountStdDev > 0
      ? Math.round(((params.amount - merchantBaseline.avgAmount) / merchantBaseline.amountStdDev) * 100) / 100
      : 0;

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
      merchantBaseline,
      citizenBaseline,
      amountZScoreVsMerchant,
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
        transactionStatus: a.transactions?.status || (a.decision === 'REJECTED' ? 'REJECTED' : 'FLAGGED'),
        transactionCreatedAt: a.transactions?.created_at ? a.transactions.created_at.toISOString() : (a.created_at?.toISOString ? a.created_at.toISOString() : a.created_at),
        transactionCompletedAt: a.transactions?.completed_at ? a.transactions.completed_at.toISOString() : null,
        userLat: Number(a.user_latitude),
        userLon: Number(a.user_longitude),
        merchantLat: Number(a.merchant_latitude),
        merchantLon: Number(a.merchant_longitude),
        createdAt: a.transactions?.created_at ? a.transactions.created_at.toISOString() : (a.created_at?.toISOString ? a.created_at.toISOString() : a.created_at),
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
   * ดึงรายการแฟ้มสรุปคดีความเสี่ยงระดับบุคคล (User Dossiers) และร้านค้า (Merchant Dossiers)
   * พร้อมระบบตัดสัญญาณรบกวน (Micro-transaction Noise Filter):
   * กรองธุรกรรมย่อยเดี่ยวๆ (Isolated Single Micro-tx) ออก ไม่ส่งเข้าคิว Admin
   * จะแสดงเฉพาะเคสที่:
   * 1. ทำซ้ำสะสม >= 2 ครั้ง
   * 2. หรือยอดเงินรัฐสมทบที่เสี่ยงเสียหายสะสม >= 300 บาท
   * 3. หรือมีความเสี่ยงระดับวิกฤต (Risk Score >= 0.80)
   */
  public async getFraudDossiers(includeMinorNoise: boolean = false) {
    const rawAlerts = await this.getFlaggedAlerts();

    // 1. จัดกลุ่มตามผู้ใช้ (User Grouping)
    const userMap: Record<string, any> = {};
    // 2. จัดกลุ่มตามร้านค้า (Merchant Grouping)
    const merchantMap: Record<string, any> = {};

    let totalGovernmentAtRisk = 0;
    let suppressedNoiseCount = 0;

    for (const alert of rawAlerts) {
      const uid = alert.userId || 'anonymous-user';
      const mid = alert.merchantId || 'anonymous-merchant';

      totalGovernmentAtRisk += alert.copayAmount;

      // จัดกลุ่ม User
      if (!userMap[uid]) {
        userMap[uid] = {
          userId: uid,
          customerName: alert.customerName,
          provinceCode: 'BKK',
          walletStatus: alert.userWalletStatus,
          flaggedCount: 0,
          totalAmount: 0,
          governmentCopayAtRisk: 0,
          citizenPaidTotal: 0,
          riskScores: [],
          maxRiskScore: 0,
          merchantsMap: {},
          transactions: [],
          latestActivityAt: alert.createdAt,
        };
      }
      userMap[uid].flaggedCount += 1;
      userMap[uid].totalAmount += alert.totalAmount;
      userMap[uid].governmentCopayAtRisk += alert.copayAmount;
      userMap[uid].citizenPaidTotal += alert.citizenPaidAmount;
      userMap[uid].riskScores.push(alert.riskScore);
      if (alert.riskScore > userMap[uid].maxRiskScore) {
        userMap[uid].maxRiskScore = alert.riskScore;
      }
      if (!userMap[uid].merchantsMap[mid]) {
        userMap[uid].merchantsMap[mid] = {
          merchantId: mid,
          shopName: alert.shopName,
          transactionCount: 0,
        };
      }
      userMap[uid].merchantsMap[mid].transactionCount += 1;
      userMap[uid].transactions.push(alert);

      // จัดกลุ่ม Merchant
      if (!merchantMap[mid]) {
        merchantMap[mid] = {
          merchantId: mid,
          shopName: alert.shopName,
          merchantTaxId: alert.merchantTaxId,
          isMerchantApproved: alert.isMerchantApproved,
          flaggedCount: 0,
          totalAmount: 0,
          governmentCopayAtRisk: 0,
          riskScores: [],
          maxRiskScore: 0,
          customersMap: {},
          transactions: [],
          latestActivityAt: alert.createdAt,
        };
      }
      merchantMap[mid].flaggedCount += 1;
      merchantMap[mid].totalAmount += alert.totalAmount;
      merchantMap[mid].governmentCopayAtRisk += alert.copayAmount;
      merchantMap[mid].riskScores.push(alert.riskScore);
      if (alert.riskScore > merchantMap[mid].maxRiskScore) {
        merchantMap[mid].maxRiskScore = alert.riskScore;
      }
      merchantMap[mid].customersMap[uid] = (merchantMap[mid].customersMap[uid] || 0) + 1;
      merchantMap[mid].transactions.push(alert);
    }

    // 3. แปลงเป็น User Dossier List พร้อมวิเคราะห์ความเสี่ยงเชิงพฤติกรรม (AI Pattern Synthesis)
    const userDossiers = Object.values(userMap).map((u: any) => {
      const avgScore =
        u.riskScores.length > 0
          ? Math.round(
              (u.riskScores.reduce((acc: number, cur: number) => acc + cur, 0) /
                u.riskScores.length) *
                100
            ) / 100
          : 0;

      const merchantsInvolved = Object.values(u.merchantsMap);
      const isRepeatedAtSameShop = merchantsInvolved.some((m: any) => m.transactionCount >= 2);
      const hasHighVelocity = u.transactions.some((t: any) =>
        t.fraudReason?.includes('เคลื่อนที่') || t.fraudReason?.includes('กม./ชม.')
      );
      const hasNearBorder = u.transactions.some((t: any) => t.distanceMeters > 1500);

      let primaryRiskPattern = 'พฤติกรรมธุรกรรมน่าสงสัยสะสม';
      let aiCaseSummary = `ตรวจพบรูปแบบธุรกรรมผิดปกติสะสม ${u.flaggedCount} รายการ ยอดรัฐสมทบสะสม ฿${u.governmentCopayAtRisk.toLocaleString()}`;

      if (isRepeatedAtSameShop && u.flaggedCount >= 3) {
        primaryRiskPattern = 'ส่อเจตนาซอยบิลแลกเงินสด (Split-Billing Cash-out)';
        aiCaseSummary = `ตรวจพบการสแกนจ่ายซ้ำร้านเดิมถี่ (${u.flaggedCount} ครั้ง) ส่อเจตนาซอยบิลแลกเปลี่ยนเป็นเงินสดแทนการซื้อสินค้าจริง แนะนำระงับสิทธิ์ Co-pay ชั่วคราวเพื่อตรวจสอบ`;
      } else if (hasHighVelocity) {
        primaryRiskPattern = 'เคลื่อนที่เร็วผิดปกติ / เสี่ยงแชร์บัญชี (Velocity Anomaly)';
        aiCaseSummary = `ตรวจพบการเปลี่ยนพิกัดการทำรายการรวดเร็วผิดวิสัย ส่อเจตนาใช้แอปจำลองพิกัด (GPS Spoofing) หรือมีผู้ใช้งานหลายคนใช้บัญชีร่วมกัน`;
      } else if (hasNearBorder) {
        primaryRiskPattern = 'ทำรายการปริ่มขอบรัศมี 2 กม. (Edge Geofence)';
        aiCaseSummary = `ตรวจพบพิกัดสแกนชำระเงินห่างเกิน 1.5 กม. ต่อเนื่อง ควรตรวจสอบการส่งมอบสินค้าจริงหน้าร้าน`;
      }

      // เกณฑ์ความเสียหายสะสม (Cumulative Threshold): ตัดธุรกรรมย่อยโดดๆ 1 ครั้งออก
      const isActionable =
        u.flaggedCount >= 2 ||
        u.governmentCopayAtRisk >= 300 ||
        u.maxRiskScore >= 0.80;

      if (!isActionable) {
        suppressedNoiseCount += u.flaggedCount;
      }

      return {
        userId: u.userId,
        customerName: u.customerName,
        provinceCode: u.provinceCode,
        walletStatus: u.walletStatus,
        flaggedCount: u.flaggedCount,
        totalAmount: Math.round(u.totalAmount * 100) / 100,
        governmentCopayAtRisk: Math.round(u.governmentCopayAtRisk * 100) / 100,
        citizenPaidTotal: Math.round(u.citizenPaidTotal * 100) / 100,
        averageRiskScore: avgScore,
        maxRiskScore: u.maxRiskScore,
        primaryRiskPattern,
        aiCaseSummary,
        isActionable,
        latestActivityAt: u.latestActivityAt,
        merchantsInvolved,
        transactions: u.transactions,
      };
    });

    // 4. แปลงเป็น Merchant Dossier List
    const merchantDossiers = Object.values(merchantMap).map((m: any) => {
      const avgScore =
        m.riskScores.length > 0
          ? Math.round(
              (m.riskScores.reduce((acc: number, cur: number) => acc + cur, 0) /
                m.riskScores.length) *
                100
            ) / 100
          : 0;

      const uniqueCustomersCount = Object.keys(m.customersMap).length;
      const isSuspiciousCollusion = m.flaggedCount >= 3 && uniqueCustomersCount <= 2;

      let primaryRiskPattern = 'ร้านค้ามีธุรกรรมต้องสงสัยสะสม';
      let aiCaseSummary = `ร้านค้านี้มีรายการธุรกรรมติดสถานะน่าสงสัย ${m.flaggedCount} รายการ ยอดเงินรัฐสมทบสะสม ฿${m.governmentCopayAtRisk.toLocaleString()}`;

      if (isSuspiciousCollusion) {
        primaryRiskPattern = 'ส่อเจตนาสมรู้ร่วมคิดแลกเงินสด (Collusion Cash-out)';
        aiCaseSummary = `ตรวจพบการรับเงินจากลูกค้ากลุ่มเดิมซ้ำซ้อนผิดวิสัย (${m.flaggedCount} บิลจากลูกค้าเพียง ${uniqueCustomersCount} ราย) เสี่ยงทุจริตสมรู้ร่วมคิดแลกเงินสด`;
      } else if (m.flaggedCount >= 4) {
        primaryRiskPattern = 'ความถี่ธุรกรรมผิดปกติหน้าร้าน (High Flag Frequency)';
        aiCaseSummary = `ร้านค้ามีสัดส่วนรายการผิดปกติสูงต่อเนื่อง แนะนำส่งเจ้าหน้าที่เข้าสุ่มตรวจจุดพิกัดจริง`;
      }

      const isActionable =
        m.flaggedCount >= 2 ||
        m.governmentCopayAtRisk >= 300 ||
        m.maxRiskScore >= 0.80;

      return {
        merchantId: m.merchantId,
        shopName: m.shopName,
        merchantTaxId: m.merchantTaxId,
        isMerchantApproved: m.isMerchantApproved,
        flaggedCount: m.flaggedCount,
        totalAmount: Math.round(m.totalAmount * 100) / 100,
        governmentCopayAtRisk: Math.round(m.governmentCopayAtRisk * 100) / 100,
        averageRiskScore: avgScore,
        maxRiskScore: m.maxRiskScore,
        primaryRiskPattern,
        aiCaseSummary,
        isActionable,
        latestActivityAt: m.latestActivityAt,
        uniqueCustomersCount,
        transactions: m.transactions,
      };
    });

    const sortedUserDossiers = userDossiers
      .filter((u) => includeMinorNoise || u.isActionable)
      .sort((a, b) => b.maxRiskScore - a.maxRiskScore || b.governmentCopayAtRisk - a.governmentCopayAtRisk);

    const sortedMerchantDossiers = merchantDossiers
      .filter((m) => includeMinorNoise || m.isActionable)
      .sort((a, b) => b.maxRiskScore - a.maxRiskScore || b.governmentCopayAtRisk - a.governmentCopayAtRisk);

    return {
      summary: {
        totalPendingChecks: rawAlerts.length,
        actionableUserDossiersCount: sortedUserDossiers.length,
        actionableMerchantDossiersCount: sortedMerchantDossiers.length,
        suppressedNoiseCount,
        totalGovernmentAtRisk: Math.round(totalGovernmentAtRisk * 100) / 100,
      },
      userDossiers: sortedUserDossiers,
      merchantDossiers: sortedMerchantDossiers,
    };
  }

  /**
   * ผู้ดูแลระบบจัดการแฟ้มคดีระดับบุคคล/ร้านค้าแบบ Batch 1-Click
   * (จัดการทุกธุรกรรมของ User หรือ Merchant ในคลิกเดียว)
   */
  public async resolveDossier(params: {
    targetType: 'USER' | 'MERCHANT';
    targetId: string;
    action: 'APPROVE_ALL' | 'REJECT_ALL' | 'SUSPEND_USER' | 'SUSPEND_MERCHANT';
    adminId?: string;
    note?: string;
  }) {
    const { targetType, targetId, action, adminId, note } = params;

    const whereCondition =
      targetType === 'USER'
        ? {
            transactions: { user_id: targetId },
            decision: { in: ['FLAGGED_FOR_REVIEW', 'REJECTED'] },
          }
        : {
            transactions: { merchant_id: targetId },
            decision: { in: ['FLAGGED_FOR_REVIEW', 'REJECTED'] },
          };

    const pendingChecks = await prisma.fraud_checks.findMany({
      where: whereCondition,
      include: { transactions: true },
    });

    if (pendingChecks.length === 0) {
      throw new Error(`ไม่พบรายการต้องสงสัยที่ค้างการตรวจสอบสำหรับ ${targetType} รหัส ${targetId}`);
    }

    const decisionMap: Record<string, string> = {
      APPROVE_ALL: 'MANUALLY_APPROVED',
      REJECT_ALL: 'REJECTED_BY_ADMIN',
      SUSPEND_USER: 'USER_SUSPENDED',
      SUSPEND_MERCHANT: 'MERCHANT_SUSPENDED',
    };
    const newDecision = decisionMap[action] || 'MANUALLY_APPROVED';

    const checkIds = pendingChecks.map((c) => c.fraud_check_id);
    const txIds = pendingChecks.map((c) => c.transaction_id);

    await prisma.$transaction(async (tx: any) => {
      // 1. อัปเดต fraud_checks ทุกรายการ
      await tx.fraud_checks.updateMany({
        where: { fraud_check_id: { in: checkIds } },
        data: {
          decision: newDecision,
          fraud_reason: note
            ? `[มติแฟ้มคดี Admin (${action}): ${note}]`.slice(0, 255)
            : undefined,
          reviewed_by_admin_id: adminId || null,
        },
      });

      // 2. อัปเดต transactions สถานะ (หาก Approve ให้ยืนยันสำเร็จ)
      if (action === 'APPROVE_ALL') {
        await tx.transactions.updateMany({
          where: { transaction_id: { in: txIds }, status: 'FLAGGED' },
          data: { status: 'SUCCESS' },
        });
      }

      // 3. ปฏิบัติการระงับสิทธิ์
      if (action === 'SUSPEND_USER') {
        const userId = targetType === 'USER' ? targetId : pendingChecks[0]?.transactions?.user_id;
        if (userId) {
          await tx.wallets.updateMany({
            where: { user_id: userId },
            data: {
              status: 'SUSPENDED',
              eligibility_status: 'SUSPENDED',
            },
          });
        }
      }

      if (action === 'SUSPEND_MERCHANT') {
        const merchantId = targetType === 'MERCHANT' ? targetId : pendingChecks[0]?.transactions?.merchant_id;
        if (merchantId) {
          await tx.merchants.update({
            where: { merchant_id: merchantId },
            data: { is_approved: false },
          });
        }
      }
    });

    return {
      success: true,
      action,
      targetType,
      targetId,
      resolvedCount: pendingChecks.length,
      newDecision,
    };
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
    // Reviewing a declined GPS attempt cannot create a paid transaction without a debit.
    const newTxStatus = txRecord && ['SUCCESS', 'FLAGGED'].includes(txRecord.status)
      ? 'SUCCESS' : txRecord?.status || 'REJECTED';

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
            ...(newTxStatus === 'SUCCESS' && !txRecord.completed_at ? { completed_at: new Date() } : {}),
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

