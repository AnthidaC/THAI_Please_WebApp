import {
  CandidateMerchant,
  RerankingRequest,
  RankedMerchantItem,
  RerankingResponse,
  IAiRecommendationClient,
  AiRecommendationClient,
} from './ai-recommendation.client';

export interface GeminiRecommendationClientConfig {
  enabled: boolean;
  apiKey?: string;
  model: string;
  timeoutMs: number;
  maxCandidates: number;
}

const DEFAULT_GEMINI_CONFIG: GeminiRecommendationClientConfig = {
  // ค่าเริ่มต้นปิดใช้งาน AI เพื่อความปลอดภัย (Default to disabled) ต้องเปิดผ่าน AI_RECOMMENDATION_ENABLED='true' เท่านั้น
  enabled: process.env.AI_RECOMMENDATION_ENABLED === 'true',
  apiKey: process.env.GEMINI_API_KEY || undefined,
  model: 'gemini-2.5-flash-lite',
  timeoutMs: 2500, // Timeout เคร่งครัด 2.5 วินาที
  maxCandidates: 10, // จำกัดไม่เกิน 10 ร้านค้าเพื่อประหยัด Token และความเร็ว
};

interface GeminiStructuredOutputItem {
  merchantId: string;
  scoreBoost?: number; // คะแนนเสริมความเกี่ยวข้อง 0.00 - 0.20
  recommendationReason: string;
}

interface GeminiStructuredOutput {
  rankedMerchants: GeminiStructuredOutputItem[];
}

/**
 * Gemini AI Adapter สำหรับจัดอันดับและสร้างเหตุผลแนะนำร้านค้า (Developer 3)
 * - ใช้โมเดล Gemini 2.5 Flash-Lite เพื่อความเร็วและประหยัดค่าใช้จ่าย
 * - ปิดการใช้งานเป็นค่าเริ่มต้น (Default to disabled) เปิดเมื่อ AI_RECOMMENDATION_ENABLED === 'true'
 * - จัดการ API Key และการเชื่อมต่อเฉพาะฝั่ง Backend (Server-side Only) ผ่าน x-goog-api-key Header
 * - มีระบบ Fallback กลับสู่ Rule-based อัตโนมัติเมื่อ Disabled, ไม่มี Key, Timeout หรือเกิดข้อผิดพลาด
 * - ตรวจสอบความถูกต้องของ Merchant ID เสมอ ป้องกันการ Hallucinate ID แปลกปลอม
 */
export class GeminiRecommendationClient implements IAiRecommendationClient {
  private config: GeminiRecommendationClientConfig;
  private fallbackClient: AiRecommendationClient;

  constructor(customConfig?: Partial<GeminiRecommendationClientConfig>) {
    this.config = {
      ...DEFAULT_GEMINI_CONFIG,
      ...customConfig,
      enabled: customConfig?.enabled ?? (process.env.AI_RECOMMENDATION_ENABLED === 'true'),
      // ดึง API Key จาก process.env.GEMINI_API_KEY อย่างปลอดภัย
      apiKey: customConfig?.apiKey ?? process.env.GEMINI_API_KEY ?? undefined,
    };
    this.fallbackClient = new AiRecommendationClient({
      defaultOutputLimit: this.config.maxCandidates,
      timeoutMs: this.config.timeoutMs,
    });
  }

  /**
   * สร้าง Compact Prompt ส่งเฉพาะข้อมูลจำเป็นไปยัง Gemini (Zero PII & Relative Distance Only)
   */
  private buildCompactPrompt(
    candidates: CandidateMerchant[],
    preferredCategories?: string[]
  ): string {
    const preferencesText =
      preferredCategories && preferredCategories.length > 0
        ? `User Preferences: [${preferredCategories.join(', ')}]`
        : 'User Preferences: General dining and street food';

    const candidatesList = candidates
      .map(
        (c, idx) =>
          `#${idx + 1} id="${c.merchantId}", name="${c.shopName}", dist="${c.formattedDistance}", rating=${c.averageRating}, tx24h=${c.transactionCount24h}, baseScore=${c.baseScore}`
      )
      .join('\n');

    return `${preferencesText}\n\nCandidate Merchants:\n${candidatesList}`;
  }

  /**
   * จัดอันดับร้านค้าใหม่ด้วย Gemini 2.5 Flash-Lite พร้อมกลไก Fallback ที่สมบูรณ์
   */
  public async rerankCandidates(request: RerankingRequest): Promise<RerankingResponse> {
    const startTime = Date.now();

    // 1. ตรวจสอบข้อมูลผู้สมัคร
    if (!request.candidates || request.candidates.length === 0) {
      return this.fallbackClient.executeRuleBasedFallback(request, startTime);
    }

    // 2. จำกัดร้านค้าผู้สมัครไม่เกิน Top 10 เพื่อควบคุมขนาด Token
    const safeCandidates = request.candidates.slice(0, this.config.maxCandidates);
    const candidateMap = new Map<string, CandidateMerchant>(
      safeCandidates.map((c) => [c.merchantId, c])
    );

    // 3. หากปิดใช้งาน (Disabled) หรือไม่มี API Key ให้ใช้ Rule-based Fallback ทันทีโดยไม่ยิง External Network
    if (!this.config.enabled || !this.config.apiKey) {
      return this.fallbackClient.executeRuleBasedFallback(
        { ...request, candidates: safeCandidates },
        startTime
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const prompt = this.buildCompactPrompt(safeCandidates, request.userPreferredCategories);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent`;

      const systemInstructionText =
        'You are an AI restaurant recommendation engine for Thailand Co-pay (THAI Please). ' +
        'Re-rank candidates based on user preferences, proximity, ratings, and 24h popularity. ' +
        'Do not infer unverified categories as facts. ' +
        'Output ONLY valid JSON matching this schema: ' +
        '{"rankedMerchants": [{"merchantId": string, "scoreBoost": number (0.0 to 0.2), "recommendationReason": string (1 concise sentence in natural Thai)}]}';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.config.apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: {
            parts: [{ text: systemInstructionText }],
          },
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 300,
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        // กรณี API ตอบกลับข้อผิดพลาด ให้สลับไปใช้ Fallback
        return this.fallbackClient.executeRuleBasedFallback(
          { ...request, candidates: safeCandidates },
          startTime
        );
      }

      const json: any = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        return this.fallbackClient.executeRuleBasedFallback(
          { ...request, candidates: safeCandidates },
          startTime
        );
      }

      const parsed: GeminiStructuredOutput = JSON.parse(rawText);

      if (!Array.isArray(parsed?.rankedMerchants) || parsed.rankedMerchants.length === 0) {
        return this.fallbackClient.executeRuleBasedFallback(
          { ...request, candidates: safeCandidates },
          startTime
        );
      }

      // 4. ตรวจสอบความถูกต้องของ ID ที่ได้จาก AI (Validation against original candidates)
      const seenIds = new Set<string>();
      const validRankedItems: RankedMerchantItem[] = [];

      for (const item of parsed.rankedMerchants) {
        const candidate = candidateMap.get(item.merchantId);
        // ตรวจสอบว่าต้องเป็น ID ที่อยู่ใน Candidates และไม่ซ้ำ
        if (candidate && !seenIds.has(item.merchantId)) {
          seenIds.add(item.merchantId);
          const boost = Math.max(0, Math.min(0.2, Number(item.scoreBoost || 0)));
          const finalScore = Math.min(1.0, Math.round((candidate.baseScore + boost) * 1000) / 1000);

          validRankedItems.push({
            merchantId: candidate.merchantId,
            finalScore,
            recommendationReason:
              item.recommendationReason?.trim() ||
              `ร้านแนะนำคะแนน ${candidate.averageRating.toFixed(1)} ดาว ห่างจากคุณ ${candidate.formattedDistance}`,
            isAiEnhanced: true,
          });
        }
      }

      // 5. หาก AI ส่งคืนมาไม่ครบทุกร้าน ให้ Backfill ร้านค้าที่เหลือตามลำดับ Rule-based
      for (const candidate of safeCandidates) {
        if (!seenIds.has(candidate.merchantId)) {
          seenIds.add(candidate.merchantId);
          validRankedItems.push({
            merchantId: candidate.merchantId,
            finalScore: candidate.baseScore,
            recommendationReason: `ร้านแนะนำในระยะ ${candidate.formattedDistance} รองรับสิทธิ์ Co-pay 60/40`,
            isAiEnhanced: false,
          });
        }
      }

      const maxLimit = request.maxOutputLimit || this.config.maxCandidates;
      const finalRanked = validRankedItems.slice(0, Math.max(1, maxLimit));

      return {
        provider: 'gemini',
        rankedMerchants: finalRanked,
        latencyMs: Date.now() - startTime,
        isFallback: false,
      };
    } catch (error) {
      // กรณี Timeout หรือ Network Error ให้ Fallback สู่ Rule-based อย่างปลอดภัยเสมอ
      return this.fallbackClient.executeRuleBasedFallback(
        { ...request, candidates: safeCandidates },
        startTime
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const geminiRecommendationClient = new GeminiRecommendationClient();
