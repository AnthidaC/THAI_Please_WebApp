# THAI Please Web Application

A modern full-stack web application built with **React**, **Express**, **TypeScript**, **PostgreSQL**, and **Redis**.

---

## 🛠 Tech Stack

### 1. Frontend (`/client`)
- **Core:** React 18 + TypeScript + Vite
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
