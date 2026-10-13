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
