# 🔀 Git Workflow & Branching Strategy

ข้อตกลงและกติกาการใช้งาน Git ร่วมกันในทีม เพื่อป้องกันปัญหาโค้ดทับซ้อนและ Merge Conflict

---

## 1. Branch Strategy

| Branch | คำอธิบาย | กฎการใช้งาน |
| :--- | :--- | :--- |
| `main` | Production Ready Code | ห้าม Commit ตรง ต้องผ่าน PR จาก `dev` ตาม workflow ทีม |
| `dev` | Branch รวมการพัฒนาล่าสุด | ห้าม Commit ตรง ต้องผ่าน PR จาก Feature branch |
| `feature/<name>` | พัฒนาฟีเจอร์ใหม่ | แตกกิ่งมาจาก `dev` เช่น `feature/auth-login`, `feature/user-dashboard` |
| `fix/<name>` | แก้บั๊กทั่วไป | แตกกิ่งมาจาก `dev` เช่น `fix/navbar-overflow` |
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

ก่อนกดสร้าง PR เข้า `dev`:
1. [ ] ทดสอบรัน `npm run build:client` และ `npm run build:server` ผ่านเรียบร้อย
2. [ ] ไม่มีไฟล์ `.env` หลุดเข้ามาใน Commit
3. [ ] สมาชิกในทีมอย่างน้อย 1 คนรีวิวโค้ด (Peer Review)

---

## 4. Branch Protection Rules

ตั้งค่าบน GitHub สำหรับ `main` และ `dev` ตามไฟล์ [branch-protection.json](../.github/branch-protection.json):

- ต้องสร้าง Pull Request และได้รับอนุมัติอย่างน้อย 1 คนก่อน merge
- เมื่อ push โค้ดใหม่ การอนุมัติเดิมจะถูกยกเลิกและต้องรีวิวใหม่
- ต้อง resolve บทสนทนาในการรีวิวให้ครบก่อน merge
- ห้าม force push และห้ามลบ branch
- กฎมีผลกับผู้ดูแล repository ด้วย

Branch Protection เป็นการตั้งค่าบน GitHub การ push ไฟล์ JSON อย่างเดียวจะไม่เปิดใช้งานกฎ ต้องใช้บัญชีที่มีสิทธิ์ดูแล repository รัน:

```powershell
gh auth login
pwsh -File scripts/Set-BranchProtection.ps1
```

ตรวจสอบได้ที่ Repository → Settings → Branches หรือด้วย `gh api repos/AnthidaC/THAI_Please_WebApp/branches/main/protection` และเปลี่ยน `main` เป็น `dev` เพื่อตรวจอีก branch

ขณะตั้งค่ายังไม่มี GitHub Actions workflow จึงยังไม่บังคับ required status checks เพื่อไม่ให้ PR ค้างรอ check ที่ไม่มีอยู่ ให้ทดสอบ build ตาม checklist ด้านบน และเพิ่ม required checks เมื่อมี CI ที่รันผ่านแล้ว

กฎนี้ไม่ได้ตรวจว่า PR เข้า `main` ต้องมาจาก `dev` โดยอัตโนมัติ ทีมต้องตรวจ source branch ตาม workflow ก่อน merge ส่วน branch พัฒนารายบุคคลยัง push ได้ตามปกติ
