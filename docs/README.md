# 📚 Project Documentation (`docs/`)

ยินดีต้อนรับสู่ศูนย์รวมเอกสารและข้อตกลงในการพัฒนาระบบ **THAI Please WebApp**  
เอกสารในโฟลเดอร์นี้จัดทำขึ้นเพื่อให้ทุกคนในทีมทำงานไปในทิศทางเดียวกัน มีมาตรฐานเดียวกัน และลดปัญหาข้อขัดแย้งในการพัฒนา

---

## 📑 สารบัญเอกสาร (Documentation Index)

| เอกสาร | รายละเอียด |
| :--- | :--- |
| [coinbase.design.md](./coinbase.design.md) | **🎯 มาตรฐาน UX/UI กลาง (Core Design System Spec)** ยึดถือกฎนี้เป็นหลักเสมอ |
| [ux-ui-design-system.md](./ux-ui-design-system.md) | **คู่มือการนำ Coinbase Design มาปรับใช้กับภาษาไทย & ผัง Layout 4 แบบ** |
| [architecture.md](./architecture.md) | **ภาพรวมสถาปัตยกรรมระบบ** (Tech Stack, Data Flow, Security) |
| [api-spec.md](./api-spec.md) | **ข้อกำหนดมาตรฐาน API (API Specification)** รูปแบบ JSON, Error Code, Headers |
| [frontend-guide.md](./frontend-guide.md) | **คู่มือและมาตรฐานสำหรับทีม Frontend** (Routing, Zustand, TanStack Query, Tailwind) |
| [backend-guide.md](./backend-guide.md) | **คู่มือและมาตรฐานสำหรับทีม Backend** (Express, Prisma, Zod, Redis Caching) |
| [database-schema.md](./database-schema.md) | **การออกแบบฐานข้อมูล (Database Design)** การตั้งค่า Supabase และ Prisma Migration |
| [badge-award-engine.md](./badge-award-engine.md) | **ระบบมอบตราความสำเร็จ** Handlers, Award Engine, Event Hooks, Progress API, Reconciliation |
| [git-workflow.md](./git-workflow.md) | **ข้อตกลงการใช้งาน Git** (Branching Strategy, Commit Message, PR Rules) |

---

## 🎯 กฎเหล็กประจำทีม (Core Team Rules)

1. **UX/UI ต้อง Follow กฎของ [coinbase.design.md](./coinbase.design.md) เสมอ:**
   - **Single Accent Voltage:** ใช้สีหลักคือ **Coinbase Blue (`#0052ff`)** สำหรับ Primary CTA และลิงก์สำคัญ
   - **Geometry:** ปุ่มกดทุกปุ่มใช้รูปทรงแคปซูลมนสุด (`rounded-pill` / `rounded-full` 100px) และการ์ดใช้มุมมน `24px` (`rounded-card`)
   - **Canvas & Surface:** พื้นหลังขาวบริสุทธิ์ (`#ffffff`) สลับเทายกระดับ (`#f7f7f7`) ไม่ใช้เงาดำฟุ้งหนา ใช้เส้นขอบบางประณีต (`border-hairline` / `#dee1e6`)
2. **ข้อยกเว้นเรื่องฟอนต์ (Typography Exception):**
   - **ภาษาไทย:** ต้องใช้ **Google Font: Sarabun (GG สารบัญ)** เท่านั้น เพื่อความเป็นทางการและอ่านง่าย
   - **ตัวเลขทางการเงิน:** ยอดเงิน, สลิป, QR Co-pay ให้ใช้ **`JetBrains Mono`** (`font-mono font-numeric`) ตามกฎ Monospace ของ Coinbase
   - **Thai Line-Height:** ห้ามใช้ `leading-none` หรือ `leading-tight` กับภาษาไทย เพื่อป้องกันสระและวรรณยุกต์ตกขอบ (ให้ใช้ `1.5` ถึง `1.6`)
3. **ห้าม Commit `.env` ขึ้น Git เด็ดขาด:** ใส่ตัวอย่างใน `.env.example` เท่านั้น
4. **ไม่ Hardcode Route หรือ API Path:** ให้เรียกใช้ผ่าน `APP_ROUTES` เสมอ
5. **Frontend ห้ามเรียก Database ตรง:** ต้องผ่าน Express API (`/api/*`) เท่านั้น
6. **Backend ทุก Route ต้องมี Zod Validation:** สำหรับตรวจสอบ Request Body/Query/Params
7. **ก่อนส่ง Pull Request ต้องทดสอบ Build ผ่านทั้ง Client และ Server:**
   ```bash
   npm run build:client
   npm run build:server
   ```
