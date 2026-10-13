# 📚 Project Documentation (`docs/`)

ยินดีต้อนรับสู่ศูนย์รวมเอกสารและข้อตกลงในการพัฒนาระบบ **THAI Please WebApp**  
เอกสารในโฟลเดอร์นี้จัดทำขึ้นเพื่อให้ทุกคนในทีมทำงานไปในทิศทางเดียวกัน มีมาตรฐานเดียวกัน และลดปัญหาข้อขัดแย้งในการพัฒนา

---

## 📑 สารบัญเอกสาร (Documentation Index)

| เอกสาร | รายละเอียด |
| :--- | :--- |
| [architecture.md](./architecture.md) | **ภาพรวมสถาปัตยกรรมระบบ** (Tech Stack, Data Flow, Security) |
| [ux-ui-design-system.md](./ux-ui-design-system.md) | **กฎการออกแบบ UX/UI & Layout** (Coinbase Style + Sarabun Font + Thai Please Layouts) |
| [api-spec.md](./api-spec.md) | **ข้อกำหนดมาตรฐาน API (API Specification)** รูปแบบ JSON, Error Code, Headers |
| [frontend-guide.md](./frontend-guide.md) | **คู่มือและมาตรฐานสำหรับทีม Frontend** (Routing, Zustand, TanStack Query, Tailwind) |
| [backend-guide.md](./backend-guide.md) | **คู่มือและมาตรฐานสำหรับทีม Backend** (Express, Prisma, Zod, Redis Caching) |
| [database-schema.md](./database-schema.md) | **การออกแบบฐานข้อมูล (Database Design)** และแนวทางการรัน Migration |
| [git-workflow.md](./git-workflow.md) | **ข้อตกลงการใช้งาน Git** (Branching Strategy, Commit Message, PR Rules) |

---

## 💡 กฎเหล็กประจำทีม (Core Team Rules)

1. **ห้าม Commit `.env` ขึ้น Git เด็ดขาด** ให้ใส่ค่าตัวอย่างไว้ใน `.env.example` เท่านั้น
2. **ไม่ Hardcode Route หรือ API Path** ให้ใช้ constants กลางเสมอ
3. **Frontend ห้ามเรียก Database ตรง** ต้องผ่าน Express API เท่านั้น
4. **Backend ทุก Route ต้องมี Zod Validation** สำหรับ Request Body/Query/Params
5. **ก่อน Pull Request ต้องทดสอบ Build ผ่านทั้ง Client และ Server**:
   ```bash
   npm run build:client
   npm run build:server
   ```
