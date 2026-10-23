# THAI Please Web Application

A modern full-stack web application built with **React**, **Express**, **TypeScript**, **PostgreSQL**, and **Redis**.

---

## 🛠 Tech Stack

### 1. Frontend (`/client`)
- **Core:** React 18 + TypeScript + Vite
- **Design System:** Follows [Coinbase Design System](docs/coinbase.design.md) (Blue `#0052ff`, Pill 100px, Card 24px)
- **Typography:** Google Font **Sarabun** (สำหรับภาษาไทย) & **JetBrains Mono** (สำหรับตัวเลขการเงิน)
- **Styling:** Tailwind CSS
- **Server State & Data Fetching:** TanStack (React) Query v5
- **Client State Management:** Zustand
- **HTTP Client:** Axios (with Bearer Token Interceptor)

### 2. Backend (`/server`)
- **Core:** Node.js + Express + TypeScript
- **Security & Session:** JWT (JSON Web Token) + BcryptJS (Password Hashing)
- **Validation:** Zod (Request validation schemas & Env validation)
- **Dev Tooling:** `tsx` watch mode for lightning-fast TypeScript reload

### 3. Database & Caching
- **Database:** PostgreSQL (รองรับทั้ง Local และ Cloud เช่น Supabase, Neon)
- **ORM:** Prisma ORM
- **Cache:** Redis / Upstash Redis (รองรับทั้ง TCP `redis://` และ Upstash REST `UPSTASH_REDIS_REST_TOKEN`)
- **Containerization:** Docker Compose for local PostgreSQL and Redis

---

## 📂 Project Directory Structure

```text
THAI_Please_WebApp/
├── docs/                           # 📚 เอกสารมาตรฐานและคู่มือการพัฒนาทีม (Markdown)
├── docker-compose.yml              # Local PostgreSQL & Redis services
├── package.json                    # Root workspace script runner
├── README.md
│
├── client/                         # Frontend App (Vite + React + TS)
│   ├── public/
│   ├── src/
│   │   ├── assets/                 # Static assets (images, icons)
│   │   ├── components/             # Reusable UI components
│   │   │   ├── common/             # Navbar, Button, Modal, etc.
│   │   │   └── layout/             # Layout wrappers
│   │   ├── hooks/                  # Custom React & TanStack Query hooks
│   │   ├── lib/                    # Axios client, QueryClient configuration
│   │   ├── services/               # API endpoint service layer
│   │   ├── stores/                 # Zustand state stores (auth, theme, etc.)
│   │   ├── types/                  # TypeScript types & interfaces
│   │   ├── App.tsx                 # Main application view
│   │   ├── main.tsx                # App entrypoint with QueryClientProvider
│   │   └── index.css               # Tailwind CSS entry
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
└── server/                         # Backend API (Express + TS)
    ├── prisma/
    │   └── schema.prisma           # Prisma PostgreSQL data models
    ├── src/
    │   ├── config/                 # Environment validation via Zod
    │   ├── controllers/            # Controller handlers
    │   ├── middlewares/            # Auth, Zod Validator, Error handling
    │   ├── routes/                 # Express route definitions
    │   ├── utils/                  # Prisma client, Redis client, JWT, Bcrypt
    │   ├── validations/            # Zod validation schemas
    │   ├── types/                  # Express type extensions
    │   ├── app.ts                  # Express application setup
    │   └── server.ts               # Server entrypoint
    ├── .env.example
    ├── package.json
    └── tsconfig.json
```

---

## 🚀 Quick Start Guide

### 1. Start Database & Redis (Docker)
```bash
docker compose up -d
```
This starts:
- PostgreSQL on `localhost:5432` (db: `thai_please_db`, user: `postgres`, password: `password`)
- Redis on `localhost:6379`

---

### 2. Backend Setup (`/server`)

1. Copy `.env.example` to `.env`:
   ```bash
   cd server
   cp .env.example .env
   ```
   Set `JWT_SECRET` to a unique random value of at least 32 characters before starting the server.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run Prisma Migration & Generate Client:
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```
4. Start backend dev server:
   ```bash
   npm run dev
   ```
   Server will be running at `http://localhost:5000`

### Merchant onboarding and staff review (staging)

Merchant applications are stored in PostgreSQL, and verification files are uploaded to a **private**
Supabase Storage bucket. Create a private bucket (public access disabled) named
`merchant-applications`, then configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`MERCHANT_DOCUMENTS_BUCKET` in the server environment. The API verifies that the bucket is private
before uploading or creating document links. Review links expire after 60 seconds.

Apply the onboarding migration before starting the API:

```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

Create the first authorized account using `npm run staff:bootstrap` with
`BOOTSTRAP_STAFF_EMAIL`, `BOOTSTRAP_STAFF_PASSWORD` (at least 12 characters),
`BOOTSTRAP_STAFF_NAME`, and `BOOTSTRAP_STAFF_ROLE` (`ADMIN` or `STAFF`) set only in the
operator's environment. The bootstrap command refuses to overwrite an existing account; there is
no public staff registration.

In PowerShell, provide those variables only for the bootstrap process/session:

```powershell
$env:BOOTSTRAP_STAFF_EMAIL = "admin@example.org"
$env:BOOTSTRAP_STAFF_PASSWORD = "use-a-unique-secret-of-at-least-12-characters"
$env:BOOTSTRAP_STAFF_NAME = "System Administrator"
$env:BOOTSTRAP_STAFF_ROLE = "ADMIN"
npm run staff:bootstrap
Remove-Item Env:BOOTSTRAP_STAFF_EMAIL, Env:BOOTSTRAP_STAFF_PASSWORD, Env:BOOTSTRAP_STAFF_NAME, Env:BOOTSTRAP_STAFF_ROLE
```

The review API activates a merchant only after an authorized staff member approves its pending
application. Rejections require a recorded reason. Do not use real identity or bank documents in
staging, and do not enable production collection until access, retention/deletion, privacy notice,
and incident-response policies have been approved. Demo fast-login buttons are UI-only and cannot
authenticate API requests.

### Merchant profile and location changes

Approved merchants can edit their store name, contact details, login email, phone number, and
address from the Merchant Web App. Their tax ID is read-only. Basic profile changes take effect
immediately. A merchant-submitted location change remains pending and the currently approved
coordinates continue to be used for QR payments and fraud checks until authorized staff approves it.
Staff can also edit an approved merchant's profile and coordinates directly; those changes take
effect immediately and are written to the merchant profile audit log. Pending location changes are
reviewed separately at `/admin/merchant-location-requests`.

Deploy the `20261024010000_merchant_profile_editing` Prisma migration before using these pages.

### Admin social impact dashboard

The admin-only dashboard at `/admin/social-impact` refreshes aggregate totals and location bins
every 15 seconds. It reports SUCCESS and FLAGGED transactions with a positive total amount,
including flagged payments awaiting fraud review because the customer payment has already been
charged. The heatmap uses the merchant-side location recorded at payment time (falling back to the
merchant's current location) and groups coordinates to approximately 1 km; it never plots
citizen location data. Deploy the `20261024020000_social_impact_dashboard` migration before use.

---

### 3. Frontend Setup (`/client`)

1. Copy `.env.example` to `.env`:
   ```bash
   cd client
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start frontend dev server:
   ```bash
   npm run dev
   ```
   Client will be running at `http://localhost:5173`

---

### 4. Running from Root
You can also run commands from the project root:
```bash
npm run dev:server   # Starts backend
npm run dev:client   # Starts frontend
npm run db:studio    # Opens Prisma Studio UI
```
