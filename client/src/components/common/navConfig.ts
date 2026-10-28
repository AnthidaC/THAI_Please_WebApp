import type { LucideIcon } from 'lucide-react';
import { Home, Wallet, ScanLine, Store, User, QrCode, ShieldAlert, TrendingUp } from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';

/**
 * การตั้งค่าเมนูนำทางแยกตามบทบาทผู้ใช้ (Role-based Navigation)
 *
 * แถบเมนู (โดยเฉพาะแถบล่างบนมือถือ) จะเปลี่ยนไปตามบทบาทของผู้ใช้งาน
 * ห้ามรวมเมนูของหลายบทบาทไว้ในแถบเดียวกัน
 *
 * สำหรับบทบาทประชาชน (CITIZEN) ลำดับเมนูประกอบด้วย 5 ลำดับ:
 * 1. หน้าหลัก (Home)
 * 2. กระเป๋าเงิน (Wallet)
 * 3. สแกนจ่าย (Scan Pay) - ปุ่มหลักตรงกลาง
 * 4. แนะนำร้าน (Recommended Stores)
 * 5. โปรไฟล์ส่วนตัว (Profile) - มีทางไปหน้าเกมและหน้าตั้งค่าอยู่ภายใน
 */
export type NavRole = 'CITIZEN' | 'MERCHANT' | 'ADMIN';

export interface NavItem {
  to: string;
  label: string; // ชื่อสั้น (มือถือ / แท็บเล็ต)
  fullLabel?: string; // ชื่อเต็ม (จอใหญ่)
  icon: LucideIcon;
  primary?: boolean; // ปุ่มเด่นตรงกลางแถบล่าง (ธุรกรรมที่ใช้บ่อยที่สุด)
}

export const NAV_BY_ROLE: Record<NavRole, NavItem[]> = {
  CITIZEN: [
    { to: APP_ROUTES.HOME, label: 'หน้าแรก', fullLabel: 'หน้าหลัก', icon: Home },
    { to: APP_ROUTES.CITIZEN_WALLET, label: 'กระเป๋าเงิน', fullLabel: 'กระเป๋าเงิน', icon: Wallet },
    { to: APP_ROUTES.CITIZEN_SCAN_COPAY, label: 'สแกนจ่าย', fullLabel: 'สแกนจ่าย Co-pay', icon: ScanLine, primary: true },
    { to: APP_ROUTES.CITIZEN_NEAR_ME, label: 'แนะนำร้าน', fullLabel: 'แนะนำร้านค้า', icon: Store },
    { to: APP_ROUTES.PROFILE, label: 'โปรไฟล์', fullLabel: 'โปรไฟล์ส่วนตัว', icon: User },
  ],
  MERCHANT: [
    { to: APP_ROUTES.MERCHANT_POS_QR, label: 'สร้าง QR', fullLabel: 'สร้าง QR รับเงิน', icon: QrCode, primary: true },
    { to: APP_ROUTES.MERCHANT_SALES, label: 'ยอดขาย', fullLabel: 'สถิติยอดขาย', icon: TrendingUp },
  ],
  ADMIN: [
    { to: APP_ROUTES.ADMIN_FRAUD_ALERTS, label: 'ตรวจทุจริต', fullLabel: 'ตรวจจับทุจริต', icon: ShieldAlert },
  ],
};

export const ROLE_LABEL: Record<NavRole, { label: string; icon: LucideIcon }> = {
  CITIZEN: { label: 'ประชาชน', icon: Wallet },
  MERCHANT: { label: 'ร้านค้า', icon: Store },
  ADMIN: { label: 'ผู้ดูแลระบบ', icon: ShieldAlert },
};

/**
 * ระบุบทบาทที่ใช้แสดงเมนู
 * ปัจจุบัน User type มีแค่ 'USER' | 'ADMIN' จึงอนุมานบทบาทร้านค้า/ประชาชนจากโซนของหน้า (path)
 */
export const resolveNavRole = (userRole: string | undefined, pathname: string): NavRole => {
  if (userRole === 'ADMIN' || pathname.startsWith('/admin')) return 'ADMIN';
  if (userRole === 'MERCHANT' || pathname.startsWith('/merchant')) return 'MERCHANT';
  return 'CITIZEN';
};
