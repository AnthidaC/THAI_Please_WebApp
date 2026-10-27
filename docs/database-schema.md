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

## 2. Database tables (29 live after Badge migration, legacy cleanup, and condition catalog)

The `0_init` baseline contains 18 tables. The applied merchant onboarding and profile migrations add six tables, and the existing campaign-period and wallet-quota tables add two more. The database had 26 application tables before the Badge migration. That migration added the tiered Badge structures and temporarily retained two legacy tables; a follow-up migration removed those empty archives, leaving 28 live application tables.

| ตาราง | วัตถุประสงค์ / ความสัมพันธ์ | ผู้รับผิดชอบ (Dev) |
| :--- | :--- | :---: |
| `users` | ข้อมูลประชาชน (`citizen_id_hash`, `province_code`, `is_registered_thai_plus`) | Dev 1 |
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

Run `migrate dev` only against an isolated local database; it can modify its target. Do not point it at shared Supabase. Use `migrate deploy` only for reviewed migrations after staging verification and a backup. Do not use `db push` or reset to repair migration history.

## 4. Migration history and schema reconciliation

The latest development `prisma migrate status` also reports a database-only migration, `20261027000000_auth_identities_and_staff_roles`, missing from local `prisma/migrations/`. No matching file or commit was found in the working tree or reachable Git history. This is unresolved migration-history drift, in addition to the pending quota-equality migration. Do not run `migrate deploy` until the missing migration is recovered from a verifiable source or its effects are independently audited and a recovery plan is approved.

The applied migration history includes `0_init`, `20261024000000_merchant_onboarding`, `20261024010000_merchant_profile_editing`, `20261024020000_social_impact_dashboard`, `20261027120000_badge_series_and_tiers`, `20261027130000_remove_legacy_badge_tables`, and `20261027150000_condition_type_catalog`. The three historical SQL files were recovered from their original Git commits without rewriting them. They create the merchant onboarding/profile tables and the two transaction indexes. `20261027160000_campaign_period_exact_quota` is intentionally pending: campaign `11111111-1111-1111-1111-111111111111` has a total quota of 3,000.00 and period quotas totaling 2,000.00. Do not change those historical allocations implicitly or apply the equality migration until an administrator explicitly reconciles the campaign.

Migration history and schema shape are separate checks: `migrate status` checks migration files against `_prisma_migrations`, while a schema diff compares database objects with the Prisma datamodel. Do not treat a successful status check as proof that the schemas match.

`campaign_periods` and `wallet_period_quotas` already exist and contain data, but have no corresponding migration SQL in the available repository history. Their Prisma models are restored from the historical schema commit and checked against PostgreSQL metadata. Do not generate a create-table migration or use `db push` for these existing tables.

Prisma ORM 6 does not fully represent PostgreSQL CHECK constraints, partial-index predicates, or deferrable unique constraints. The merchant CHECK constraints and the partial unique indexes `uq_merchant_applications_active_email` and `uq_merchant_location_requests_pending_merchant` remain defined by the historical SQL. The applied Badge migration defines CHECK constraints, deferrable unique constraints for tier ordering edits, and a deferred threshold trigger outside the Prisma datamodel. Keep those migration files intact and verify these features directly in PostgreSQL metadata; a Prisma schema diff cannot fully validate them.

Before deploying any migration, restore and verify applied migration files, reconcile models for every live table, confirm schema diffs contain no unintended drops, test against staging, and take a database backup. The Badge migration is applied in the development database; production deployment still requires staging verification.

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

`campaign_periods` and `wallet_period_quotas` are existing PostgreSQL tables with data. Their original create-table migration is not available in this repository; do not recreate either table or alter an old migration. The new `20261027140000_campaign_period_quota_enforcement` migration only adds CHECK constraints and database triggers to those existing tables.

- Each period belongs to one campaign and uses a half-open `[start_date, end_date)` window. Periods must stay inside campaign dates and must not overlap. Adjacent periods can share an exact end/start instant.
- `period_quota_limit` is a non-negative government contribution cap. A wallet has one row per period under `uq_wallet_period_quotas_wallet_period`; `quota_used` may not exceed `quota_limit`, `quota_remaining` may not be negative, and `quota_remaining = quota_limit - quota_used`.
- For period-enabled campaigns, the API requires `sum(period_quota_limit) = campaigns.total_quota_limit` using integer cents. The pending `20261027160000_campaign_period_exact_quota` migration adds database-level equality enforcement after read-only preflight; it currently refuses the known mismatch. Campaigns without periods remain compatible and exempt.
- Period quota rows remain independent. Unused quota expires at the period end and is never carried into a later period.
- SQL CHECK constraints enforce per-row ranges. Deferred database triggers serialize period writes on the parent campaign and verify non-overlap, campaign containment, and the configured total at commit. Prisma ORM 6 does not model these triggers or cross-table rules; preserve their SQL migration definitions.

Daily quota accounting uses the Bangkok calendar date, stored as PostgreSQL `DATE`. Wallet reads and checkout serialize daily resets with a wallet-row lock. `badge_condition_types.condition_key` is unique and referenced by `badges.condition_type`; its immutable-key trigger protects Badge references. The catalog stores display/workflow metadata only. Handler availability comes from the backend registry and must not be inferred from a catalog row alone.

The new migration assumes these historical tables already exist. A clean database still needs a verified schema baseline that includes them; do not fabricate their missing historical migration. Back up the target database and run the read-only preflight before applying the constraints migration.
