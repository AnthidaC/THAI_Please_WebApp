# 🏗️ Architecture Overview

## 1. High-Level Architecture

ระบบ THAI Please WebApp ถูกออกแบบตามสถาปัตยกรรม **Client-Server Architecture (Decoupled)**:

```
[ Browser / Client ] 
        │
        ▼  (HTTP / JSON / JWT)
[ Express API Server ] 
   ├── Auth Middleware (JWT & Bcrypt)
   ├── Zod Validation Layer
   └── Controller / Service Layer
        │                │
        ▼                ▼
[ PostgreSQL DB ]   [ Redis / Upstash Cache ]
(Via Prisma ORM)    (In-Memory Key-Value)
```

---

## 2. Tech Stack Detail

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **CSS Engine:** Tailwind CSS
- **Server Cache & Querying:** TanStack Query v5
- **Client State Management:** Zustand
- **Router:** React Router DOM v6 (`createBrowserRouter`)
- **HTTP Client:** Axios (Custom Instance with Bearer Token Interceptor)

### Backend
- **Runtime & Web Framework:** Node.js + Express + TypeScript
- **Execution & Hot-Reload:** `tsx watch`
- **Validation:** Zod (Environment variables & Request payload)
- **Security:** Helmet, CORS, JWT (`jsonwebtoken`), BcryptJS
- **Logging:** Morgan

### Database & Caching
- **Database:** PostgreSQL (16+)
- **ORM:** Prisma Client & Prisma Migrate
- **Cache:** Redis 7 / Upstash Redis REST
- **Local Dev:** Docker Compose

## 4. Database Migration and Schema Ownership

The auth/staff migration `20261027000000_auth_identities_and_staff_roles` was restored from remote-tracking branch `origin/developer-1-identity-admin-dashboard`, commit `8dbeeb6220754313be45d9f51fe8d97a4ef199ab`; its checksum matches the successful `_prisma_migrations` record. On 2026-10-28, the payment PIN/QR and condition-catalog rename migrations were marked applied with Prisma's supported `migrate resolve` command after their complete effects were verified in `public`. The target Campaign Periods were reconciled without changing the 3,000 THB campaign total, then `20261027160000_campaign_period_exact_quota` was deployed. `prisma migrate status` reports no pending migrations. The only rolled-back migration row is an earlier Badge attempt followed by its successful retry.

`schema.prisma` describes the application data model; SQL migration files record database changes. Editing the Prisma schema or generating Prisma Client does not update PostgreSQL. Migration history (`migrate status`) and schema shape (a read-only schema diff) must be checked separately.

The repository includes the applied baseline, merchant onboarding/profile, social-impact, Badge, condition-catalog, campaign-period enforcement, payment PIN/QR, condition-table rename, exact-quota, and recovered auth/staff migrations. `campaign_periods` and `wallet_period_quotas` exist in PostgreSQL but their original table-creation migration is absent from all available Git branches and archived materials. Their base definitions are now reproduced in a separate fresh-database bootstrap procedure; no historical migration was invented or rewritten.

All 12 successful migration checksums match the development database; one earlier Badge attempt was rolled back and its successful retry is present, with no unresolved attempts. The current custom-format backup is `.DUMP/phase7-supabase-dev-20261028-pre-incremental-reconciliation.dump`; its archive was fully read by `pg_restore`, but a full restore was not tested because local PostgreSQL lacks Supabase-specific extensions. Fresh replay was tested on a disposable local PostgreSQL database with the Supabase `anon` and `authenticated` roles. Do not use `migrate dev`, `db push`, or reset against shared Supabase. PostgreSQL CHECK constraints, partial unique indexes, row-level security, deferrable constraints, and triggers—including auth identity synchronization and Badge and Campaign Period enforcement—also require their SQL definitions because Prisma ORM 6 cannot fully represent them.

## 5. Campaign periods and quota enforcement

Campaign administration continues to use the existing `/api/campaigns` endpoints and existing `campaign_periods` / `wallet_period_quotas` tables. Campaigns without periods keep their current quota path. A campaign with periods requires exactly one active period at checkout; a gap, an expired period, or a future period cannot borrow quota from another period.

Period windows use `[start_date, end_date)`: the start instant is included and the end instant is excluded. Admin `datetime-local` inputs and monthly generation use `Asia/Bangkok`, and the API stores the resulting explicit instant in PostgreSQL `timestamptz`. Periods do not overlap and must fit campaign dates. For campaigns with periods, exact configured quota equality is enforced by both the API and the applied database trigger migration. Campaigns without periods retain legacy behavior.

Wallet period allocations are created on enrollment, when a future period is added, and lazily for missing periods. Adding a future period and its zero-used allocations is atomic; the operation does not change allocations on existing periods. Checkout locks the wallet row, re-reads daily and campaign remaining quota, resolves the period using the completion timestamp, and deducts daily, total, and period government contribution within the same transaction as wallet/transaction writes. The cap is the minimum of those available amounts and the existing copay calculation. This preserves the existing government/citizen split and partial-subsidy behavior while preventing concurrent payments from spending the same wallet quota twice.

Only future, unused periods may be changed or removed through Admin CRUD. A period that has started or has recorded usage is immutable. SQL checks and deferred triggers provide a second guard for period ranges, campaign boundaries, overlap, and exact configured quota. The period tables predate available migration history, so fresh databases use `server/src/scripts/bootstrap-fresh-database.ts`: it applies the recorded migrations through `20261027130000`, creates the verified base tables, then applies the remaining recorded migrations. It refuses non-empty schemas and never edits `_prisma_migrations` directly.

The development Campaign `11111111-1111-1111-1111-111111111111` has three 1,000 THB periods with exact Bangkok month boundaries: October `[2026-10-01, 2026-11-01)`, November `[2026-11-01, 2026-12-01)`, and December `[2026-12-01, 2027-01-01)`. The initial audit found two settled October payments with government contributions of 60 THB and 30 THB; their citizen ledger entries are 40 THB and 20 THB. These were backfilled into October without changing the wallet's 2,910 THB remaining quota. A further October 28 payment later consumed 60 THB government quota and 40 THB citizen balance; the checkout flow updated both wallet and period usage. Final October usage is 150 THB with 850 THB remaining, and campaign wallet quota remaining is 2,850 THB. November and December remain unused at 1,000 THB each. All three settled payments remain FLAGGED for review, with their transaction status and history unchanged. A separate 150 THB SUCCESS record completed before this wallet existed and has no wallet ledger entry, so it was excluded. No completed transaction fell within the one-second boundary windows.

Daily quota dates use the `Asia/Bangkok` calendar day. Wallet reads and checkout serialize reset changes on the wallet row so a concurrent daily reset cannot overwrite a settled payment's quota usage. Shared condition metadata is stored in `condition_types`; quests and badges reference its immutable keys, while executable handler availability still comes from the code-only registry. The condition catalog migration seeds the four registered conditions and preserves existing condition identifiers.

Admin Badge definitions use a fixed four-tier contract: Bronze, Silver, Gold, and Platinum at levels 1–4. The API preserves existing tier IDs and award history, rejects noncanonical legacy structures, and uses the existing integer `required_count` column without a schema migration.
