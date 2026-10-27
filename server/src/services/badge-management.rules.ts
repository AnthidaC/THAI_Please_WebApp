export interface TierDefinition {
  tierId: string;
  tierName: string;
  tierLevel: number;
  requiredCount: number;
  iconUrl: string | null;
}

export const getBadgeActivationBlocker = (input: {
  implementationStatus: string;
  conditionType: string;
  tierCount: number;
  handlerRegistered: boolean;
}): string | null => {
  if (input.implementationStatus !== 'ready') return 'Implementation status must be ready before activation';
  if (!input.handlerRegistered) return 'No backend handler is registered for this condition type';
  if (input.tierCount < 1) return 'At least one valid tier is required before activation';
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

