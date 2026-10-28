# 🎨 UX/UI Design System & Layout Guidelines: THAI Please WebApp

เอกสารนี้ผสมผสานกฎการออกแบบระดับสากลจาก **[Coinbase Design System](./coinbase.design.md)** เข้ากับข้อกำหนดโครงสร้างระบบ **[THAI Please Web Application System.txt](./THAI%20Please%20Web%20Application%20System.txt)** โดยปรับให้เข้ากับภาษาไทย (Google Font: Sarabun) และพฤติกรรมผู้ใช้งานโครงการภาครัฐ

---

## 🏛️ 1. ปรัชญาการออกแบบ (Design Philosophy)

> **"Institutional Calm & High Trust" (ความสุขุม โปร่งใส และน่าเชื่อถือระดับสถาบันการเงินภาครัฐ)**

1. **White Canvas & Single Accent Voltage:**
   - พื้นหลังหลักใช้สีขาวสว่าง (`#ffffff`) สลับกับพื้นหลังยกระดับสีเทาอ่อน (`#f7f7f7`)
   - ใช้สีน้ำเงินหลัก (`#0052ff` - Brand Blue) เพียงสีเดียวสำหรับปุ่ม Action สำคัญ (Primary CTA) และ Link
2. **Pill Geometry (รูปทรงขอบมน 100px):**
   - ปุ่มกด (Buttons) และ Badges ทุกตัวใช้ความโค้งมนระดับมนสุด (`rounded-full` หรือ `rounded-pill`)
   - การ์ดเนื้อหา (Cards) มีมุมโค้งมนขนาดใหญ่ `24px` (`rounded-2xl` หรือ `rounded-card`)
3. **Card-on-Card Layering (ไม่ใช้เงาฟุ้งลอย):**
   - สร้างมิติความลึกด้วยเส้นขอบบางประณีต (`border border-hairline` / `#dee1e6`) แทนการใส่ Drop Shadow ดำหนา
4. **Semantic Colors สำหรับการเงิน:**
   - สีเขียว (`#05b169`): ใช้เฉพาะยอดเงินเข้า / สำเร็จ / บันทึกแล้ว
   - สีแดง (`#cf202f`): ใช้เฉพาะยอดเงินออก / หักเงิน / ยกเลิก
   - **ห้าม** นำสีเขียวหรือแดงมาทำเป็นพื้นหลังปุ่มกดหลัก

---

## 🇹🇭 2. กฎการจัดตัวอักษรภาษาไทย (Thai Typography with Google Font: Sarabun)

### ทำไมถึงเลือก "Sarabun" (สารบัญ)?
- **เป็นทางการและเข้าถึงได้ทุกวัย:** โครงการ THAI Please เป็นบริการสำหรับประชาชนทั่วประเทศ Sarabun มี "หัวอักษร" ชัดเจน ทำให้อ่านง่ายทั้งบนหน้าจอมือถือขนาดเล็กและสำหรับผู้สูงอายุ
- **สะท้อนความเป็นทางการของรัฐ:** สื่อถึงความโปร่งใสและถูกต้องตามมาตรฐานเอกสารภาครัฐ

### ⚠️ กฎเหล็กในการเรนเดอร์ภาษาไทย:
1. **ป้องกันสระลอย / วรรณยุกต์ตกขอบ (Thai Line-Height Rule):**
   - **ห้ามใช้** `leading-none` หรือ `leading-tight` กับข้อความภาษาไทย เพราะจะทำให้ไม้เอก ไม้โท สระอิ สระอี หรือสระอุ สระอู ถูกตัดขาด
   - ให้ใช้ `line-height` ขั้นต่ำ `1.5` ถึง `1.6` (`leading-normal` หรือ `leading-relaxed`)
2. **ตัวเลขทางการเงินและธุรกรรม (Numeric Monospace Rule):**
   - เมื่อแสดง **ยอดเงินในกระเป๋า, สัดส่วน Co-pay (ชำระร่วม), รหัสคิวอาร์โค้ด, และสลิปโอนเงิน** ให้ใช้ฟอนต์ตัวเลขแบบ Monospace เสมอ:
     ```html
     <!-- ตัวอย่างการแสดงผลยอดเงิน -->
     <span class="font-mono font-numeric text-2xl font-semibold">฿ 1,500.00</span>
     ```
   - เพื่อให้ตัวเลขแต่ละหลักมีความกว้างเท่ากัน (Tabular Numbers) ช่วยให้อ่านยอดเงินตรงหลัก ไม่ตาลาย

### ลำดับขนาดตัวอักษร (Type Scale):
| Token | ขนาด | Weight | การใช้งาน |
| :--- | :---: | :---: | :--- |
| `display` | 32px - 40px | 600 (SemiBold) | หัวข้อ Hero หรือยอดเงินกระเป๋าหลัก |
| `heading-lg` | 24px | 600 (SemiBold) | หัวข้อหน้าเพจหลัก |
| `heading-md` | 18px - 20px | 500 (Medium) | หัวข้อการ์ด / รายการร้านค้า |
| `body` | 15px - 16px | 400 (Regular) | เนื้อหาทั่วไป คำอธิบาย |
| `caption` | 13px - 14px | 400 (Regular) | ข้อมูลรอง, วันที่, หมายเหตุ |
| `numbers` | 14px - 36px | 500 (Mono) | ตัวเลขเงินบาท, เปอร์เซ็นต์, ยอด Co-pay |

---

## 📱 3. โครงสร้าง Layout หน้าเว็บ (ตามเอกสารระบบ THAI Please)

ระบบถูกแบ่งออกเป็น **4 Layout Shells** ตามบทบาทผู้ใช้งาน:

```
THAI Please Layouts
├── 1. Gateway Layout (หน้าเข้าสู่ระบบ - Desktop/Mobile Responsive)
├── 2. Citizen Layout (ฝั่งประชาชน - Mobile-First App Shell)
├── 3. Merchant Layout (ฝั่งร้านค้า - POS & Tablet/Desktop Optimized)
└── 4. Admin/Gov Layout (ฝั่งผู้ดูแลระบบ/ผู้บริหาร - Desktop Wide Dashboard)
```

---

### Layout 1: Gateway Layout (ประตูเข้าสู่ระบบ)
- **สไตล์:** Clean Split Screen หรือ Centered Card สไตล์ Coinbase Onboarding
- **เส้นทาง:**
  - `1.1` ในสภาพแวดล้อมพัฒนา เลือกเข้าสู่ระบบด้วยบัญชีจำลองประชาชน ร้านค้า หรือผู้ดูแลที่กำหนดไว้ [Dev 1]
  - `1.2` การยืนยันตัวตนด้วยบัญชีจริงยังไม่อยู่ในขอบเขตของระบบนี้ [Dev 1]
- **กฎ UX:** ช่องกรอกข้อมูลขนาดใหญ่ ป้ายกำกับชัดเจน ปุ่มล็อกอินรูปทรง Pill เด่นชัด

---

### Layout 2: Citizen Layout (เส้นทางประชาชน - Mobile-First)
> *พฤติกรรมหลักของประชาชนคือ "เดินไปสแกนจ่ายหน้าร้านผ่านสมาร์ตโฟน"*
- **ลักษณะ Layout:**
  - กำหนด Container กว้างสูงสุด `max-w-md mx-auto` (เลียนแบบหน้าจอมือถือบนเดสก์ท็อป)
  - มี **Sticky Bottom Navigation Bar** ที่ด้านล่างเสมอ (หน้าหลัก, สแกน QR, ค้นหาร้านค้า, ภารกิจ, โปรไฟล์)
- **การจัดวางส่วนประกอบ:**
  - **2.2 กระเป๋าเงิน (Wallet Dashboard) [Dev 2]:**
    - การ์ดยอดเงินสไตล์ Coinbase (แสดงยอดเงินคงเหลือ + สิทธิ์ Co-pay ภาครัฐชัดเจน)
    - ปุ่มลอยเด่นตรงกลาง: **"สแกนชำระเงิน (Co-pay)"**
    - หน้าสลิป (2.2.2) แสดงผลเสมือน e-Slip ใบเสร็จขอบหยักมน บันทึกลงเครื่องได้
  - **2.3 ค้นหาร้านค้า (AI Near-Me) [Dev 3]:**
    - Search Bar รูปทรง Pill ด้านบน
    - แผนที่ระบุพิกัด และ Card ร้านค้าใกล้เคียง
  - **2.4 Gamification & Rewards [Dev 4]:**
    - แท็บภารกิจ (Quests) แสดงแถบความคืบหน้า (Progress bar)
    - หน้ารวมคูปองส่วนลด และรหัส Referral แนะนำเพื่อน
  - **2.5 Profile & Transaction History [Dev 2, 3]:**
    - รายการประวัติธุรกรรมแสดงแบ่งตามวันที่ พร้อมแท็กสีเขียว/แดงกำกับยอดเงิน

---

### Layout 3: Merchant Layout (เส้นทางร้านค้า)
> *พฤติกรรมร้านค้าคือ "วางหน้าจอไว้หน้าร้านเพื่อรับเงิน หรือตรวจสถิติการขาย"*
- **ลักษณะ Layout:**
  - รองรับหน้าจอ Tablet (POS Counter) และ Mobile
  - มีปุ่มสลับโหมดด่วน: **"โหมดสร้าง QR รับเงิน"** (แสดงตัวใหญ่เต็มจอให้ลูกค้าสแกน)
- **การจัดวางส่วนประกอบ:**
  - **3.2 Dynamic QR Payment [Dev 2]:** แสดงยอดเงินตัวเลขใหญ่และ QR Code ตรงกลางจอ
  - **3.3 Sales & Info [Dev 1, 2, 3]:** ตารางสรุปยอดรับเงินประจำวัน, คะแนนรีวิว 5 ดาว, และจัดการพิกัดร้านค้า

---

### Layout 4: Admin & Government Executive Layout (ผู้ดูแลระบบและภาครัฐ)
> *พฤติกรรมคือ "นั่งทำงานบนคอมพิวเตอร์ ตรวจสอบเอกสาร และดูสถิติภาพรวมประเทศ"*
- **ลักษณะ Layout:**
  - Desktop-First (`w-full` หน้าจอกว้าง)
  - มี **Collapsible Sidebar** ด้านซ้าย และ Top App Bar
- **การจัดวางส่วนประกอบ:**
  - **4.1 - 4.3 ระบบจัดการและตรวจทุจริต [Dev 1, 2, 4]:**
    - Table แสดงรายชื่อร้านค้ารออนุมัติ + ปุ่มตรวจเอกสารแนบ
    - หน้า Fraud Alert แจ้งเตือนความผิดปกติของพิกัด GPS อัตโนมัติ
  - **4.4 แดชบอร์ดผลกระทบทางสังคม (Social Impact Dashboard) [Dev 1]:**
    - ตัวเลข KPI การกระจายเม็ดเงินรวมระดับประเทศ
    - **Heatmap Map View** แสดงจุดความหนาแน่นของการใช้จ่ายเงินกระจายตัวตามภูมิภาค

---

## 👥 4. ตารางความรับผิดชอบของทีมพัฒนา (Mapped to Layout)

| นักพัฒนา | หน้าที่หลักและ Layout ที่ต้องดูแล | ไฟล์หน้าเพจที่แนะนำ |
| :--- | :--- | :--- |
| **Dev 1** | **Gateway & Admin/Gov Dashboard:** <br>• 1.1 - 1.2 Login (development mock accounts) <br>• 2.1 ตรวจสอบสิทธิ์ <br>• 3.1 & 3.3.3 ทะเบียนร้านค้า <br>• 4.1 & 4.4 Social Impact Dashboard (Heatmap) | `pages/gateway/*`<br>`pages/admin/verification/*`<br>`pages/admin/impact-dashboard/*` |
| **Dev 2** | **Fintech Core (Wallet, Payment & Security):** <br>• 2.2 Wallet & Co-pay Scanner / Slip <br>• 2.5.1 ประวัติธุรกรรม <br>• 3.2 Dynamic QR รับเงิน <br>• 3.3.1 สถิติการขายร้านค้า <br>• 4.2 ระบบตรวจทุจริต GPS | `pages/citizen/wallet/*`<br>`pages/citizen/scan-copay/*`<br>`pages/merchant/pos-qr/*`<br>`pages/admin/fraud-alerts/*` |
| **Dev 3** | **Location & Community (AI Near-Me & Reviews):** <br>• 2.3 AI ค้นหาร้านค้าใกล้เคียง & แผนที่ <br>• 2.4.3 Referral แนะนำเพื่อน <br>• 2.5.2 รีวิวร้านค้า 24 ชม. <br>• 3.3.2 สรุปคะแนนร้านค้า | `pages/citizen/near-me/*`<br>`pages/citizen/reviews/*`<br>`pages/merchant/reviews/*` |
| **Dev 4** | **Gamification & Engagement:** <br>• 2.4.1 กระดานภารกิจ (Quests) & Badges <br>• 2.4.2 หน้ารวมคูปองส่วนลด <br>• 4.3 หลังบ้านจัดการแคมเปญ & ของรางวัล | `pages/citizen/quests/*`<br>`pages/citizen/coupons/*`<br>`pages/admin/campaigns/*` |
