import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Wallet,
  ScanLine,
  Store,
  User,
  QrCode,
  ShieldAlert,
  TrendingUp,
  Star,
  Megaphone,
  LayoutDashboard,
} from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';

/**
 * การตั้งค่าเมนูนำทางแยกตามบทบาทผู้ใช้ (Role-based Navigation)
 *
 * แถบเมนูทั้งบน Desktop และ Mobile Bottom Bar จะเปลี่ยนไปตามบทบาทของผู้ใช้งาน
 * ห้ามรวมเมนูของหลายบทบาทไว้ในแถบเดียวกัน
 *
 * 1. CITIZEN (ประชาชน): 5 เมนู
 *    - หน้าแรก (Home)
 *    - กระเป๋าเงิน (Wallet)
 *    - สแกนจ่าย (Scan Pay) - ปุ่มหลักตรงกลาง
 *    - แนะนำร้าน (Recommended Stores)
 *    - โปรไฟล์ส่วนตัว (Profile)
 *
 * 2. MERCHANT (ร้านค้า): 3 เมนู
 *    - สถิติยอดขาย (Sales History)
 *    - สร้าง QR รับเงิน (POS Dynamic QR) - ปุ่มหลักตรงกลาง
 *    - รีวิวร้านค้า (Merchant Reviews)
 *
 * 3. ADMIN (ผู้ดูแลระบบ): 3 เมนู
 *    - แดชบอร์ดผู้ดูแล (Admin Dashboard)
 *    - ตรวจจับทุจริต (Fraud Alerts & Monitoring)
 *    - แคมเปญและสิทธิประโยชน์ (Campaigns & Missions)
 */
export type NavRole = 'CITIZEN' | 'MERCHANT' | 'ADMIN';

export interface NavItem {
  to: string;
  label: string; // ชื่อสั้น (มือถือ / แท็บเล็ต)
  fullLabel?: string; // ชื่อเต็ม (จอใหญ่)
  icon: LucideIcon;
  primary?: boolean; // ปุ่มเด่นตรงกลางแถบล่าง (ธุรกรรมที่ใช้บ่อยที่สุด)
  badge?: string; // ป้ายกำกับเสริม (ถ้ามี)
}

export interface RoleConfig {
  role: NavRole;
  label: string;
  portalLabel: string;
  icon: LucideIcon;
  badgeClass: string;
  dotClass: string;
  activeNavClass: string;
  mobileActiveColor: string;
  avatarBgClass: string;
}

export const ROLE_CONFIG: Record<NavRole, RoleConfig> = {
  CITIZEN: {
    role: 'CITIZEN',
    label: 'ประชาชน',
    portalLabel: 'ประชาชน (Citizen)',
    icon: User,
    badgeClass: 'bg-blue-50 text-brand-blue border-blue-200/80 ring-1 ring-blue-500/10',
    dotClass: 'bg-brand-blue',
    activeNavClass: 'bg-brand-blue text-white shadow-xs',
    mobileActiveColor: 'text-brand-blue',
    avatarBgClass: 'bg-brand-blue text-white',
  },
  MERCHANT: {
    role: 'MERCHANT',
    label: 'ร้านค้า',
    portalLabel: 'ร้านค้า (Merchant)',
    icon: Store,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-1 ring-emerald-500/10',
    dotClass: 'bg-emerald-600',
    activeNavClass: 'bg-emerald-600 text-white shadow-xs',
    mobileActiveColor: 'text-emerald-700',
    avatarBgClass: 'bg-emerald-600 text-white',
  },
  ADMIN: {
    role: 'ADMIN',
    label: 'ผู้ดูแลระบบ',
    portalLabel: 'ผู้ดูแลระบบ (Admin)',
    icon: ShieldAlert,
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/80 ring-1 ring-rose-500/10',
    dotClass: 'bg-rose-600',
    activeNavClass: 'bg-slate-900 text-white shadow-xs',
    mobileActiveColor: 'text-rose-700',
    avatarBgClass: 'bg-rose-600 text-white',
  },
};

export const ROLE_LABEL: Record<NavRole, { label: string; icon: LucideIcon }> = {
  CITIZEN: { label: ROLE_CONFIG.CITIZEN.label, icon: ROLE_CONFIG.CITIZEN.icon },
  MERCHANT: { label: ROLE_CONFIG.MERCHANT.label, icon: ROLE_CONFIG.MERCHANT.icon },
  ADMIN: { label: ROLE_CONFIG.ADMIN.label, icon: ROLE_CONFIG.ADMIN.icon },
};

export const NAV_BY_ROLE: Record<NavRole, NavItem[]> = {
  CITIZEN: [
    { to: APP_ROUTES.HOME, label: 'หน้าแรก', fullLabel: 'หน้าหลัก', icon: Home },
    { to: APP_ROUTES.CITIZEN_WALLET, label: 'กระเป๋าเงิน', fullLabel: 'กระเป๋าเงิน', icon: Wallet },
    { to: APP_ROUTES.CITIZEN_SCAN_COPAY, label: 'สแกนจ่าย', fullLabel: 'สแกนจ่าย Co-pay', icon: ScanLine, primary: true },
    { to: APP_ROUTES.CITIZEN_NEAR_ME, label: 'แนะนำร้าน', fullLabel: 'แนะนำร้านค้า', icon: Store },
    { to: APP_ROUTES.PROFILE, label: 'โปรไฟล์', fullLabel: 'โปรไฟล์ส่วนตัว', icon: User },
  ],
  MERCHANT: [
    { to: APP_ROUTES.MERCHANT_SALES, label: 'ยอดขาย', fullLabel: 'สถิติยอดขาย', icon: TrendingUp },
    { to: APP_ROUTES.MERCHANT_POS_QR, label: 'สร้าง QR', fullLabel: 'สร้าง QR รับเงิน', icon: QrCode, primary: true },
    { to: APP_ROUTES.MERCHANT_REVIEWS, label: 'รีวิวร้านค้า', fullLabel: 'รีวิวร้านค้า', icon: Star },
  ],
  ADMIN: [
    { to: APP_ROUTES.ADMIN_DASHBOARD, label: 'แดชบอร์ด', fullLabel: 'แดชบอร์ดผู้ดูแล', icon: LayoutDashboard },
    { to: APP_ROUTES.ADMIN_FRAUD_ALERTS, label: 'ตรวจทุจริต', fullLabel: 'ตรวจจับทุจริต', icon: ShieldAlert },
    { to: APP_ROUTES.ADMIN_CAMPAIGNS, label: 'แคมเปญ', fullLabel: 'แคมเปญและสิทธิประโยชน์', icon: Megaphone },
  ],
};

/**
 * ระบุบทบาทที่ใช้แสดงเมนู
 * ปัจจุบัน User type มีแค่ 'USER' | 'ADMIN' | 'MERCHANT' จึงอนุมานบทบาทร้านค้า/ประชาชนจาก role และ path
 */
export const resolveNavRole = (userRole: string | undefined, pathname: string): NavRole => {
  if (userRole === 'ADMIN' || pathname.startsWith('/admin')) return 'ADMIN';
  if (userRole === 'MERCHANT' || pathname.startsWith('/merchant')) return 'MERCHANT';
  return 'CITIZEN';
};
