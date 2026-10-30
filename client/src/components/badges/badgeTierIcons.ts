const BADGE_TIER_ICON_BY_LEVEL: Readonly<Record<number, string>> = {
  1: '/icons/badges/bronze.svg',
  2: '/icons/badges/silver.svg',
  3: '/icons/badges/gold.svg',
  4: '/icons/badges/platinum.svg',
};

export const getBadgeTierIcon = (tierLevel: number): string =>
  BADGE_TIER_ICON_BY_LEVEL[tierLevel] ?? BADGE_TIER_ICON_BY_LEVEL[1];
