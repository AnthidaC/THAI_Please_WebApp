# Dev2: PIN และการปรับปรุงระบบชำระเงิน

Branch: `fix/dev2-payment-pin-and-safety`

## การตั้งและใช้งาน PIN

- หลังเข้าสู่ระบบ บัญชีประชาชนที่ไม่มี PIN จะเห็นกล่องตั้ง PIN อัตโนมัติบนทุกหน้าที่ใช้ RootLayout
- ต้องกรอก PIN ตัวเลข 6 หลักและยืนยันให้ตรงกัน กล่องจะปิดเมื่อ API บันทึกสำเร็จ กด Escape หรือคลิกด้านนอกเพื่อข้ามไม่ได้ และออกจากระบบได้
- บัญชีที่มี PIN แล้วจะไม่ถูกถามให้ตั้งซ้ำ การเปลี่ยนบัญชีจะตรวจสถานะใหม่ แยก cache ตาม session
- เปลี่ยน PIN ได้ที่หน้ากระเป๋าเงิน → เมนูตั้งค่าความปลอดภัยด้านล่าง → กล่องเปลี่ยน PIN โดยต้องยืนยัน PIN ปัจจุบัน ไม่มีการรีเซ็ต PIN โดยข้ามการยืนยันตัวตน ไม่แสดงการ์ด PIN แทรกเหนือยอดเงิน
- ลืม PIN: ในกล่องเปลี่ยน PIN กด "ลืม PIN?" → ระบบให้เข้าสู่ระบบใหม่เพื่อยืนยันตัวตน แล้วพากลับมาหน้ากระเป๋าเงินเพื่อตั้ง PIN ใหม่โดยไม่ต้องใช้ PIN เดิม (`POST /api/wallet/pin/reset` รับเฉพาะ JWT ที่ออกภายใน 10 นาที มิฉะนั้นตอบ 403 `REAUTH_REQUIRED`) ไม่มีปุ่มลืม PIN บนหน้าจ่ายเงิน
- กล่องบังคับตั้ง PIN เปิดเฉพาะเมื่อ server ยืนยันว่ายังไม่มี PIN ถ้าตรวจสถานะล้มเหลวจะไม่แสดงกล่อง error ขวางหน้าจอ (checkout ยังบังคับ PIN ฝั่ง server)
- โหมด development เท่านั้น: หน้า login ขอ JWT ที่เซ็นโดย backend ผ่าน `/api/auth/demo-login` สำหรับบัญชีที่ระบุใน allowlist แยกตามบทบาท ไม่มีการเลือกผู้ใช้คนแรกจากฐานข้อมูล และ endpoint นี้ปิดใน production
- API checkout บังคับ PIN และเทียบ bcrypt hash ก่อนตัดเงิน กรอกผิด 5 ครั้งล็อก 15 นาที ตัวนับเก็บใน DB จึงไม่หายเมื่อ server restart
- การจ่ายแยกเป็นสองขั้นตอน: หน้าสรุปยอดไม่มีช่อง PIN เมื่อกดยืนยันชำระเงินจะเปิดหน้ากรอก PIN เต็มจอพร้อมยอดจ่ายและชื่อร้าน ใช้แป้นตัวเลข 6 หลักแล้วส่งยืนยันทันที กลับไปตรวจยอดได้ก่อนส่งรายการ ระหว่างส่งคำขอจะล็อกแป้นเพื่อป้องกันการส่งซ้ำ
- เก็บ hash ในตาราง `payment_pins` แยกจาก User/Wallet เพื่อไม่ปนไปกับผลลัพธ์ login หรือ wallet เดิม ไม่ส่ง hash กลับ client

| Method | Endpoint | การใช้งาน |
| --- | --- | --- |
| GET | `/api/wallet/pin/status` | `{ isSet, lockedUntil }` ของบัญชีปัจจุบัน |
| PUT | `/api/wallet/pin` | `{ pin, confirmPin, currentPin? }`; ต้องส่ง currentPin เมื่อมี PIN แล้ว |
| POST | `/api/payment/qr/checkout` | ต้องมี `pin` 6 หลักเพิ่มเติมจากข้อมูล QR และพิกัด |

รหัสข้อผิดพลาด PIN ได้แก่ `PIN_NOT_SET`, `PIN_REQUIRED`, `PIN_INCORRECT`, `PIN_LOCKED`, `CURRENT_PIN_REQUIRED` และ `PIN_INVALID` โดย PIN ผิดใช้ HTTP 400 และล็อกใช้ HTTP 429 เพื่อไม่ให้ client ตีความเป็น session หมดอายุ

## ขอบเขตการเชื่อมกับ Dev1

ไม่ได้แก้หน้า login/register หรือ `auth.middleware.ts` ระบบ PIN ตรวจสถานะจาก session ที่ login จัดเตรียมไว้ผ่าน RootLayout

API การเงินใช้ Bearer JWT ที่ตรวจลายเซ็นด้วย `verifyToken` เดิม ไม่ใช้ fallback ผู้ใช้คนแรกหรือ demo token บัญชีประชาชนใช้ claim `userId` เป็น `users.user_id` และ role `CITIZEN` หรือ `USER` ส่วนร้านค้าใช้ role `MERCHANT` และ `userId` เป็น `merchant_applications.application_id` หรือ `merchant_id` ที่ผูกกับใบสมัครร้านค้า

ปุ่มเข้าสู่ระบบจำลองประชาชน ร้านค้า และผู้ดูแลเรียก `/api/auth/demo-login` และรับ JWT ที่เซ็นจริง โดย API การเงินยังตรวจลายเซ็นและ role ตามปกติ Static demo token และ fallback ไปยังบัญชีแรกไม่รองรับแล้ว ส่วน integration tests ใช้ JWT ที่เซ็นจริงใน schema ทดสอบ

## การชำระเงินและข้อมูลร้านค้า

- Dynamic QR เก็บใน `payment_qr_codes` และใช้ UUID รองรับ restart และหลาย server โดยไม่พึ่ง Map ใน process
- ยึดสิทธิ์ QR ภายใน transaction เดียวกับตัดเงิน/โควตา/คูปอง/ledger และเก็บสถานะการจ่าย เมื่อขั้นตอนใดล้มเหลวจะ rollback ทั้งหมด
- ล็อกแถวกระเป๋าเงินและตรวจยอดล่าสุด หากมีรายการอื่นเปลี่ยนยอดระหว่างคำนวณ จะให้ตรวจยอดใหม่แทนใช้ข้อมูลเก่า การเติมเงินใช้ DB increment ป้องกันยอดทับกัน
- วงเงินสมทบต้องไม่เกินทั้งโควตารวมและโควตารอบย่อย แม้รอบย่อยยังเหลือมากกว่าวงเงินรวม
- มี partial unique index ป้องกัน QR เดียวมีธุรกรรม SUCCESS/FLAGGED มากกว่าหนึ่งรายการ โดยยังเก็บประวัติ REJECTED ได้
- สลิปอ่านได้เฉพาะผู้จ่าย ร้านค้าดูยอดขาย/สถานะ QR และสร้าง QR ได้เฉพาะร้านที่ผูกกับบัญชี เลิกเลือกร้านแรกอัตโนมัติ
- SSE ใช้ fetch streaming พร้อม Bearer header และมี polling สำรองข้าม process
- ประวัติร้านค้าเลือกวันที่ได้ด้วย `?date=YYYY-MM-DD` ยอดสรุปและรายการตรงกับวันไทยเดียวกัน; ไม่ส่ง date คือทั้งหมด
- รีเซ็ตโควตาที่เที่ยงคืนไทย พร้อมเงื่อนไขป้องกันคำขอเก่ารีเซ็ตยอดที่เพิ่งใช้ไปแล้ว การสมัครโครงการเดิมซ้ำไม่เติมสิทธิ์กลับ
- Fraud baseline ใช้สถานะธุรกรรม SUCCESS/FLAGGED และวันไทย การอนุมัติผลตรวจของรายการ REJECTED ไม่เปลี่ยนให้เป็นรายการจ่ายสำเร็จโดยไม่มีการตัดเงิน

## ฐานข้อมูลและการทดสอบ

ดึง schema ล่าสุดจาก Supabase ก่อนเพิ่มโมเดล Dev2 และรักษา `badge_tiers`/`user_badge_history` ที่ทีมเพิ่มไว้ ไม่แก้โค้ด Badge ซึ่งเจ้าของงานกำลังปรับให้ตรงกับ schema

Migration `server/prisma/migrations/202610270001_payment_pin_and_qr/migration.sql` เพิ่มเฉพาะสองตารางและ index ของการจ่ายเงิน เปิด RLS และถอนสิทธิ์ anon/authenticated ไม่แก้ตาราง Badge หรือ login

```powershell
cd server
npm run db:payment:status
npm run db:payment:apply
npm run db:generate
npm run test:safety
npm run test:payment:integration
```

`db:payment:apply` ตรวจตาราง/index ที่มีอยู่และ QR จ่ายสำเร็จซ้ำก่อนทำงาน หากพบ schema บางส่วนหรือข้อมูลซ้ำจะหยุด ไม่ลบหรือแก้ข้อมูลเพื่อฝืนติดตั้ง ไม่ใช้ `prisma migrate dev`, reset หรือ db push กับ Supabase ที่ทีมใช้งานร่วมกัน

Integration test ใช้ `PAYMENT_TEST_DATABASE_URL` หรือ `DIRECT_URL` สร้าง schema ชื่อสุ่ม `dev2_payment_test_*` คัดลอกเฉพาะโครงสร้างตารางที่จำเป็นโดยไม่มีข้อมูลจริง ใช้ fixture ของตัวเอง แล้วลบ schema ทดสอบใน finally ครอบคลุม PIN, lockout, สิทธิ์, QR ถาวร, การจ่ายพร้อมกัน, rollback, เติมเงินพร้อมกัน และสรุปยอดตามวันไทย

ตรวจกล่อง PIN บน desktop/mobile โดยรันจาก root:

```powershell
node scripts/check-payment-pin-ui.cjs
```

ใช้ Chrome headless และ Vite ชั่วคราว ทดสอบด้วย API จำลอง รวมการยืนยัน PIN ไม่ตรงกัน, บันทึกล้มเหลวแล้วลองใหม่, ปิดกล่องหลังบันทึก และสลับบัญชี ไม่ส่ง PIN ไปฐานข้อมูลจริง

ข้าม build รวมตามขอบเขตที่ตกลง เพราะโค้ดจัดการ Badge เดิมยังอ้าง `badges.badge_level` และ `badges.required_count` ซึ่ง Supabase ย้ายไป `badge_tiers` แล้ว ให้เจ้าของโมดูลแก้ต่อ
