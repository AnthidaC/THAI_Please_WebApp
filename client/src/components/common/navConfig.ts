import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Wallet,
  QrCode,
  Store,
  ShieldAlert,
  TrendingUp,
  History,
  ScanLine,
  Megaphone,
  LayoutDashboard,
  Compass,
} from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';

/**
 * การตั้งค่าเมนูนำทางแยกตามบทบาทผู้ใช้ (Role-based Navigation)
 *
 * - แยกเมนูของ ประชาชน (CITIZEN), ร้านค้า (MERCHANT), และ ผู้ดูแลระบบ (ADMIN) ออกจากกันอย่างชัดเจน
 * - ห้ามนำเมนูร้านค้าหรือแอดมินมาปนกับเมนูของประชาชน
 * - กำหนด `primary: true` สำหรับปุ่มธุรกรรมหลักที่ต้องโดดเด่นชัดเจน (อยู่กึ่งกลางแถบล่างบนมือถือ)
 */
export type NavRole = 'CITIZEN' | 'MERCHANT' | 'ADMIN';

export interface NavItem {
  to: string;
  label: string; // ชื่อสั้น (มือถือ / แท็บเล็ต)
  fullLabel?: string; // ชื่อเต็ม (จอใหญ่)
  icon: LucideIcon;
  primary?: boolean; // ปุ่มสำคัญที่ต้องโดดเด่นชัดเจน (เช่น สแกนจ่าย / สร้าง QR)
  highlightDanger?: boolean; // ปุ่มเฝ้าระวังสำคัญสำหรับผู้ดูแลระบบ (เช่น ตรวจทุจริต)
  matchPrefixes?: string[]; // path prefix ที่ถือว่าเมนูนี้ active อยู่
}

export const NAV_BY_ROLE: Record<NavRole, NavItem[]> = {
  CITIZEN: [
    {
      to: APP_ROUTES.HOME,
      label: 'หน้าหลัก',
      fullLabel: 'หน้าหลัก',
      icon: Home,
      matchPrefixes: [APP_ROUTES.HOME],
    },
    {
      to: APP_ROUTES.CITIZEN_WALLET,
      label: 'กระเป๋าเงิน',
      fullLabel: 'กระเป๋าเงิน',
      icon: Wallet,
      matchPrefixes: [APP_ROUTES.CITIZEN_WALLET, APP_ROUTES.CITIZEN_SLIP],
    },
    {
      to: APP_ROUTES.CITIZEN_SCAN_COPAY,
      label: 'สแกนจ่าย',
      fullLabel: 'สแกนจ่าย Co-pay',
      icon: ScanLine,
      primary: true,
      matchPrefixes: [APP_ROUTES.CITIZEN_SCAN_COPAY],
    },
    {
      to: APP_ROUTES.CITIZEN_NEAR_ME,
      label: 'ร้านใกล้ฉัน',
      fullLabel: 'ร้านค้าใกล้ฉัน',
      icon: Compass,
      matchPrefixes: [APP_ROUTES.CITIZEN_NEAR_ME, APP_ROUTES.CITIZEN_MERCHANT_DETAIL],
    },
    {
      to: APP_ROUTES.CITIZEN_TRANSACTIONS,
      label: 'ประวัติ',
      fullLabel: 'ประวัติการใช้จ่าย',
      icon: History,
      matchPrefixes: [APP_ROUTES.CITIZEN_TRANSACTIONS],
    },
  ],
  MERCHANT: [
    {
      to: APP_ROUTES.HOME,
      label: 'หน้าหลัก',
      fullLabel: 'หน้าหลัก',
      icon: Home,
      matchPrefixes: [APP_ROUTES.HOME],
    },
    {
      to: APP_ROUTES.MERCHANT_POS_QR,
      label: 'สร้าง QR',
      fullLabel: 'สร้าง QR รับเงิน',
      icon: QrCode,
      primary: true,
      matchPrefixes: [APP_ROUTES.MERCHANT_POS_QR],
    },
    {
      to: APP_ROUTES.MERCHANT_SALES,
      label: 'ยอดขาย',
      fullLabel: 'สถิติยอดขาย',
      icon: TrendingUp,
      matchPrefixes: [APP_ROUTES.MERCHANT_SALES],
    },
  ],
  ADMIN: [
    {
      to: APP_ROUTES.HOME,
      label: 'หน้าหลัก',
      fullLabel: 'หน้าหลัก',
      icon: Home,
      matchPrefixes: [APP_ROUTES.HOME],
    },
    {
      to: APP_ROUTES.ADMIN_DASHBOARD,
      label: 'แดชบอร์ด',
      fullLabel: 'แดชบอร์ดผู้ดูแลระบบ',
      icon: LayoutDashboard,
      matchPrefixes: [APP_ROUTES.ADMIN_DASHBOARD, APP_ROUTES.DASHBOARD],
    },
    {
      to: APP_ROUTES.ADMIN_CAMPAIGNS,
      label: 'แคมเปญ',
      fullLabel: 'จัดการแคมเปญ',
      icon: Megaphone,
      matchPrefixes: [APP_ROUTES.ADMIN_CAMPAIGNS],
    },
    {
      to: APP_ROUTES.ADMIN_FRAUD_ALERTS,
      label: 'ตรวจทุจริต',
      fullLabel: 'ตรวจจับทุจริต',
      icon: ShieldAlert,
      highlightDanger: true,
      matchPrefixes: [APP_ROUTES.ADMIN_FRAUD_ALERTS],
    },
  ],
};

export const ROLE_LABEL: Record<NavRole, { label: string; icon: LucideIcon }> = {
  CITIZEN: { label: 'ประชาชน', icon: Wallet },
  MERCHANT: { label: 'ร้านค้า', icon: Store },
  ADMIN: { label: 'ผู้ดูแลระบบ', icon: ShieldAlert },
};

/**
 * ตรวจสอบว่าเมนูรายการนี้กำลัง Active อยู่หรือไม่จาก pathname ปัจจุบัน
 */
export const isNavItemActive = (item: NavItem, pathname: string): boolean => {
  if (item.to === APP_ROUTES.HOME) {
    return pathname === APP_ROUTES.HOME;
  }
  if (item.matchPrefixes && item.matchPrefixes.length > 0) {
    return item.matchPrefixes.some((prefix) =>
      prefix === APP_ROUTES.HOME
        ? pathname === APP_ROUTES.HOME
        : pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix)
    );
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
};

/**
 * ระบุบทบาทที่ใช้แสดงเมนู โดยยึดโซนของหน้าปัจจุบันเป็นหลักเพื่อไม่ให้เมนูข้ามบทบาทปนกัน
 */
export const resolveNavRole = (userRole: string | undefined, pathname: string): NavRole => {
  if (pathname.startsWith('/admin') || pathname === APP_ROUTES.DASHBOARD) return 'ADMIN';
  if (pathname.startsWith('/merchant')) return 'MERCHANT';
  if (pathname.startsWith('/citizen')) return 'CITIZEN';
  if (userRole === 'ADMIN') return 'ADMIN';
  if (userRole === 'MERCHANT') return 'MERCHANT';
  return 'CITIZEN';
};
