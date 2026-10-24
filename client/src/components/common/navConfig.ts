import type { LucideIcon } from 'lucide-react';
import { Wallet, QrCode, Store, ShieldAlert, TrendingUp, History, ScanLine, Megaphone, LayoutDashboard } from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';

/**
 * การตั้งค่าเมนูนำทางแยกตามบทบาทผู้ใช้ (Role-based Navigation)
 *
 * แถบเมนู (โดยเฉพาะแถบล่างบนมือถือ) จะเปลี่ยนไปตามบทบาทของผู้ใช้งาน
 * ห้ามรวมเมนูของหลายบทบาทไว้ในแถบเดียวกัน
 *
 * หมายเหตุสำหรับตอนรวมงาน (Merge):
 * - ถ้าระบบ Auth ของทีมมี role จริง (เช่น CITIZEN / MERCHANT / ADMIN)
 *   ให้แก้เฉพาะฟังก์ชัน `resolveNavRole` ให้คืนค่าตาม role นั้น
 * - ถ้าเพื่อนเพิ่มหน้าใหม่ ให้เพิ่ม item ลงใน array ของ role นั้น ๆ ที่นี่ที่เดียว
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
    { to: APP_ROUTES.CITIZEN_WALLET, label: 'กระเป๋าเงิน', icon: Wallet },
    { to: APP_ROUTES.CITIZEN_SCAN_COPAY, label: 'สแกนจ่าย', fullLabel: 'สแกนจ่าย Co-pay', icon: ScanLine, primary: true },
    { to: APP_ROUTES.CITIZEN_TRANSACTIONS, label: 'ประวัติ', fullLabel: 'ประวัติการใช้จ่าย', icon: History },
  ],
  MERCHANT: [
    { to: APP_ROUTES.MERCHANT_POS_QR, label: 'สร้าง QR', fullLabel: 'สร้าง QR รับเงิน', icon: QrCode, primary: true },
    { to: APP_ROUTES.MERCHANT_SALES, label: 'ยอดขาย', fullLabel: 'สถิติยอดขาย', icon: TrendingUp },
  ],
  ADMIN: [
    { to: APP_ROUTES.ADMIN_DASHBOARD, label: 'แดชบอร์ด', fullLabel: 'แดชบอร์ดผู้ดูแลระบบ', icon: LayoutDashboard },
    { to: APP_ROUTES.ADMIN_CAMPAIGNS, label: 'แคมเปญ', fullLabel: 'จัดการแคมเปญและสิทธิประโยชน์', icon: Megaphone },
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
