# 📡 API Specification & Standards

## 1. Base URL & Versioning
- **Base URL:** `/api`
- **Content-Type:** `application/json`

---

## 2. Standard Response Format

ทุก Endpoint ต้องคืนค่าข้อมูลในรูปแบบ JSON มาตรฐานนี้เท่านั้น (ดูได้ที่ `server/src/utils/response.ts`):

### ✅ Success Response (2xx)
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "user@example.com"
    }
  },
  "message": "Operation completed successfully"
}
```

### ❌ Error Response (4xx, 5xx)
```json
{
  "status": "error",
  "message": "Invalid credentials",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email address format"
    }
  ]
}
```

---

## 3. Authentication & Header Convention

- สำหรับ Private Route ต้องแนบ Header:
  ```http
  Authorization: Bearer <JWT_ACCESS_TOKEN>
  ```
- Axios ใน Frontend ได้ทำ Interceptor แนบ Header นี้ให้อัตโนมัติเมื่อมี Token ใน LocalStorage

---

## 4. Initial Endpoints (Authentication Module)

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/health` | ❌ No | Health check server status |
| `POST` | `/api/auth/register` | ❌ No | ลงทะเบียนผู้ใช้ใหม่ |
| `POST` | `/api/auth/login` | ❌ No | เข้าสู่ระบบ และรับ JWT Token |
| `GET` | `/api/auth/me` | ✅ Yes | ดึงข้อมูลผู้ใช้ปัจจุบัน (ใช้ Redis Cache) |

---

## 5. Developer 2: Fintech Core Endpoints (Wallet, Payment & Fraud)

### 5.1 ระบบกระเป๋าเงินดิจิทัล (Wallet)
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/wallet/balance` | ✅ Yes | ตรวจสอบยอดเงินคงเหลือ และโควตาสิทธิรัฐสมทบ (รายวัน 150 บาท / รวม 3,000 บาท) |
| `POST` | `/api/wallet/top-up` | ✅ Yes | เติมเงินเข้ากระเป๋าเงินดิจิทัลส่วนตัวของประชาชน |

### 5.2 ระบบชำระเงินและคิวอาร์โค้ด (Payment & QR Engine)
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/payment/qr/generate` | ✅ Yes | ร้านค้าสร้าง Dynamic QR Code ระบุยอดเงินและพิกัด GPS ร้านค้า |
| `GET` | `/api/payment/qr/:reference` | ✅ Yes | ดึงข้อมูล QR Code เพื่อพรีวิวยอดชำระเงินร่วม Co-pay 60/40 ก่อนสแกนจ่าย |
| `POST` | `/api/payment/qr/checkout` | ✅ Yes | ประชาชนยืนยันชำระเงินร่วม ตรวจสอบพิกัด GPS และส่งวิเคราะห์ Semi-AI Fraud Check |

### 5.3 ประวัติและสถิติธุรกรรม (Transactions)
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/transactions/buyer/history` | ✅ Yes | ดึงประวัติการใช้จ่ายของประชาชน พร้อมสิทธิประเมินรีวิว 24 ชม. |
| `GET` | `/api/transactions/merchant/history` | ✅ Yes | ดึงประวัติการรับเงิน สรุปยอดขาย และยอดเงินอุดหนุนรัฐของร้านค้า |
| `GET` | `/api/transactions/:id/slip` | ✅ Yes | ดึงข้อมูลหลักฐานการชำระเงิน (e-Slip) สำหรับออกใบเสร็จ |

### 5.4 ระบบตรวจจับทุจริตพิกัด GPS & Semi-AI (Fraud Detection)
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/fraud/alerts` | ✅ Yes (Admin) | ดึงรายการธุรกรรมที่ถูกระงับหรือเตือนพิกัดผิดปกติ (Flagged Transactions) |
| `POST` | `/api/fraud/resolve/:id` | ✅ Yes (Admin) | ผู้ดูแลระบบตรวจสอบและบันทึกผล (อนุมัติ / ปฏิเสธการชำระเงิน) |

