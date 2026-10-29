# Badge Award Engine

Runtime behaviour of the Badge system. Phase 1 (definitions, tiers, Admin CRUD, migration) is described in `backend-guide.md`, `database-schema.md`, and `frontend-guide.md`.

## 1. Architecture

```text
Business event (payment, referral conversion, review)
        ↓
awardAfterActivity(userId, conditionTypes)   ← never throws
        ↓
badgeConditionRegistry.getProgress(conditionType, userId)
        ↓
evaluateCondition  →  planAwards (pure)
        ↓
prisma.$transaction
  SELECT users … FOR UPDATE          (one evaluation per user at a time)
  read current tier + unlock history
  createMany user_badge_history      (skipDuplicates)
  upsert user_badges                 (only when the new level is higher)
        ↓
newly awarded tiers
```

| File | Responsibility |
| --- | --- |
| `server/src/services/achievements/conditionRegistry.ts` | Map of `conditionType → getProgress`. Rejects duplicate and malformed keys. Unknown conditions fail closed. |
| `server/src/services/achievements/handlers/*.ts` | One handler factory per condition; each takes the narrow Prisma slice it needs. |
| `server/src/services/achievements/handlers/index.ts` | `registerAchievementHandlers()` — the only place handlers are registered. |
| `server/src/services/achievements/badgeAwardEngine.ts` | Tier planning, evaluation, persistence, post-commit hook, active-condition discovery. |
| `server/src/services/citizenBadge.service.ts` | Read model for the citizen API (progress, current tier, next tier). |
| `server/src/scripts/reconcile-badges.ts` | Bounded historical reconciliation CLI. |

Registration happens once in `server/src/server.ts` before the HTTP listener starts. The Admin condition-discovery endpoint (`GET /api/badge-condition-types`) reads that same registry, so a condition is only offered after it is registered, and activation requires `implementation_status = 'ready'` **and** `registry.has(condition_type)`.

## 2. Registered handlers

| `condition_type` | Counts | Authoritative query |
| --- | --- | --- |
| `transaction_count` | Completed, paid purchases | `transactions` where `status IN ('SUCCESS','FLAGGED')`, keyed by `user_id` |
| `referral_count` | Converted referrals credited to the referrer | `referrals` where `referrer_user_id = user`, `status = 'redeemed'`, `converted_at IS NOT NULL` |
| `review_count` | Verified-purchase reviews on settled transactions | `reviews` where `user_id = user`, `is_verified_purchase = true`, joined to a `SUCCESS`/`FLAGGED` transaction |
| `total_spending` | Citizen out-of-pocket spending | `SUM(citizen_paid_amount)` over the same settled transactions |

Why `FLAGGED` counts: the fraud engine saves a charged purchase as `SUCCESS`, or as `FLAGGED` when an administrator must review it. `transaction.service.ts` already treats both as merchant revenue. `PENDING` and `REJECTED` are excluded; a `REJECTED` row with a zero citizen amount is the silent log written for an out-of-range scan.

Why `citizen_paid_amount` for spending: `total_amount` includes the government co-pay subsidy, which is not the citizen's money. Summation runs in PostgreSQL `DECIMAL`; the result is rounded to two decimals and returned as a number, because `badge_tiers.required_count` is `INTEGER` (whole baht thresholds). Never accumulate money in JavaScript floats.

`reviews.transaction_id` is unique and one purchase produces one review, so `review_count` cannot double count the same purchase.

## 3. Adding a condition

Implement the handler against a narrow client type so it is testable with a fake, then register it. The engine does not change.

```typescript
// server/src/services/achievements/handlers/questCount.ts
import type { PrismaClient } from '@prisma/client';
import type { BadgeConditionHandler } from '../conditionRegistry';

export type QuestProgressClient = Pick<PrismaClient, 'mission_participants'>;

export const createQuestCountHandler = (
  client: QuestProgressClient
): BadgeConditionHandler => ({
  conditionType: 'quest_count',
  getProgress: (userId) => client.mission_participants.count({
    where: { user_id: userId, status: 'completed' },
  }),
});
```

```typescript
// server/src/services/achievements/handlers/index.ts
registry.register(createQuestCountHandler(prisma));
```

Then:

1. Add a unit test with a fake client that asserts the exact `where` clause.
2. Create the Badge in the Admin UI with `condition_type = 'quest_count'`, tiers, and `implementation_status = pending`.
3. After deploy, set it to `ready`, then activate. Activation fails while the handler is unregistered.
4. Optionally run reconciliation for existing users.

Do not add a second registry, dynamic SQL, or condition-specific branches in the engine. A handler returns a single authoritative number; it must be repeatable and must not mutate state.

## 4. Tier evaluation and idempotency

`planAwards` is pure: sort tiers by `tier_level`, select every tier whose `required_count <= progress`, drop tiers already present in unlock history, and promote only when the highest eligible level is above the stored current level.

- Crossing several thresholds at once records each missing tier once and promotes to the highest.
- Re-running an evaluation records nothing new.
- The current tier never moves down, even if historical data changes.
- A missing lower tier is backfilled when the user qualifies for a higher one.
- Deactivated Badges are ignored; their existing unlocks are kept.
- A condition with no registered handler returns `status: 'unregistered'` without touching the database.
- A Badge with a `condition_type` but zero tiers is skipped.

Concurrency safety is enforced by the database, not by application-side existence checks:

- `SELECT user_id FROM users WHERE user_id = $1 FOR UPDATE` serialises evaluations for one user.
- `uq_user_badge_history_user_tier` on `user_badge_history (user_id, badge_tier_id)` + `createMany({ skipDuplicates: true })` makes a duplicate history row impossible.
- `uq_user_badges_user_badge_current` on `user_badges (user_id, badge_id)` + conditional upsert keeps one current tier per series.

All award writes for a Badge happen in one transaction, so a failure leaves no partial unlock.

## 5. Event integration

Evaluation runs **after** the business write commits. `awardAfterActivity` catches and logs every error, so gamification can never fail or roll back a payment, review, or referral.

| Event | Location | Conditions evaluated |
| --- | --- | --- |
| Co-pay checkout succeeds | `payment.service.ts`, after the transaction and SSE emit | `transaction_count`, `total_spending` for the buyer |
| The same checkout used a friend referral | `payment.service.ts` | `referral_count` for `referrerUserId` |
| Review created | `review.service.ts`, after the insert | `review_count` |

Referral conversion is observed only through checkout, because that is where the referral becomes `redeemed`. Administrator fraud approval (`FLAGGED → SUCCESS`) does not need a hook: `FLAGGED` already counted.

There is no message broker. Evaluation is in-process and best-effort. A crash between commit and evaluation loses that one trigger; the reconciliation command recovers it. Do not move evaluation inside the payment transaction.

## 6. Progress API

`GET /api/me/badges` returns active Badges only, and `GET /api/me/badges/:badgeId` returns one. The user always comes from the authenticated request context; no client-supplied user ID is accepted.

```json
{
  "id": "…",
  "name": "Referral Master",
  "description": "…",
  "conditionType": "referral_count",
  "iconUrl": null,
  "progress": 25,
  "currentTier": { "id": "…", "name": "Silver", "level": 2, "requiredCount": 20, "unlocked": true, "earnedAt": "2026-10-01T…" },
  "nextTier":    { "id": "…", "name": "Gold",   "level": 3, "requiredCount": 50, "unlocked": false, "earnedAt": null },
  "isMaxTier": false,
  "isUnlocked": true,
  "tiers": [ … ]
}
```

Edge cases:

- No active Badges → `200` with `[]`; the UI shows its empty state.
- No unlocked tier → `currentTier: null`, `nextTier` is the first tier.
- Max tier → `nextTier: null`, `isMaxTier: true`.
- Inactive Badge → omitted from the list; the single-Badge route returns `404`.
- Unregistered or failing handler → `progress: null`, so the UI says progress is unavailable instead of showing a wrong number.
- Zero progress → `0`, not `null`.

Progress is computed once per distinct condition type (`Promise.all`), then current tiers and unlock timestamps are loaded in two batched queries, so the list endpoint does not issue per-Badge queries.

## 7. Historical reconciliation

```bash
cd server
npm run badges:reconcile -- --dry-run                 # default; writes nothing
npm run badges:reconcile -- --user=<uuid>             # one user
npm run badges:reconcile -- --batch=100 --max-users=500
npm run badges:reconcile -- --apply                   # write missing tiers
```

The command iterates users by ascending `user_id` cursor in bounded batches, evaluates every active condition, and prints one JSON line per unlock plus a summary (`processedUsers`, `evaluatedConditions`, `newUnlocks`, `failures`). It is resumable and repeatable: it only inserts missing history rows and never downgrades or deletes. Failures are counted per user and exit with code 1. It is never run at application startup.

Retroactive policy: reconciliation grants tiers the user qualifies for **now**. Unlocks are timestamped at reconciliation time, not backdated to the original activity, because the schema stores only the moment of recording. Activation dates do not gate awards; deactivated Badges are skipped.

## 8. Deployment prerequisites

1. Back up the database and review migration `20261027120000_badge_series_and_tiers` in staging. Do not run `migrate reset` or `db push`.
2. Apply it with `npx prisma migrate deploy` through the direct connection. The migration is **not** applied by this work.
3. `npx prisma generate`, then deploy server and client together.
4. Start the server once so handlers register; verify `GET /api/badge-condition-types` lists the four conditions.
5. Run `npm run badges:reconcile -- --dry-run`, review the report, then `--apply`.
6. Review and activate Badges in the Admin UI. Do not activate a Badge whose condition is still unimplemented.

Until the migration is deployed, `user_badges.badge_tier_id` does not exist and Badge-related reads fail with `P2022`. Handler and award-engine unit tests do not need the database; concurrency and transaction behaviour must be verified against an isolated database.

## 9. Admin Badge tier contract

Every new Badge Series has four canonical tier identities: `Bronze`/1, `Silver`/2, `Gold`/3, and `Platinum`/4. The Admin API requires all four, positive integer thresholds within the existing PostgreSQL `INTEGER` range, and strictly increasing thresholds. No schema migration is needed.

The Admin editor maps stored tiers by level, preserves each `tier_id` and icon URL, and updates existing rows in place. It does not insert or delete tiers during an edit. A tier with a current or historical award cannot have its definition changed, and an active Badge must be deactivated first. Existing series with missing, extra, or noncanonical levels cannot be edited or activated automatically; the Admin UI reports the stored structure, and a reviewed conversion must map the old rows and awards without deleting history.

Slider scale is derived from the largest threshold and can be expanded. Proportional mode applies only when Platinum changes; direct edits to lower levels remain local. All current measurement units use integer thresholds because `badge_tiers.required_count` is `INTEGER`; the `amount` unit therefore represents whole baht, matching the `total_spending` handler. The progress preview is calculated in the browser and does not read Citizen awards.
