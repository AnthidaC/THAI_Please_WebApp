# 🔀 Git Workflow & Branching Strategy

ข้อตกลงและกติกาการใช้งาน Git ร่วมกันในทีม เพื่อป้องกันปัญหาโค้ดทับซ้อนและ Merge Conflict

---

## 1. Branch Strategy

| Branch | คำอธิบาย | กฎการใช้งาน |
| :--- | :--- | :--- |
| `main` | Production Ready Code | ห้าม Commit ตรงเด็ดขาด ต้องผ่าน PR จาก `develop` เท่านั้น |
| `develop` | Branch รวมการพัฒนาล่าสุด | ห้าม Commit ตรงเด็ดขาด ต้องผ่าน PR จาก Feature branch |
| `feature/<name>` | พัฒนาฟีเจอร์ใหม่ | แตกกิ่งมาจาก `develop` เช่น `feature/auth-login`, `feature/user-dashboard` |
| `fix/<name>` | แก้บั๊กทั่วไป | แตกกิ่งมาจาก `develop` เช่น `fix/navbar-overflow` |
| `hotfix/<name>` | แก้ปัญหาด่วนบน Production | แตกกิ่งมาจาก `main` |

---

## 2. Commit Message Conventions (Conventional Commits)

รูปแบบข้อความ Commit:
```text
<type>(<scope>): <subject>
```

### Type ที่อนุญาตให้ใช้:
- `feat`: เพิ่มฟีเจอร์ใหม่ (เช่น `feat(client): add responsive navbar`)
- `fix`: แก้บั๊ก (เช่น `fix(server): resolve jwt expiry calculation`)
- `refactor`: ปรับปรุงโค้ดโดยไม่เปลี่ยนฟังก์ชันการทำงาน
- `chore`: อัปเดตแพ็กเกจ, คอนฟิก, build script
- `docs`: แก้ไขเอกสารในโฟลเดอร์ `docs/` หรือ `README.md`

---

## 3. Pull Request (PR) Checklist

ก่อนกดสร้าง PR เข้า `develop`:
1. [ ] ทดสอบรัน `npm run build:client` และ `npm run build:server` ผ่านเรียบร้อย
2. [ ] ไม่มีไฟล์ `.env` หลุดเข้ามาใน Commit
3. [ ] สมาชิกในทีมอย่างน้อย 1 คนรีวิวโค้ด (Peer Review)
