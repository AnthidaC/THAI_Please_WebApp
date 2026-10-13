# 🗄️ Database Design & Migration Guide

คู่มือโครงสร้างฐานข้อมูล (PostgreSQL) และการจัดการ Migration ด้วย Prisma ORM

---

## 1. ปรัชญาการตั้งชื่อ (Naming Conventions)
- **Table Name (Model Mapping):** ใช้ `snake_case` รูปพหูพจน์ (Plural) เช่น `@@map("users")`, `@@map("orders")`
- **Column Name (Field):** ใช้ `camelCase` ในโค้ด Prisma (Prisma จะ Map เป็น camelCase หรือ snake_case ตามกำหนด)
- **Primary Key:** ใช้ `id String @id @default(uuid())` หรือ CUID เป็นค่าเริ่มต้น
- **Timestamp:** ทุกตารางควรมี `createdAt DateTime @default(now())` และ `updatedAt DateTime @updatedAt`

---

## 2. โมเดลเริ่มต้น (Current Schema)

### ตาราง `users`
| คอลัมน์ | Data Type | Attribute / Constraint | คำอธิบาย |
| :--- | :--- | :--- | :--- |
| `id` | String (UUID) | `@id @default(uuid())` | รหัสผู้ใช้ |
| `email` | String | `@unique` | อีเมล (ใช้ล็อกอิน) |
| `password` | String | Hash ด้วย Bcrypt | รหัสผ่านที่เข้ารหัสแล้ว |
| `name` | String? | Optional | ชื่อ-นามสกุล |
| `role` | Enum (`USER`, `ADMIN`) | `@default(USER)` | สิทธิ์การเข้าถึง |
| `createdAt` | DateTime | `@default(now())` | วันเวลาที่สร้าง |
| `updatedAt` | DateTime | `@updatedAt` | วันเวลาที่อัปเดตล่าสุด |

---

## 3. ขั้นตอนการแก้ไข Database (Migration Workflow)

เมื่อสมาชิกในทีมต้องการเพิ่มหรือแก้ตาราง:

1. แก้ไขไฟล์ `server/prisma/schema.prisma`
2. สร้างและรัน Migration ไปยัง Database:
   ```bash
   cd server
   npx prisma migrate dev --name <ชื่อการเปลี่ยนแปลง_เช่น_add_post_table>
   ```
3. สั่ง Generate Prisma Client ใหม่:
   ```bash
   npx prisma generate
   ```
4. Commit ไฟล์ใน `server/prisma/migrations/` ขึ้น Git ร่วมกับโค้ด เพื่อให้เพื่อนในทีมรัน `npx prisma migrate dev` ตามได้ทันที
