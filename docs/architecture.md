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

The latest development `prisma migrate status` reports a database-only migration, `20261027000000_auth_identities_and_staff_roles`, which is not present in the working tree or reachable Git history. The exact-period-quota migration is pending separately. Treat this as unresolved migration-history drift; do not deploy another migration until the missing migration is recovered or its database effects are independently audited.

`schema.prisma` describes the application data model; SQL migration files record database changes. Editing the Prisma schema or generating Prisma Client does not update PostgreSQL. Migration history (`migrate status`) and schema shape (a read-only schema diff) must be checked separately.

The repository includes the applied baseline and the recovered merchant onboarding, merchant profile, and social-impact migrations. The campaign-period and wallet-period tables exist in PostgreSQL but have no migration SQL in the available history; their Prisma models preserve the existing schema and data.

The Badge tier/history migration and the follow-up legacy-table cleanup are applied to the development Supabase database. Before production deployment, test the migrations in staging and use a reviewed workflow with a backup. Do not use `migrate dev`, `db push`, or reset against shared Supabase. PostgreSQL CHECK constraints, partial unique indexes, deferrable unique constraints, and the Badge threshold trigger also require their SQL definitions because Prisma ORM 6 cannot fully represent them.

## 5. Campaign periods and quota enforcement

Campaign administration continues to use the existing `/api/campaigns` endpoints and existing `campaign_periods` / `wallet_period_quotas` tables. Campaigns without periods keep their current quota path. A campaign with periods requires exactly one active period at checkout; a gap, an expired period, or a future period cannot borrow quota from another period.

Period windows use `[start_date, end_date)`: the start instant is included and the end instant is excluded. Admin `datetime-local` inputs and monthly generation use `Asia/Bangkok`, and the API stores the resulting explicit instant in PostgreSQL `timestamptz`. Periods do not overlap and must fit campaign dates. For campaigns with periods, exact configured quota equality is enforced by the API; the corresponding database trigger migration is pending explicit reconciliation of existing campaign data. Campaigns without periods retain legacy behavior.

Wallet period allocations are created on enrollment and lazily for missing periods. Checkout locks the wallet row, re-reads daily and campaign remaining quota, resolves the period using the completion timestamp, and deducts daily, total, and period government contribution within the same transaction as wallet/transaction writes. The cap is the minimum of those available amounts and the existing copay calculation. This preserves the existing government/citizen split and partial-subsidy behavior while preventing concurrent payments from spending the same wallet quota twice.

Only future, unused periods may be changed or removed. A period that has started or has recorded usage is immutable through Admin CRUD. SQL checks and deferred triggers provide a second guard for period ranges, campaign boundaries, overlap, and total configured quota. The period tables predate available migration history, so the constraints migration alters them only and requires a database where the existing tables are already present.

Daily quota dates use the `Asia/Bangkok` calendar day. Wallet reads and checkout serialize reset changes on the wallet row so a concurrent daily reset cannot overwrite a settled payment's quota usage. Admin condition metadata is stored in `badge_condition_types`; executable handler availability still comes from the code-only registry. The condition catalog migration seeds the four registered conditions and preserves existing condition identifiers.

Admin Badge definitions use a fixed four-tier contract: Bronze, Silver, Gold, and Platinum at levels 1–4. The API preserves existing tier IDs and award history, rejects noncanonical legacy structures, and uses the existing integer `required_count` column without a schema migration.
