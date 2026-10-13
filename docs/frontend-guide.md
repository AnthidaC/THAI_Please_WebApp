# 💻 Frontend Development Guide

คู่มือสำหรับทีมพัฒนาฝั่ง Frontend (`client/`)

---

## 0. กฎการออกแบบ UI (Coinbase Design System Compliance)

ทีม Frontend ทุกคนต้องยึดถือมาตรฐานจาก [coinbase.design.md](./coinbase.design.md) เป็นหลัก:
* **สีหลัก (Brand Voltage):** ใช้ `bg-brand-blue` (`#0052ff`) เป็นสี Action หลัก
* **ปุ่มกด (Pill Shape):** ปุ่ม Primary CTA และ Badges ต้องใส่คลาส `rounded-pill` หรือ `rounded-full` เสมอ
* **การ์ด (Card Layering):** การ์ดใช้ `rounded-card` (`24px`), พื้นหลังขาวหรือเทาอ่อน `bg-surface-soft`, เส้นขอบ `border border-hairline` (หลีกเลี่ยงเงาฟุ้งหนา)
* **ฟอนต์ภาษาไทย:** เรนเดอร์ด้วย Google Font **`Sarabun`** เป็นค่าเริ่มต้นอัตโนมัติ โดยเว้นระยะบรรทัดขั้นต่ำ `leading-relaxed` / `leading-normal` (ห้ามใช้ `leading-tight` กับภาษาไทย)
* **ตัวเลขการเงิน (Numeric Monospace):** ยอดเงินบาท, ตัวเลขสลิป และยอด Co-pay ให้ใส่คลาส `font-mono font-numeric` เสมอ

---

## 1. Directory Structure Conventions

| โฟลเดอร์ | วัตถุประสงค์ | กฎการตั้งชื่อ |
| :--- | :--- | :--- |
| `src/pages/` | หน้าจอหลักแต่ละหน้า | โฟลเดอร์ `kebab-case` หรือ `camelCase`, ไฟล์ `PascalCase.tsx` (เช่น `pages/auth/LoginPage.tsx`) |
| `src/components/common/` | UI Components ที่ใช้ซ้ำได้บ่อย เช่น Button, Modal, Card | `PascalCase.tsx` |
| `src/layouts/` | เปลือกนอกครอบหน้าจอ (เช่น Header, Footer, Sidebar) | `PascalCase.tsx` (เช่น `RootLayout.tsx`) |
| `src/stores/` | State เฉพาะฝั่ง Client ด้วย Zustand | `camelCaseStore.ts` (เช่น `authStore.ts`) |
| `src/hooks/` | Custom Hooks และ TanStack Query Hooks | `useCamelCase.ts` (เช่น `useAuth.ts`) |
| `src/services/` | ฟังก์ชันยิง API ผ่าน Axios | `camelCaseApi.ts` (เช่น `authApi.ts`) |
| `src/constants/` | ค่าคงที่ เช่น Route path | `camelCase.ts` (เช่น `routes.ts`) |

---

## 2. การจัดการ State: เมื่อไหร่ควรใช้อะไร?

* **TanStack (React) Query**: ใช้กับ **Server State ทั้งหมด** (ข้อมูลที่ดึงมาจาก API, Cache, Refetch, Mutation)
  - ❌ ห้ามนำข้อมูลจาก API ไปเซฟใส่ `useState` หรือ `zustand` ซ้ำซ้อนโดยไม่จำเป็น
* **Zustand**: ใช้กับ **Global Client State เท่านั้น**
  - เช่น สถานะการล็อกอิน (`token`, `currentUser`), Dark Mode, สถานะเปิด/ปิด Sidebar
* **React `useState`**: ใช้กับ **Local UI State เฉพาะ Component นั้นๆ**
  - เช่น เปิด/ปิด Dropdown, ค่าชั่วคราวใน Input Form

---

## 3. การเพิ่มหน้าใหม่ (New Page Workflow)

1. เพิ่ม Path Constant ใน `src/constants/routes.ts`
2. สร้าง Component หน้าใหม่ใน `src/pages/<module>/<NewPage>.tsx`
3. นำไปผูกใน `src/routes/index.tsx` (เลือกว่าอยู่ใน `RootLayout`, `ProtectedRoute` หรือ `PublicRoute`)
