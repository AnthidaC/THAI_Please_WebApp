import prisma from '../../../utils/prisma';
import { badgeConditionRegistry, BadgeConditionRegistry } from '../conditionRegistry';
import { createReferralCountHandler } from './referralCount';
import { createReviewCountHandler } from './reviewCount';
import { createTotalSpendingHandler } from './totalSpending';
import { createTransactionCountHandler } from './transactionCount';

/**
 * Registers every implemented condition handler in one place.
 * Call it once during server startup, before any route can award or display a Badge.
 * Registering twice throws, which keeps a mistaken second call visible at boot.
 */
export const registerAchievementHandlers = (
  registry: BadgeConditionRegistry = badgeConditionRegistry
): void => {
  registry.register(createTransactionCountHandler(prisma));
  registry.register(createReferralCountHandler(prisma));
  registry.register(createReviewCountHandler(prisma));
  registry.register(createTotalSpendingHandler(prisma));
};
