import type { LucideIcon } from 'lucide-react';
import { Home, Wallet, ScanLine, Store, User, QrCode, ShieldAlert, TrendingUp, Star, Megaphone } from 'lucide-react';
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
  label: string;
  to?: string;
  href?: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
}

export const CITIZEN_HOME_CARDS: NavItem[] = [
  { label: 'กระเป๋าเงิน', to: APP_ROUTES.CITIZEN_WALLET, icon: Wallet },
  { label: 'สแกนจ่าย', to: APP_ROUTES.CITIZEN_SCAN_COPAY, icon: QrCode },
  { label: 'ร้านค้าใกล้ตัว', icon: Store, comingSoon: true },
  { label: 'ภารกิจ', icon: ClipboardCheck, comingSoon: true },
];

export const PUBLIC_NAV: NavItem[] = [
  { label: 'หน้าแรก', to: APP_ROUTES.HOME },
  { label: 'จุดเด่นโครงการ', href: '/#highlights' },
  { label: 'คำถามที่พบบ่อย', href: '/#faq' },
];

export const PUBLIC_ACTIONS = {
  login: { label: 'เข้าสู่ระบบ', to: APP_ROUTES.LOGIN },
  register: { label: 'สมัครเข้าร่วม', to: APP_ROUTES.REGISTER },
  citizenRegister: { label: 'ประชาชน', to: APP_ROUTES.REGISTER },
  merchantRegister: { label: 'ร้านค้า', to: APP_ROUTES.MERCHANT_REGISTER },
} as const;

export const NAV_BY_ROLE: Record<Exclude<NavRole, 'PUBLIC'>, NavItem[]> = {
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
    { to: APP_ROUTES.ADMIN_FRAUD_ALERTS, label: 'ตรวจทุจริต', fullLabel: 'ตรวจจับทุจริต', icon: ShieldAlert },
    { to: APP_ROUTES.ADMIN_CAMPAIGNS, label: 'แคมเปญ', fullLabel: 'แคมเปญและสิทธิประโยชน์', icon: Megaphone },
  ],
};

export const ROLE_LABEL: Record<NavRole, string> = {
  PUBLIC: 'โครงการไทยช่วยไทยพลัส',
  CITIZEN: 'ประชาชน',
  MERCHANT: 'ร้านค้า',
  ADMIN: 'ผู้ดูแลระบบ / ผู้บริหาร',
  GOVERNMENT_EXECUTIVE: 'ผู้บริหารภาครัฐ',
};

export function resolveNavRole(userRole?: string): NavRole {
  if (userRole === 'MERCHANT') return 'MERCHANT';
  if (userRole === 'ADMIN' || userRole === 'STAFF') return 'ADMIN';
  if (userRole === 'GOVERNMENT_EXECUTIVE' || userRole === 'GOV_EXECUTIVE' || userRole === 'EXECUTIVE') return 'GOVERNMENT_EXECUTIVE';
  return userRole ? 'CITIZEN' : 'PUBLIC';
}
