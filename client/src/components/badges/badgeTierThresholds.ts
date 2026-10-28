export const BADGE_TIER_MAX = 2_147_483_647;
export type BadgeThresholdUnit = 'count' | 'amount' | 'other';

export const BADGE_TIER_IDENTITIES = [
  { level: 1, name: 'Bronze', label: 'บรอนซ์', color: '#A85216' },
  { level: 2, name: 'Silver', label: 'ซิลเวอร์', color: '#64748B' },
  { level: 3, name: 'Gold', label: 'โกลด์', color: '#B77908' },
  { level: 4, name: 'Platinum', label: 'แพลทินัม', color: '#2563EB' },
] as const;

export const hasCanonicalBadgeTierStructure = (
  tiers: readonly { name: string; level: number }[]
): boolean => tiers.length === BADGE_TIER_IDENTITIES.length
  && BADGE_TIER_IDENTITIES.every((identity) => {
    const stored = tiers.find((tier) => tier.level === identity.level);
    return stored?.name === identity.name;
  });

export type BadgeThresholdValidation = {
  errors: Array<string | null>;
  message: string | null;
  valid: boolean;
};

export const getDefaultBadgeThresholds = (
  unit: BadgeThresholdUnit | undefined,
  conditionKey = ''
): number[] => {
  if (unit === 'amount') return [500, 2_000, 5_000, 10_000];
  if (unit === 'count') {
    if (conditionKey === 'transaction_count') return [5, 20, 50, 100];
    if (conditionKey === 'referral_count') return [1, 5, 15, 30];
    if (conditionKey === 'review_count') return [3, 10, 25, 50];
  }
  return [1, 5, 15, 30];
};

export const validateBadgeThresholds = (values: readonly string[]): BadgeThresholdValidation => {
  const errors: Array<string | null> = Array.from({ length: BADGE_TIER_IDENTITIES.length }, () => null);
  if (values.length !== BADGE_TIER_IDENTITIES.length) {
    return { errors, message: 'ต้องกำหนดเกณฑ์ให้ครบทั้ง 4 ระดับ', valid: false };
  }

  const parsed = values.map((value) => value.trim() === '' ? Number.NaN : Number(value));
  parsed.forEach((value, index) => {
    if (!Number.isSafeInteger(value) || value < 1 || value > BADGE_TIER_MAX) {
      errors[index] = 'กรอกจำนวนเต็มบวกที่ไม่เกิน 2,147,483,647';
    }
  });

  if (errors.some(Boolean)) {
    return { errors, message: 'เกณฑ์แต่ละระดับต้องเป็นจำนวนเต็มบวก', valid: false };
  }

  for (let index = 1; index < parsed.length; index += 1) {
    if (parsed[index] <= parsed[index - 1]) {
      errors[index] = 'เกณฑ์ต้องมากกว่าระดับก่อนหน้าอย่างน้อย 1';
    }
  }

  const invalidOrder = errors.some(Boolean);
  return {
    errors,
    message: invalidOrder ? 'เกณฑ์ต้องเพิ่มขึ้นตามลำดับบรอนซ์ ซิลเวอร์ โกลด์ และแพลทินัม' : null,
    valid: !invalidOrder,
  };
};

const niceCeiling = (value: number): number => {
  const bounded = Number.isFinite(value)
    ? Math.min(BADGE_TIER_MAX, Math.max(4, Math.ceil(value)))
    : value === Number.POSITIVE_INFINITY ? BADGE_TIER_MAX : 4;
  if (bounded === BADGE_TIER_MAX) return BADGE_TIER_MAX;

  const magnitude = 10 ** Math.floor(Math.log10(bounded));
  const normalized = bounded / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.min(BADGE_TIER_MAX, step * magnitude);
};

export const getSuggestedBadgeSliderMax = (values: readonly string[]): number => {
  const highest = Number(values[values.length - 1]);
  const safeHighest = Number.isSafeInteger(highest) && highest > 0 ? highest : 30;
  return niceCeiling(Math.max(4, safeHighest * 1.25));
};

const normalizeSliderMax = (value: number): number => Number.isSafeInteger(value)
  ? Math.min(BADGE_TIER_MAX, Math.max(4, value))
  : 4;

export const getBadgeSliderMax = (
  values: readonly string[],
  expandedMax: number,
  frozenMax: number | null
): number => frozenMax === null
  ? Math.max(getSuggestedBadgeSliderMax(values), normalizeSliderMax(expandedMax))
  : normalizeSliderMax(frozenMax);

export interface BadgePointerInteraction {
  pointerId: number;
  frozenMax: number;
}

export const beginBadgePointerInteraction = (
  current: BadgePointerInteraction | null,
  pointerId: number,
  sliderMax: number
): BadgePointerInteraction => current ?? { pointerId, frozenMax: normalizeSliderMax(sliderMax) };

export const endBadgePointerInteraction = (
  current: BadgePointerInteraction | null,
  pointerId: number
): BadgePointerInteraction | null => current?.pointerId === pointerId ? null : current;

export const increaseBadgeSliderMax = (currentMax: number): number => {
  const boundedMax = normalizeSliderMax(currentMax);
  if (boundedMax >= BADGE_TIER_MAX) return BADGE_TIER_MAX;
  const expanded = niceCeiling(Math.max(boundedMax + 1, boundedMax * 1.25));
  return expanded > boundedMax ? expanded : Math.min(BADGE_TIER_MAX, boundedMax + 1);
};

export type ProportionalScaleResult = { values: string[]; error: null } | { values: null; error: string };

export const scaleBadgeThresholds = (
  values: readonly string[],
  platinumValue: number
): ProportionalScaleResult => {
  const current = validateBadgeThresholds(values);
  if (!current.valid) return { values: null, error: 'แก้เกณฑ์ทั้ง 4 ระดับให้เรียงถูกต้องก่อนปรับตามสัดส่วน' };
  if (!Number.isSafeInteger(platinumValue) || platinumValue < 1 || platinumValue > BADGE_TIER_MAX) {
    return { values: null, error: 'เกณฑ์แพลทินัมต้องเป็นจำนวนเต็มบวก' };
  }
  if (platinumValue < BADGE_TIER_IDENTITIES.length) {
    return { values: null, error: 'เกณฑ์แพลทินัมต้องไม่น้อยกว่า 4 เพื่อให้แต่ละระดับมีเกณฑ์ต่างกัน' };
  }

  const baseline = values.map(Number);
  const previousPlatinum = baseline[baseline.length - 1];
  const scaled: number[] = [];
  for (let index = 0; index < baseline.length - 1; index += 1) {
    const minimum = index === 0 ? 1 : scaled[index - 1] + 1;
    const maximum = platinumValue - (baseline.length - 1 - index);
    if (minimum > maximum) {
      return { values: null, error: 'ค่านี้ไม่เหลือช่วงให้ครบ 4 เกณฑ์ที่ไม่ซ้ำกัน' };
    }
    const numerator = BigInt(baseline[index]) * BigInt(platinumValue);
    const denominator = BigInt(previousPlatinum);
    const roundedRatio = Number((numerator * 2n + denominator) / (denominator * 2n));
    scaled.push(Math.min(maximum, Math.max(minimum, roundedRatio)));
  }
  scaled.push(platinumValue);

  const result = scaled.map(String);
  if (!validateBadgeThresholds(result).valid) {
    return { values: null, error: 'ค่านี้ไม่สามารถสร้างเกณฑ์ 4 ระดับที่เรียงถูกต้องได้' };
  }
  return { values: result, error: null };
};

export interface BadgeProgressPreview {
  currentTier: (typeof BADGE_TIER_IDENTITIES)[number] | null;
  nextTier: (typeof BADGE_TIER_IDENTITIES)[number] | null;
  remaining: number | null;
  highestTierAchieved: boolean;
}

export const calculateBadgeProgressPreview = (
  values: readonly string[],
  progress: number
): BadgeProgressPreview | null => {
  if (!validateBadgeThresholds(values).valid || !Number.isSafeInteger(progress) || progress < 0 || progress > BADGE_TIER_MAX) return null;
  const thresholds = values.map(Number);
  let unlockedIndex = -1;
  thresholds.forEach((threshold, index) => {
    if (progress >= threshold) unlockedIndex = index;
  });

  const currentTier = unlockedIndex < 0 ? null : BADGE_TIER_IDENTITIES[unlockedIndex];
  const nextTier = BADGE_TIER_IDENTITIES[unlockedIndex + 1] ?? null;
  return {
    currentTier,
    nextTier,
    remaining: nextTier ? thresholds[unlockedIndex + 1] - progress : null,
    highestTierAchieved: unlockedIndex === BADGE_TIER_IDENTITIES.length - 1,
  };
};

export const getBadgeThresholdUnitLabel = (unit: BadgeThresholdUnit | undefined, conditionKey = ''): string => {
  if (unit === 'amount') return 'บาท';
  if (unit !== 'count') return 'หน่วย';
  if (conditionKey === 'referral_count') return 'คน';
  if (conditionKey === 'review_count') return 'รีวิว';
  return 'ครั้ง';
};

export const formatBadgeThreshold = (value: number, unit: BadgeThresholdUnit | undefined): string => {
  const formatted = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(value);
  return unit === 'amount' ? `${formatted} บาท` : formatted;
};
