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

## 2. ตารางในระบบทั้งหมด 18 ตาราง (Synchronized with Supabase)

ระบบได้ทำการ Introspect และ Baseline ร่วมกับ Cloud Supabase เรียบร้อยแล้ว ประกอบด้วยตารางหลัก 18 ตาราง:

| ตาราง | วัตถุประสงค์ / ความสัมพันธ์ | ผู้รับผิดชอบ (Dev) |
| :--- | :--- | :---: |
| `users` | ข้อมูลประชาชน (`citizen_id_hash`, `province_code`, `is_registered_thai_plus`) | Dev 1 |
| `wallets` | กระเป๋าเงินดิจิทัลประชาชน เชื่อมกับ `campaigns` และ `users` | Dev 2 |
| `wallet_transactions` | บัญชีแยกประเภทธุรกรรมกระเป๋าเงิน (Ledger) | Dev 2 |
| `campaigns` | แคมเปญ Co-pay รัฐ (เช่น อัตราจ่ายร่วม 60/40, โควตา 150 บาท/วัน, รวม 3,000 บาท) | Dev 4 |
| `merchants` | ร้านค้า (`tax_id`, พิกัด `latitude`, `longitude`, สถานะอนุมัติ) | Dev 1 |
| `transactions` | การทำธุรกรรมชำระเงินระหว่างประชาชนและร้านค้า (`qr_reference`) | Dev 2 |
| `fraud_checks` | ตรวจสอบพิกัด GPS ระหว่างผู้ซื้อและร้านค้า ป้องกันการทุจริตข้ามพื้นที่ | Dev 2 |
| `recommendation_logs` | บันทึกการแนะนำร้านค้าของระบบ AI Near-Me และ Conversion Rate | Dev 3 |
| `referrals` | ระบบแนะนำเพื่อนรับสิทธิ์/คูปอง (`referral_code`) | Dev 3 |
| `reviews` | รีวิวและคะแนนประเมินร้านค้าหลังทำรายการ (จำกัด 24 ชม.) | Dev 3 |
| `quests` | ภารกิจ Gamification ภายในแคมเปญ | Dev 4 |
| `user_quests` | สถานะการทำภารกิจของผู้ใช้งาน | Dev 4 |
| `badges` | ตราประทับเกียรติยศระดับต่างๆ | Dev 4 |
| `user_badges` | ตราประทับที่ผู้ใช้งานได้รับ | Dev 4 |
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
