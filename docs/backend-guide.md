# ⚙️ Backend Development Guide

คู่มือสำหรับทีมพัฒนาฝั่ง Backend API (`server/`)

---

## 1. Request Lifecycle Flow

การไหลของ Request ใน Express API ต้องเรียงลำดับตาม Layer ดังนี้เสมอ:

```
Request 
  ➔ [Middlewares] (Helmet, CORS, CookieParser)
  ➔ [Route] (Express Router)
  ➔ [Validate Middleware] (Zod Schema Validation)
  ➔ [Auth Middleware] (ถ้าต้องการตรวจสอบ JWT)
  ➔ [Controller] (รับค่าจาก Request, เรียก Service/Utils)
  ➔ [Prisma DB / Cache Redis]
  ➔ [sendSuccess / sendError Helper] (ส่ง Response)
```

---

## 2. Directory Structure Conventions

| โฟลเดอร์ | วัตถุประสงค์ | ตัวอย่าง |
| :--- | :--- | :--- |
| `src/routes/` | ประกาศ Endpoint และแนบ Middleware | `auth.routes.ts`, `index.ts` |
| `src/controllers/` | รับ `req, res, next` จัดการ Logic และ Response | `auth.controller.ts` |
| `src/validations/` | Zod Schemas สำหรับเช็ค Data Type ของ Request | `auth.validation.ts` |
| `src/middlewares/` | ฟังก์ชัน Intercept ก่อนถึง Controller | `auth.middleware.ts`, `validate.middleware.ts` |
| `src/utils/` | ตัวช่วยจัดการภายนอก (DB, Redis, Hash, Token, Format) | `prisma.ts`, `redis.ts`, `response.ts` |

---

## 3. Best Practices ในการเขียนโค้ด

1. **Validation ด้วย Zod เสมอ:**
   ทุกข้อมูลที่รับจาก Client (`req.body`, `req.query`, `req.params`) ต้องผ่าน Zod schema เสมอ ห้ามเชื่อข้อมูลดิบ
2. **ห้าม Throw Error ลอยๆ:**
   ใน Controller ต้องครอบด้วย `try { ... } catch (error) { next(error); }` เสมอ เพื่อให้ Error Handler ทำงานอย่างถูกต้อง
3. **การใช้งาน Cache (Redis):**
   เรียกใช้งานผ่าน utility กลาง `cache.get(key)` และ `cache.set(key, value, ttl)` ใน `src/utils/redis.ts` ซึ่งรองรับทั้ง Upstash REST และ TCP อัตโนมัติ

## 4. Admin Badge management and condition handlers

These Admin-only endpoints use the existing `authenticateAdmin` middleware and strict Zod validation:

| Method and path | Purpose |
| --- | --- |
| `GET /api/badges` | List; accepts `implementation_status=pending`, `in_progress`, or `ready`, and `status=active` or `inactive` |
| `GET /api/badges/:id` | Read a Badge and its tiers |
| `POST /api/badges` | Create one Badge and all tiers atomically |
| `PATCH /api/badges/:id` | Edit metadata and eligible, unearned tiers |
| `PATCH /api/badges/:id/implementation-status` | Update workflow metadata |
| `POST /api/badges/:id/activate` | Activate only when Ready, registered, and configured with valid tiers |
| `POST /api/badges/:id/deactivate` | Deactivate a Badge |
| `GET /api/badge-condition-types` | Return the condition types registered in Backend |

The same Admin gamification router manages the condition metadata catalog:

| Method and path | Purpose |
| --- | --- |
| `GET /api/condition-types` | List catalog entries; filter by `implementation_status` and `handler_registered` |
| `GET /api/condition-types/:id` | Read metadata, handler availability, and the linked Badge series |
| `POST /api/condition-types` | Propose a unique identifier and Thai display metadata; status defaults to Pending |
| `PATCH /api/condition-types/:id` | Update display metadata or workflow status; `conditionKey` is immutable |

The catalog is not executable. A new definition defaults to `pending`; `ready` is rejected unless `badgeConditionRegistry` contains a handler for its immutable key. Badge activation requires both a Ready catalog entry and a registered handler. A unique constraint prevents duplicate keys, and a foreign key protects existing Badge references.

Creation does not accept `status` or `implementation_status`: database defaults make the Badge Inactive and Pending. `condition_type` is unique and immutable. Tier thresholds must be positive, unique, and strictly increase by `tier_level`. Badge CRUD never generates executable code from administrator input.

`services/achievements/conditionRegistry.ts` is the registry. Four handlers are implemented and registered centrally by `registerAchievementHandlers()` from `handlers/index.ts`, called once in `server/src/server.ts`:

| `condition_type` | Progress source |
| --- | --- |
| `transaction_count` | `SUCCESS` and `FLAGGED` transactions |
| `referral_count` | Referrals with `status = 'redeemed'` and `converted_at` set |
| `review_count` | Verified-purchase reviews on settled transactions |
| `total_spending` | Sum of `citizen_paid_amount` on settled transactions |

Handlers are factories over a narrow Prisma client so they can be unit-tested with fakes. A new condition is one handler module plus one `registry.register(...)` line; the award engine needs no change:

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

`services/achievements/badgeAwardEngine.ts` evaluates active Badges after successful business writes (checkout, referral conversion, review creation). It records only missing tiers in `user_badge_history`, never lowers the current tier, and serialises per-user evaluation with `SELECT … FOR UPDATE` plus the unique keys `(user_id, badge_tier_id)` and `(user_id, badge_id)`. `awardAfterActivity` swallows and logs failures so a Badge problem cannot fail a payment. See `badge-award-engine.md` for the architecture, event points, progress API, and reconciliation.

The Admin may set `pending`, `in_progress`, or `ready`, but `ready` is workflow metadata and does not register a handler. Activation checks both `implementation_status === 'ready'` and `badgeConditionRegistry.has(condition_type)`, plus valid tiers. The condition-type endpoint reads the same registry, so administrators can propose an unsupported identifier while it remains inactive.

Tier edits require the Badge to be inactive. A tier referenced by current user state or unlock history cannot be renamed, moved, re-thresholded, or removed; unused tiers can be edited or removed. The Badge migration temporarily preserved the old tables as `badges_legacy` and `user_badges_legacy`, copied unlocks to `user_badge_history`, and recorded the highest legacy tier as the current `user_badges` state. A follow-up cleanup migration dropped the two archive tables after verifying they were empty and had no external dependencies.

Checkout, referral conversion, and review creation call the engine after their own writes commit. A handler or award failure is logged and never changes the financial result. Unknown conditions fail closed in the registry. Historical activity is awarded only by `npm run badges:reconcile`, which defaults to a dry run; nothing evaluates Badges at startup.

## 6. Campaign periods and quota rules

Campaign CRUD stays on the existing Admin endpoints. `POST /api/campaigns` accepts an optional `periods` array; `PATCH /api/campaigns/:id` accepts the desired period list to add, edit, or remove future periods. The campaign plus its initial periods are created atomically. Validation rejects invalid ranges, periods outside campaign dates, overlap, duplicate period IDs, negative quota, and any period-enabled configuration whose period sum differs from the campaign total. Monetary equality uses integer cents; campaigns without periods remain valid.

Use `[start_date, end_date)` for period checks. The service uses campaign timestamps as instants; the Admin form converts `Asia/Bangkok` date/time values to explicit offsets. SQL constraints and deferred triggers are defined in `20261027140000_campaign_period_quota_enforcement`. Keep base-table recovery outside migration history: on an empty development database, run `npx tsx src/scripts/bootstrap-fresh-database.ts --apply` from `server/`. It stages the existing migrations around the missing historical table creation and refuses non-empty schemas.

At enrollment the service creates one independent `wallet_period_quotas` allocation per configured period. Adding a future period creates matching zero-used allocations for wallets assigned to the campaign within the same transaction. Missing rows are also safely created with the existing unique `(wallet_id, period_id)` key. A quota edit is allowed only for future, unused periods and synchronizes unused allocations without changing `quota_used`. Started or used periods cannot be renamed, changed, or removed. When a future period is removed, only its unused allocation rows are cascade-removed.

Checkout resolves one active period using the transaction completion time. It locks the wallet row, re-reads quota state, and calculates the unchanged subsidy formula with daily remaining, wallet campaign remaining, and period remaining as caps. The wallet, period allocation, wallet transaction, and business transaction are committed together. Daily usage resets on the Bangkok calendar day under the same wallet-row lock. No active period means the subsidized checkout is rejected; there is no fallback to an expired or future period. Campaigns with no period rows keep the legacy behavior.

On 2026-10-28, Campaign `11111111-1111-1111-1111-111111111111` was aligned to three 1,000 THB monthly periods: October `[2026-10-01, 2026-11-01)`, November `[2026-11-01, 2026-12-01)`, and December `[2026-12-01, 2027-01-01)` in Asia/Bangkok. The initial 90 THB discrepancy came from two settled October payments (60 + 30). A further 60 THB government contribution was settled on October 28 and recorded by the active checkout flow. Final October usage is 150 THB with 850 remaining; November and December remain at 1,000 each. Wallet campaign remaining is 2,850 THB. Transaction rows and statuses were unchanged by the maintenance operation; all three settled rows remain FLAGGED_FOR_REVIEW. One separate 150 THB SUCCESS row predates wallet creation and has no wallet ledger, so it was excluded.

The payment PIN/QR and condition-catalog rename migrations were marked applied with Prisma's supported `migrate resolve` workflow after their complete effects were verified in `public`. `20261027160000_campaign_period_exact_quota` was deployed after the quota correction. `prisma migrate status` reports no pending migrations, and the successful local checksums match `_prisma_migrations`. The auth/staff migration was restored from `origin/developer-1-identity-admin-dashboard` commit `8dbeeb6220754313be45d9f51fe8d97a4ef199ab`; its checksum matches the successful database record.

The original creation migration for `campaign_periods` and `wallet_period_quotas` remains unrecovered. Fresh replay is now supported by the versioned bootstrap SQL and `bootstrap-fresh-database.ts`; the full history passed on a disposable PostgreSQL 18 database with Supabase's `anon` and `authenticated` roles. The Supabase development backup archive is readable, but a full restore was not tested because local PostgreSQL lacks Supabase-specific extensions. For quota audit or re-run, use `npx tsx src/scripts/reconcile-campaign-period-usage.ts --campaign-id <campaign-id> --wallet-id <wallet-id>`; this is dry-run by default, and `--apply` is required to write. The script checks cumulative transaction evidence and no-ops when current period allocations already match it.
