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
