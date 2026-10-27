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

## 4. Admin Badge workflow

The Badges tab on `/admin/campaigns` uses the shared Admin design system and TanStack Query. The Thai UI calls these achievements “เหรียญตรา”. Admins select a stored condition definition and configure named tiers, positive level numbers, increasing count thresholds, and optional HTTP(S) icon URLs. To propose a new condition, open the condition management panel; the Badge form does not accept unregistered free-text identifiers.

New Badges display Pending and Inactive. Admins can filter by activation and implementation status, edit metadata, add tiers, and remove or change tiers that have no earned state. Tiers with existing unlocks are locked in the form and rejected by the API if changed. Activation stays disabled until the condition catalog reports Ready and the backend registry contains the handler. Search, tab, and filter state is represented in the page query string for direct links.

## 5. Citizen achievements

`/citizen/achievements` (`APP_ROUTES.CITIZEN_ACHIEVEMENTS`) is reachable from the citizen navigation as "เหรียญตราของฉัน". It reads `GET /api/me/badges` through `services/badgeApi.ts` with TanStack Query; progress is never hardcoded.

- `components/badges/BadgeProgressCard.tsx` renders one Badge: icon, name, current tier, remaining amount to the next tier, an accessible `role="progressbar"` (`aria-valuetext` in the condition's unit), tier chips, and the unlock date.
- `pages/citizen/achievements/CitizenAchievementsPage.tsx` owns loading skeletons (`aria-live`), an `role="alert"` error state with retry, an empty state, and the unlocked/max-tier counters.
- Money conditions are formatted with `toLocaleString('th-TH')`; counts are formatted separately. `progress: null` (unregistered or failing handler) shows an "unavailable" note rather than a misleading bar.
- The payment slip review modal now posts to `POST /api/reviews`; it shows a pending label while saving and an `role="alert"` message on failure. It no longer marks a review as submitted without a server write.

Do not add a separate progress store or cache on the client: the query cache already holds the latest server state, and Badge writes happen server-side.

## 6. Campaign period configuration and wallet display

The existing Admin campaign editor owns period configuration. It keeps periods in local form state, submits them with the existing campaign create/update request, shows the period quota sum, campaign total, and their difference, and disables submit unless a non-empty period configuration sums exactly to the campaign total. This applies to manually added and generated monthly periods. Only upcoming unused periods are editable. Administrators set the number of months and quota and can edit generated rows.

`datetime-local` period values are interpreted in `Asia/Bangkok`; conversion to API timestamps always includes the `+07:00` offset. Do not use the browser machine's local zone for period eligibility. The end time is exclusive, so labels must say so.

Citizen Wallet reads `periodQuota` from the existing wallet API. Show the current period's limit, used amount, and remaining amount only when an allocation is active. In gaps and after expiry, show a clear status and never display an expired period remainder as spendable. Keep daily remaining, current-period remaining, and campaign-wide remaining visibly distinct. Legacy campaigns without periods keep the prior wallet presentation.
