# 🗄️ Database Design & Migration Guide (Supabase PostgreSQL)

คู่มือโครงสร้างฐานข้อมูล (PostgreSQL บน Supabase) และโมเดลที่ซิงค์กับ Prisma ORM ล่าสุด

---

## 1. การเชื่อมต่อ Supabase PostgreSQL

ระบบรองรับ **Supabase** อย่างเป็นทางการด้วยสถาปัตยกรรม 2 พอร์ต (ตามมาตรฐาน Prisma + Supabase):

- **`DATABASE_URL` (Transaction Pooler - Port 6543):**
  สำหรับ Express Backend รันคิวรีทั่วไป รองรับ Concurrent requests สูง ป้องกัน Connection เต็ม
- **`DIRECT_URL` (Direct Connection - Port 5432):**
  สำหรับรันคำสั่ง `prisma migrate` ซึ่งต้องใช้ Direct Session ในการล็อกตารางสร้าง Schema

```prisma
// server/prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## 2. Database tables (32 public application tables observed on 2026-10-28)

The live table list includes objects whose creation is not fully represented in migration history: the period tables have no recovered creation migration. The payment tables existed before their migration was reconciled, and their SQL is now represented in migration history. Count the current schema from the inspected public catalog, not from migration filenames alone. `_prisma_migrations` is excluded from the 32 application tables.

| ตาราง | วัตถุประสงค์ / ความสัมพันธ์ | ผู้รับผิดชอบ (Dev) |
| :--- | :--- | :---: |
| `users` | ข้อมูลประชาชน (`citizen_id_hash`, `province_code`, `is_registered_thai_plus`) | Dev 1 |
| `auth_identities` | Email identity registry for merchant applications and staff accounts; the current app does not use an external identity provider | Dev 1 |
| `staff_accounts` | Staff identities used to review merchant applications and location requests | Dev 1 |
| `wallets` | กระเป๋าเงินดิจิทัลประชาชน เชื่อมกับ `campaigns` และ `users` | Dev 2 |
| `wallet_period_quotas` | Per-wallet quota usage for a campaign period | Dev 2 |
| `wallet_transactions` | บัญชีแยกประเภทธุรกรรมกระเป๋าเงิน (Ledger) | Dev 2 |
| `campaigns` | แคมเปญ Co-pay รัฐ (เช่น อัตราจ่ายร่วม 60/40, โควตา 150 บาท/วัน, รวม 3,000 บาท) | Dev 4 |
| `campaign_periods` | Named periods and quota limits within a campaign | Dev 2 |
| `merchants` | ร้านค้า (`tax_id`, พิกัด `latitude`, `longitude`, สถานะอนุมัติ) | Dev 1 |
| `merchant_applications` | Submitted merchant onboarding applications | Dev 1 |
| `merchant_application_documents` | Private document metadata attached to an application | Dev 1 |
| `merchant_application_audit_logs` | Staff decisions and notes for merchant applications | Dev 1 |
| `merchant_location_change_requests` | Merchant location changes awaiting staff review | Dev 1 |
| `merchant_profile_audit_logs` | Merchant profile changes with actor metadata | Dev 1 |
| `transactions` | การทำธุรกรรมชำระเงินระหว่างประชาชนและร้านค้า (`qr_reference`) | Dev 2 |
| `payment_pins` | One payment-PIN hash and lock state per user; the hash is not returned by APIs | Dev 2 |
| `payment_qr_codes` | Persistent dynamic QR state for a merchant | Dev 2 |
| `fraud_checks` | ตรวจสอบพิกัด GPS ระหว่างผู้ซื้อและร้านค้า ป้องกันการทุจริตข้ามพื้นที่ | Dev 2 |
| `recommendation_logs` | บันทึกการแนะนำร้านค้าของระบบ AI Near-Me และ Conversion Rate | Dev 3 |
| `referrals` | ระบบแนะนำเพื่อนรับสิทธิ์/คูปอง (`referral_code`) | Dev 3 |
| `reviews` | รีวิวและคะแนนประเมินร้านค้าหลังทำรายการ (จำกัด 24 ชม.) | Dev 3 |
| `quests` | ภารกิจ Gamification ภายในแคมเปญ | Dev 4 |
| `user_quests` | สถานะการทำภารกิจของผู้ใช้งาน | Dev 4 |
| `badge_condition_types` | Thai condition metadata and implementation workflow; handler availability comes from the backend registry | Dev 4 |
| `badges` | เหรียญตราความสำเร็จแบบหลายระดับ | Dev 4 |
| `badge_tiers` | Tier names, levels, thresholds, and optional icons for each Badge series | Dev 4 |
| `user_badge_history` | Permanent per-tier unlock timestamps | Dev 4 |
| `user_badges` | เหรียญตราระดับสูงสุดที่ผู้ใช้งานได้รับ | Dev 4 |
| `rewards` | คูปองและของรางวัลที่แลกได้ | Dev 4 |
| `user_rewards` | คูปองส่วนลดที่ผู้ใช้งานถือครอง | Dev 4 |
| `user_category_preferences` | หมวดหมู่ร้านค้าที่ผู้ใช้งานสนใจ | Dev 3 |
| `daily_social_impact_metrics` | ตัวชี้วัดผลกระทบทางสังคมรายวัน แยกตามจังหวัด สำหรับผู้บริหารภาครัฐ | Dev 1 |

---

## 3. กฎการอัปเดต Database (Migration Workflow)

เนื่องจากฐานข้อมูลมีโครงสร้างจริงบน Supabase แล้ว:

1. **ห้ามรัน `prisma migrate reset` เด็ดขาด** เพราะจะลบตารางและข้อมูลทั้งหมดใน Supabase ทิ้ง
2. **หากต้องการดึง Schema ล่าสุดจาก Supabase ลงมาในโค้ด:**
   ```bash
   cd server
   npx prisma db pull
   npx prisma generate
   ```
3. **หากมีการเพิ่ม/แก้ฟิลด์ใหม่ใน `schema.prisma`:**
   ```bash
   npx prisma migrate dev --name <ชื่อการเปลี่ยนแปลง>
   ```

## 4. Migration history and schema reconciliation

### Recovered auth/staff migration

The original `20261027000000_auth_identities_and_staff_roles` migration was recovered from remote-tracking branch `origin/developer-1-identity-admin-dashboard`, commit `8dbeeb6220754313be45d9f51fe8d97a4ef199ab` (`home-role-edit`). Its original path is `server/prisma/migrations/20261027000000_auth_identities_and_staff_roles/migration.sql`; the companion `down.sql` was restored from the same commit. The SHA-256 of the original Git blob and restored file is `89bf94fae6d5238541f60247555a33d6dd99e73d3ff00484e29ed4f2e6bb37ee`, identical to the successful `_prisma_migrations` record. The database records it as applied on 2026-10-27.

The migration changes the staff role check to `ADMIN` / `GOVERNMENT_EXECUTIVE`, creates `auth_identities`, backfills active merchant applications and staff accounts, and maintains the registry with triggers. `account_id` is intentionally polymorphic, so the table has no foreign key to either source table. The app has no ThaiD or NDID integration; global mock login resolves only test-marked Citizens, approved Merchants, and active Admin staff linked through `auth_identities`. The current Prisma model represents its columns and unique key; PostgreSQL check constraints and synchronization triggers stay in SQL.

### Current development database status

The read-only audit on 2026-10-28 found 32 application tables in `public`, plus Prisma's `_prisma_migrations` table. `auth_identities`, `payment_pins`, `payment_qr_codes`, and `badge_condition_types` contain 3, 1, 3, and 4 rows, respectively. Schema metadata and aggregate counts only were queried; no credential, PIN hash, token, or personal row data was selected.

`_prisma_migrations` records the restored auth/staff migration as applied, and its checksum matches. All successful local migration checksums match `_prisma_migrations`. The payment and condition-table rename migrations were recorded as applied with Prisma's supported `migrate resolve --applied` command only after their complete database post-states were verified. The exact-quota migration was applied with `migrate deploy` after period data was corrected. `prisma migrate status` reports the database schema is up to date. The migration table has one rolled-back attempt for the Badge tier migration followed by its successful retry; there is no unresolved failed attempt.

The three migrations that had been pending were reconciled as follows:

- `202610270001_payment_pin_and_qr`: the two tables, exact column definitions, keys, foreign keys, expiry index, RLS settings, revoked Supabase API-role privileges, and partial unique paid-QR index were already present. The migration was marked applied; its table-creation SQL was not executed against the populated tables.
- `20261027180000_rename_condition_catalog_table`: `public.badge_condition_types` existed and `public.achievement_condition_types` did not. The migration's post-state was already present, so Prisma recorded it as applied without another rename. The existing primary-key index name remains `achievement_condition_types_pkey` and is mapped in Prisma.
- `20261027160000_campaign_period_exact_quota`: after the existing campaign was configured with three 1,000 THB periods, `migrate deploy` applied the exact-equality trigger. There are no period-enabled campaigns whose configured sum differs from the campaign total.

The models for `payment_pins` and `payment_qr_codes` already existed in Prisma and match the live columns, defaults, keys, foreign keys, and expiry index. `payment_pins.user_id` cascades from `users`; `payment_qr_codes.merchant_id` references `merchants` with the database default `NO ACTION`. RLS is enabled on both payment tables and no RLS policies are present. The payment PIN hash remains selected only inside the server-side verification flow.

Migration status and schema shape are separate checks. The read-only Prisma schema diff reports no difference for Prisma-supported database objects. Prisma ORM 6 does not report all SQL-managed objects, including CHECK constraints, triggers, partial-index predicates, RLS, or deferrable constraints.

SQL-managed features that must remain intact include the auth email/type checks and identity-sync triggers; the staff role check; the payment tables' enabled RLS, absence of policies/grants to `anon`, `authenticated`, or `PUBLIC`, and the `uq_transactions_paid_qr_reference` partial index; merchant checks and partial unique indexes; campaign-period checks and deferred integrity triggers; and Badge checks, deferred constraints/triggers, and the condition-key immutability trigger. Prisma models describe the supported columns, relations, and indexes but do not replace those SQL definitions.

The Supabase catalog also lists `pgcrypto` 1.3, `uuid-ossp` 1.1, `pg_stat_statements` 1.11, `supabase_vault` 0.3.1, and `plpgsql` 1.0. Historical migrations use `gen_random_uuid()` defaults; no extension-specific column types or other extension functions were found in the migration SQL. These extensions are outside the Prisma datamodel and should be managed by the database platform.

A fresh custom-format backup was created at `.DUMP/phase7-supabase-dev-20261028-pre-incremental-reconciliation.dump`; the full archive was read by `pg_restore` and contains 33 public-table data entries. A full restore was not tested because local PostgreSQL does not have the Supabase-specific extensions used by the hosted database.

### Campaign-period creation history and replay gap

`campaign_periods` and `wallet_period_quotas` exist in `public`, and their current Prisma models match the inspected columns, defaults, keys, foreign keys, and indexes. No original create-table SQL was found in any local or remote-tracking branch, reachable migration history, or archived project materials. The first located Prisma schema addition is commit `b93bd8d31ef201af1be892de8a3cf3e5e9ec0d58`; that commit contains no period-table creation migration. A scan of 406 unreachable Git blobs found no matching `CREATE TABLE` SQL, and there were no unreachable commits. The ignored `.DUMP` directory contains design documents and image assets, not database dumps or migration scripts.

Fresh replay would stop at `20261027140000_campaign_period_quota_enforcement` because `0_init` does not create the period tables and the quota migration alters them. The original migration remains unrecovered; do not add a fabricated historical migration or use `db push`. Use `npx tsx src/scripts/bootstrap-fresh-database.ts --apply` from `server/` for an empty development database. The runner applies the recorded migrations through `20261027130000`, executes the verified base-table SQL in `prisma/bootstrap/campaign_period_tables.sql`, then applies the remaining recorded migrations. It requires the Supabase roles `anon` and `authenticated`, refuses any non-empty `public` schema, and never writes `_prisma_migrations` itself. This complete replay passed on a disposable PostgreSQL 18 database with those two Supabase roles present.

The live development migration history is consistent and the documented bootstrap procedure makes an empty development replay reproducible, although the historical source migration is still absent. Before production deployment, test against staging and use a restore-tested backup plan. This development reconciliation does not establish production readiness.

## 5. Badge series and safe migration

The Badge schema below describes the current post-migration model. The development database has the tiered Badge schema, and the cleanup migration removed the two empty legacy archive tables.

`badges` stores one row per unique `condition_type`. `badge_tiers` stores its tier name, positive level, increasing positive threshold, and optional icon URL. A user's `user_badges` row stores the highest unlocked tier for a series; `user_badge_history` preserves each tier unlock and its timestamp.

Migration `20261027120000_badge_series_and_tiers` renamed the old `badges` and `user_badges` tables to `badges_legacy` and `user_badges_legacy`, then copied Badge rows into tiers and unlocks into history. It chose the highest earned tier for each current-state row. After verifying both legacy tables were empty and had no external dependencies, migration `20261027130000_remove_legacy_badge_tables` dropped the archives. Restrictive foreign keys prevent deleting a Badge or tier that still has current or historical unlocks.

Before renaming the legacy tables, the migration checks for unknown tier names, conflicting Badge names/descriptions within one condition, duplicate levels or thresholds, non-increasing thresholds, and duplicate legacy user/Badge rows. It aborts with an explicit error when it finds a conflict. Multiple legacy rows with one `condition_type` are expected: they become that Badge series' separate tiers. Resolve any reported conflict against a reviewed backup; do not delete or merge earned records to make the migration pass.

Deployment requires a database backup and a staging migration first. Review the migration preflight errors and row-count checks, then deploy with `npx prisma migrate deploy` through the direct migration connection. Regenerate Prisma Client and deploy the server and client together. Do not run `migrate reset`, `db push`, or this migration against production as part of local development.

## 6. Badge award writes

The award engine writes only two tables, inside one transaction per Badge:

- `user_badge_history` — one row per unlocked tier. `uq_user_badge_history_user_tier (user_id, badge_tier_id)` makes duplicate unlocks impossible; the engine inserts with `skipDuplicates`.
- `user_badges` — the current highest tier per series. `uq_user_badges_user_badge_current (user_id, badge_id)` keeps one row; the engine only updates when the new `tier_level` is higher.

Each evaluation first takes `SELECT … FROM users WHERE user_id = $1 FOR UPDATE`, which serialises concurrent evaluations for the same user. The composite foreign key `(badge_id, badge_tier_id)` guarantees a history row points at a tier of the same Badge. A failed award transaction leaves no partial state; it never touches `transactions`, `referrals`, `reviews`, `wallets`, or `wallet_transactions`.

Reconciliation timestamps missing unlocks at the time it runs, because the schema stores only `earned_at`; it never backdates or deletes rows. The Badge constraints are applied in the development database; verify them in staging before production deployment. See `badge-award-engine.md`.

## 7. Campaign periods and wallet allocations

`campaign_periods` and `wallet_period_quotas` are existing PostgreSQL tables with data. Their original create-table migration is not available in the recovered Git history; do not alter an old migration or recreate these tables in an existing database. The applied `20261027140000_campaign_period_quota_enforcement` migration adds CHECK constraints and database triggers. For a fresh database only, the documented bootstrap runner creates the verified base definitions immediately before that migration.

- Each period belongs to one campaign and uses a half-open `[start_date, end_date)` window. Periods must stay inside campaign dates and must not overlap. Adjacent periods can share an exact end/start instant.
- `period_quota_limit` is a non-negative government contribution cap. A wallet has one row per period under `uq_wallet_period_quotas_wallet_period`; `quota_used` may not exceed `quota_limit`, `quota_remaining` may not be negative, and `quota_remaining = quota_limit - quota_used`.
- For period-enabled campaigns, the API and applied `20261027160000_campaign_period_exact_quota` migration require `sum(period_quota_limit) = campaigns.total_quota_limit` using exact cents. Campaigns without periods remain compatible and exempt.
- Period quota rows remain independent. Unused quota expires at the period end and is never carried into a later period.
- SQL CHECK constraints enforce per-row ranges. Deferred database triggers serialize period writes on the parent campaign and verify non-overlap, campaign containment, and the configured total at commit. Prisma ORM 6 does not model these triggers or cross-table rules; preserve their SQL migration definitions.

Daily quota accounting uses the Bangkok calendar date, stored as PostgreSQL `DATE`. Wallet reads and checkout serialize daily resets with a wallet-row lock. `badge_condition_types.condition_key` is unique and referenced by `badges.condition_type`; its immutable-key trigger protects Badge references. The catalog stores display/workflow metadata only. Handler availability comes from the backend registry and must not be inferred from a catalog row alone.

On 2026-10-28, Campaign `11111111-1111-1111-1111-111111111111` retained its 3,000 THB total and was aligned to three exact Bangkok calendar months. October, November, and December now meet at `2026-10-31T17:00:00Z` and `2026-11-30T17:00:00Z`; December ends at `2026-12-31T17:00:00Z`. No completed transaction occurred in either one-second boundary window.

Quota reconciliation used `completed_at` as the settlement instant, matching `payment.service.ts`. The initial audit found two settled FLAGGED payments after the target wallet was created with government contributions of 60 THB and 30 THB, and citizen wallet-ledger entries of 40 THB and 20 THB. A further October 28 settlement contributed 60 THB government quota and 40 THB citizen balance; the payment flow recorded it in both wallet and period usage. All three fraud checks remain `FLAGGED_FOR_REVIEW`; these payments were settled and review did not refund or reverse them. Final October usage is 150 THB with 850 THB remaining. Wallet campaign quota remaining is 2,850 THB, and the November/December allocations remain unused at 1,000 THB each. A 150 THB SUCCESS row completed before this wallet was created and has no wallet ledger entry; it was excluded from period usage. The wallet ledger records citizen payments, not a separate government subsidy entry, so the government total is corroborated by transaction records, settlement code, and wallet campaign quota delta rather than a dedicated government ledger row.

The reconciliation script is dry-run by default and requires explicit `--apply`; it locks the target campaign, wallet, periods, and allocations, verifies all settled government contributions against matching citizen ledger rows and wallet remaining quota, updates only period dates and period usage, and verifies its final state. It supports cumulative later settlements and is a no-op when the allocations already match. Final monthly allocations total 150 THB used and 2,850 THB remaining, matching wallet campaign quota remaining.
