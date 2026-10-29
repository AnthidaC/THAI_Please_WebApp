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

## 6. Developer 4: Badge Management, Award Engine & Citizen Progress

### 6.1 Admin Badge management

All routes require an Admin token. Badges use a unique `conditionType` and any number of tiers with positive, increasing thresholds.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/badges` | List Badges; filters `status=active\|inactive`, `implementation_status=pending\|in_progress\|ready` |
| `GET` | `/api/badges/:id` | Read one Badge and its tiers |
| `POST` | `/api/badges` | Create one Badge and its tiers atomically |
| `PATCH` | `/api/badges/:id` | Edit metadata and unearned tiers |
| `PATCH` | `/api/badges/:id/implementation-status` | Set `pending`, `in_progress`, or `ready` |
| `POST` | `/api/badges/:id/activate` | Activate; requires Ready, a registered handler, and valid tiers |
| `POST` | `/api/badges/:id/deactivate` | Deactivate |
| `GET` | `/api/badge-condition-types` | List condition types registered in the backend |

### 6.1.1 Admin condition type catalog

All routes require an Admin token. Catalog records contain display metadata and workflow status only; executable handler availability is computed from the backend registry.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/condition-types` | List definitions; optional `implementation_status=pending\|in_progress\|ready` and `handler_registered=true\|false` filters |
| `GET` | `/api/condition-types/:id` | Read a definition, handler availability, and linked Badge series |
| `POST` | `/api/condition-types` | Create a unique `conditionKey` and Thai display metadata; status defaults to `pending` |
| `PATCH` | `/api/condition-types/:id` | Update display name, description, unit, or workflow status; key cannot change |

Creation accepts `conditionKey`, `displayName`, optional `description`, and `measurementUnit`. It does not accept executable code or an implementation-status override. A condition can be marked Ready only after its handler is registered.

```json
{
  "badgeName": "นักช้อปชุมชน",
  "description": "สะสมการชำระเงินที่สำเร็จ",
  "conditionType": "transaction_count",
  "tiers": [
    { "tierName": "Bronze", "tierLevel": 1, "requiredCount": 10 },
    { "tierName": "Silver", "tierLevel": 2, "requiredCount": 50 },
    { "tierName": "Gold", "tierLevel": 3, "requiredCount": 100 }
  ]
}
```

Creation cannot override `status` (defaults to `inactive`) or `implementation_status` (defaults to `pending`). Thresholds must be positive, unique, and strictly increase with `tierLevel`. A tier with existing unlocks cannot be renamed, moved, re-thresholded, or removed. See `badge-award-engine.md`.

### 6.2 Citizen progress

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/me/badges` | ✅ Yes | Active Badges with authoritative progress, current tier, next tier, and unlock timestamps |
| `GET` | `/api/me/badges/:badgeId` | ✅ Yes | One active Badge; `404` when it is inactive or absent |

The user identity comes from the authenticated token; the API accepts no user ID parameter. `progress` is `null` when the condition has no registered handler or its handler fails. Values are counts, except `total_spending`, which is citizen out-of-pocket baht (`citizen_paid_amount`).

```json
{
  "status": "success",
  "data": [
    {
      "id": "…",
      "name": "Referral Master",
      "conditionType": "referral_count",
      "progress": 25,
      "currentTier": { "name": "Silver", "level": 2, "requiredCount": 20, "unlocked": true, "earnedAt": "2026-10-01T…" },
      "nextTier": { "name": "Gold", "level": 3, "requiredCount": 50, "unlocked": false, "earnedAt": null },
      "isMaxTier": false,
      "isUnlocked": true,
      "tiers": []
    }
  ],
  "message": "Badges loaded"
}
```

### 6.3 Review creation

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/reviews` | ✅ Yes | Review the caller's own settled transaction within 24 hours |

```json
{ "transactionId": "uuid", "ratingStars": 5, "reviewText": "optional" }
```

Only `SUCCESS` and `FLAGGED` transactions are reviewable, one review per transaction (enforced by a unique key), and only the owner may review. After the review is committed, `review_count` Badges are evaluated; an evaluation failure never fails the review.

## 7. Campaign period quotas

Campaign period configuration uses the existing Admin campaign endpoints; no separate campaign API is introduced.

### 7.1 Create a campaign with periods

`POST /api/campaigns` accepts optional `periods`. Omitting it or sending an empty array keeps legacy campaign quota behavior.

```json
{
  "campaignName": "Thai Please 60/40",
  "governmentCopayRatePercent": 60,
  "citizenPaymentRatePercent": 40,
  "dailyQuotaLimit": 200,
  "totalQuotaLimit": 4000,
  "startDate": "2026-11-01T00:00:00+07:00",
  "endDate": "2027-03-01T00:00:00+07:00",
  "status": "ACTIVE",
  "periods": [
    {
      "periodName": "Month 1",
      "periodQuotaLimit": 1000,
      "startDate": "2026-11-01T00:00:00+07:00",
      "endDate": "2026-12-01T00:00:00+07:00"
    }
  ]
}
```

The initial campaign and periods are written atomically. Period limits refer to government contribution. For a non-empty period configuration, their exact sum must equal `totalQuotaLimit`; the Admin UI and API compare integer cents. A campaign without periods retains legacy behavior.

### 7.2 Update campaign periods

`PATCH /api/campaigns/:id` accepts an optional `periods` array. If present, it is the desired full period list. Include `periodId` for an existing period; omit it for a new period. Existing future unused periods can be edited or removed. Started or used periods must be retained unchanged. `periods: []` removes only future unused periods. If `periods` is omitted, the period list is unchanged.

Period intervals are `[startDate, endDate)`: start is inclusive and end is exclusive. Adjacent periods may share an exact boundary; overlapping intervals, periods outside campaign dates, negative amounts, duplicate IDs, and period totals unequal to the campaign total return a validation error. The Admin UI interprets date/time fields in `Asia/Bangkok` and sends explicit `+07:00` timestamps.

The database exact-equality migration is currently pending because one existing development campaign has a 3,000.00 total and periods totaling 2,000.00. Do not apply the migration until an administrator explicitly reconciles that configuration.

Campaign list items include `periods`, each with `id`, `name`, `quotaLimit`, `usedAmount`, `startDate`, `endDate`, `status` (`UPCOMING`, `ACTIVE`, `ENDED`), `allocationCount`, and `isEditable`.

### 7.3 Wallet period availability

The existing wallet response includes `periodQuota`:

```json
{
  "periodQuota": {
    "enabled": true,
    "status": "ACTIVE",
    "currentPeriod": {
      "id": "uuid",
      "name": "Month 1",
      "startDate": "2026-11-01T00:00:00+07:00",
      "endDate": "2026-12-01T00:00:00+07:00",
      "quotaLimit": 1000,
      "quotaUsed": 350,
      "quotaRemaining": 650
    },
    "nextPeriod": null
  }
}
```

Statuses also include `BEFORE_FIRST`, `BETWEEN_PERIODS`, `AFTER_LAST`, `ALLOCATION_MISSING`, and `INVALID_OVERLAP`. Inactive gaps and expired periods do not spend or carry quota. At checkout, government contribution remains capped by the existing copay amount, daily remaining, campaign remaining, and active-period remaining, all in the same database transaction as the payment writes.
