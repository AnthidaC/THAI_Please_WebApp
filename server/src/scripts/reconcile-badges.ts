/**
 * Historical Badge reconciliation.
 *
 * Awards tiers that the user already qualifies for from existing activity. Safe
 * to repeat: the engine only inserts missing history rows and never lowers a
 * stored tier.
 *
 * Usage (from server/):
 *   npm run badges:reconcile -- --dry-run
 *   npm run badges:reconcile -- --user=<uuid>
 *   npm run badges:reconcile -- --batch=100 --max-users=500
 *
 * Dry run is the default unless `--apply` is passed.
 */
import prisma from '../utils/prisma';
import { registerAchievementHandlers } from '../services/achievements/handlers';
import { evaluateUserAchievements } from '../services/achievements/badgeAwardEngine';

interface Options {
  dryRun: boolean;
  userId: string | null;
  batch: number;
  maxUsers: number;
}

const parsePositiveInt = (raw: string | undefined, fallback: number, label: string): number => {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
};

const parseArgs = (argv: string[]): Options => {
  const readValue = (prefix: string): string | undefined =>
    argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);

  return {
    dryRun: !argv.includes('--apply'),
    userId: readValue('--user=') ?? null,
    batch: parsePositiveInt(readValue('--batch='), 50, '--batch'),
    maxUsers: parsePositiveInt(readValue('--max-users='), 1000, '--max-users'),
  };
};

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  if (options.userId && !/^[0-9a-f-]{36}$/i.test(options.userId)) {
    throw new Error('--user must be a user UUID');
  }

  registerAchievementHandlers();

  const summary = {
    dryRun: options.dryRun,
    processedUsers: 0,
    evaluatedConditions: 0,
    newUnlocks: 0,
    failures: 0,
  };

  // Cursor pagination keeps memory flat and makes the run resumable after a stop.
  let cursor: string | undefined;
  while (summary.processedUsers < options.maxUsers) {
    const users = await prisma.user.findMany({
      where: options.userId ? { user_id: options.userId } : undefined,
      select: { user_id: true },
      orderBy: { user_id: 'asc' },
      take: Math.min(options.batch, options.maxUsers - summary.processedUsers),
      ...(cursor ? { skip: 1, cursor: { user_id: cursor } } : {}),
    });
    if (users.length === 0) break;

    for (const user of users) {
      cursor = user.user_id;
      try {
        const results = await evaluateUserAchievements(user.user_id, { dryRun: options.dryRun });
        summary.processedUsers += 1;
        summary.evaluatedConditions += results.length;

        for (const result of results) {
          if (result.awarded.length === 0) continue;
          summary.newUnlocks += result.awarded.length;
          console.log(JSON.stringify({
            userId: user.user_id,
            conditionType: result.conditionType,
            progress: result.progress,
            tiers: result.awarded.map((tier) => `${tier.badgeName}/${tier.tierName}`),
          }));
        }
      } catch (error) {
        summary.failures += 1;
        console.error(JSON.stringify({
          userId: user.user_id,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    }

    if (options.userId) break;
  }

  console.log(JSON.stringify({ summary }, null, 2));
  if (summary.failures > 0) process.exitCode = 1;
};

main()
  .catch((error) => {
    console.error('Badge reconciliation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
