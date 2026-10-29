export interface TierDefinition {
  tierId: string;
  tierName: string;
  tierLevel: number;
  requiredCount: number;
  iconUrl: string | null;
}

export const FIXED_BADGE_TIER_IDENTITIES = [
  { tierName: 'Bronze', tierLevel: 1 },
  { tierName: 'Silver', tierLevel: 2 },
  { tierName: 'Gold', tierLevel: 3 },
  { tierName: 'Platinum', tierLevel: 4 },
] as const;

export const hasFixedBadgeTierStructure = (
  tiers: readonly Pick<TierDefinition, 'tierName' | 'tierLevel'>[]
): boolean => {
  if (tiers.length !== FIXED_BADGE_TIER_IDENTITIES.length) return false;
  const ordered = [...tiers].sort((left, right) => left.tierLevel - right.tierLevel);
  return FIXED_BADGE_TIER_IDENTITIES.every((identity, index) =>
    ordered[index].tierLevel === identity.tierLevel && ordered[index].tierName === identity.tierName
  );
};

export const assertBadgeTierIdsStayWithLevels = (
  current: readonly TierDefinition[],
  requested: readonly (Omit<TierDefinition, 'tierId'> & { tierId?: string })[]
): void => {
  if (!hasFixedBadgeTierStructure(current)) {
    throw new Error('Badge has a legacy tier structure that needs reviewed remediation');
  }
  if (requested.length !== FIXED_BADGE_TIER_IDENTITIES.length) {
    throw new Error('All four existing Badge tier IDs must be retained');
  }

  const currentByLevel = new Map(current.map((tier) => [tier.tierLevel, tier]));
  for (const identity of FIXED_BADGE_TIER_IDENTITIES) {
    const existing = currentByLevel.get(identity.tierLevel);
    const update = requested.find((tier) => tier.tierLevel === identity.tierLevel);
    if (!existing || !update || update.tierId !== existing.tierId || update.tierName !== identity.tierName) {
      throw new Error('Badge tier IDs must stay with their fixed level identities');
    }
  }
};

export const getBadgeActivationBlocker = (input: {
  implementationStatus: string;
  conditionType: string;
  tiers: readonly Pick<TierDefinition, 'tierName' | 'tierLevel'>[];
  handlerRegistered: boolean;
}): string | null => {
  if (input.implementationStatus !== 'ready') return 'ต้องกำหนดสถานะการพัฒนาเป็นพร้อมใช้งานก่อนเปิดเหรียญตรา';
  if (!input.handlerRegistered) return 'ประเภทเงื่อนไขนี้ยังไม่มีตัวประมวลผลในระบบ';
  if (!hasFixedBadgeTierStructure(input.tiers)) return 'เหรียญตราต้องมีระดับบรอนซ์ ซิลเวอร์ โกลด์ และแพลทินัมครบก่อนเปิดใช้งาน';
  return null;
};

export const assertEarnedTiersUnchanged = (
  earnedTiers: TierDefinition[],
  requestedTiers: Array<Omit<TierDefinition, 'tierId'> & { tierId?: string }>
): void => {
  for (const earned of earnedTiers) {
    const requested = requestedTiers.find((tier) => tier.tierId === earned.tierId);
    if (!requested
      || requested.tierName !== earned.tierName
      || requested.tierLevel !== earned.tierLevel
      || requested.requiredCount !== earned.requiredCount
      || (requested.iconUrl ?? null) !== earned.iconUrl) {
      throw new Error('Cannot modify or remove a tier that has an earned achievement');
    }
  }
};

