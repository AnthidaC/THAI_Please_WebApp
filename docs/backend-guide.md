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
