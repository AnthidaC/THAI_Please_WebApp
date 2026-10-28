/**
 * โครงสร้างข้อมูลร้านค้าผู้สมัคร (Candidate Merchant) จาก Stage 1
 */
export interface CandidateMerchant {
  merchantId: string;
  shopName: string;
  distanceKm: number;
  formattedDistance: string;
  averageRating: number;
  transactionCount24h: number;
  baseScore: number; // คะแนนปกติ 0.00 - 1.00 จาก Rule-based Stage 1
  categoryId?: string | null; // Canonical Category ID (5 Categories)
  contextKeywordHints?: string[]; // คำสำคัญช่วยวิเคราะห์บริบท (ไม่ใช่หมวดหมู่ยืนยันทางการ)
}

/**
 * โครงสร้างข้อมูลคำขอจัดอันดับใหม่ (Reranking Request)
 */
export interface RerankingRequest {
  userPreferredCategories?: string[];
  candidates: CandidateMerchant[];
  maxOutputLimit?: number; // จำนวนร้านค้าสูงสุดที่ต้องการคืนกลับ (Default 5)
}

/**
 * รายละเอียดร้านค้าที่ผ่านการจัดอันดับและสร้างเหตุผลแนะนำแล้ว
 */
export interface RankedMerchantItem {
  merchantId: string;
  finalScore: number;
  recommendationReason: string;
  isAiEnhanced: boolean;
}

/**
 * ผลลัพธ์จากการประมวลผลจัดอันดับคำแนะนำ (Reranking Response)
 */
export interface RerankingResponse {
  provider: 'gemini' | 'openai' | 'rule_based_fallback';
  rankedMerchants: RankedMerchantItem[];
  latencyMs: number;
  isFallback: boolean;
}

/**
 * Interface สำหรับ AI Recommendation Client (รองรับ Provider-independent)
 */
export interface IAiRecommendationClient {
  rerankCandidates(request: RerankingRequest): Promise<RerankingResponse>;
}

/**
 * ค่าคอนฟิกเริ่มต้นสำหรับ AI Recommendation Engine
 */
export interface AiRecommendationConfig {
  provider: 'gemini' | 'openai' | 'rule_based_fallback';
  apiKey?: string;
  modelName: string;
  timeoutMs: number;
  maxCandidatesAllowed: number;
  defaultOutputLimit: number;
}

const DEFAULT_CONFIG: AiRecommendationConfig = {
  provider: 'rule_based_fallback',
  apiKey: process.env.AI_RECOMMENDATION_API_KEY || process.env.AI_FRAUD_API_KEY || undefined,
  modelName: process.env.AI_RECOMMENDATION_MODEL || 'gemini-1.5-flash',
  timeoutMs: 2500, // Timeout เคร่งครัด 2.5 วินาที
  maxCandidatesAllowed: 10, // จำกัดขนาด Prompt ไม่เกิน 10 ร้านค้า
  defaultOutputLimit: 5,
};

/**
 * Client จัดการเชื่อมต่อและจำลองการจัดอันดับร้านค้าด้วย AI (Developer 3)
 * - มีระบบ Deterministic Rule-based Fallback เมื่อไม่มี API หรือเกิด Timeout
 * - ป้องกัน ID แปลกปลอมและตรวจสอบความถูกต้องของ Merchant ID เสมอ
 * - รักษาความปลอดภัยของ API Key ให้อยู่เฉพาะ Server-side เท่านั้น
 */
export class AiRecommendationClient implements IAiRecommendationClient {
  private config: AiRecommendationConfig;

  constructor(customConfig?: Partial<AiRecommendationConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...customConfig,
    };
  }

  /**
   * สร้างข้อความเหตุผลแนะนำภาษาไทยแบบ Deterministic จากสถิติจริง (Fallback Reason Generator)
   */
  private generateRuleBasedReason(merchant: CandidateMerchant): string {
    const { formattedDistance, averageRating, transactionCount24h, shopName } = merchant;

    if (transactionCount24h >= 10) {
      return `ร้านยอดนิยมใน 24 ชม. (${transactionCount24h} ออเดอร์) เรตติ้ง ${averageRating.toFixed(1)} ดาว ใกล้คุณ ${formattedDistance}`;
    }
    if (transactionCount24h > 0) {
      return `มีผู้ใช้บริการ ${transactionCount24h} รายใน 24 ชม. ห่างเพียง ${formattedDistance} ร่วมโครงการ Co-pay`;
    }
    if (averageRating >= 4.5) {
      return `ร้านเรตติ้งยอดเยี่ยม ${averageRating.toFixed(1)} ดาว ห่างจากคุณ ${formattedDistance}`;
    }
    return `ร้านค้าในระยะ ${formattedDistance} รองรับสิทธิประโยชน์ร่วมจ่าย Co-pay 60/40`;
  }

  /**
   * ดำเนินการจัดอันดับด้วย Deterministic Rule-based Fallback (Zero Token / 100% Reliable)
   */
  public executeRuleBasedFallback(
    request: RerankingRequest,
    startTime: number
  ): RerankingResponse {
    const { candidates, maxOutputLimit = this.config.defaultOutputLimit } = request;

    // จัดเรียงตาม Base Score สูงสุด หากเท่ากันให้เรียงตามระยะทางใกล้สุด และเรตติ้งสูงสุด
    const sorted = [...candidates].sort((a, b) => {
      if (b.baseScore !== a.baseScore) {
        return b.baseScore - a.baseScore;
      }
      if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return b.averageRating - a.averageRating;
    });

    const limited = sorted.slice(0, Math.max(1, maxOutputLimit));

    const rankedMerchants: RankedMerchantItem[] = limited.map((c) => ({
      merchantId: c.merchantId,
      finalScore: c.baseScore,
      recommendationReason: this.generateRuleBasedReason(c),
      isAiEnhanced: false,
    }));

    return {
      provider: 'rule_based_fallback',
      rankedMerchants,
      latencyMs: Date.now() - startTime,
      isFallback: true,
    };
  }

  /**
   * ตรวจสอบความถูกต้องของรายการ ID ที่ตอบกลับมาจากผลลัพธ์
   * - ตรวจสอบว่า ID ทั้งหมดต้องมีอยู่ใน Candidates ต้นทาง
   * - ปฏิเสธและกรอง ID ซ้ำซ้อน หรือ ID ที่ไม่รู้จักทิ้ง
   */
  public validateRankedIds(
    returnedIds: string[],
    validCandidates: CandidateMerchant[]
  ): string[] {
    const validCandidateIdSet = new Set(validCandidates.map((c) => c.merchantId));
    const seen = new Set<string>();
    const sanitizedIds: string[] = [];

    for (const id of returnedIds) {
      if (validCandidateIdSet.has(id) && !seen.has(id)) {
        seen.add(id);
        sanitizedIds.push(id);
      }
    }

    return sanitizedIds;
  }

  /**
   * จัดอันดับร้านค้าผู้สมัคร (Rerank Candidates)
   * ขณะนี้ทำงานในโหมด Fallback ภายในระบบเพื่อความปลอดภัยสูงสุดและ Zero Token Cost
   */
  public async rerankCandidates(request: RerankingRequest): Promise<RerankingResponse> {
    const startTime = Date.now();

    if (!request.candidates || request.candidates.length === 0) {
      return {
        provider: 'rule_based_fallback',
        rankedMerchants: [],
        latencyMs: 0,
        isFallback: true,
      };
    }

    // จำกัดจำนวน Candidate สูงสุดไม่เกินขอบเขตที่กำหนด
    const safeCandidates = request.candidates.slice(0, this.config.maxCandidatesAllowed);
    const safeRequest: RerankingRequest = {
      ...request,
      candidates: safeCandidates,
    };

    // ปัจจุบันรันผ่าน Deterministic Fallback ที่สมบูรณ์แบบ (พร้อมต่อ API ภายนอกเมื่อเปิดใช้งาน)
    return this.executeRuleBasedFallback(safeRequest, startTime);
  }
}

export const aiRecommendationClient = new AiRecommendationClient();
