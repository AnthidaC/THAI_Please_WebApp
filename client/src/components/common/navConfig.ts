import type { LucideIcon } from 'lucide-react';
import { Activity, ClipboardCheck, Home, MapPin, Store, Wallet, ReceiptText, QrCode, ChartNoAxesCombined, ShieldAlert } from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';

export type NavRole = 'PUBLIC' | 'CITIZEN' | 'MERCHANT' | 'ADMIN' | 'GOVERNMENT_EXECUTIVE';
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
    { label: 'หน้าหลัก', to: APP_ROUTES.DASHBOARD, icon: Home },
    { label: 'กระเป๋าเงิน', to: APP_ROUTES.CITIZEN_WALLET, icon: Wallet },
    { label: 'ประวัติธุรกรรม', to: APP_ROUTES.CITIZEN_TRANSACTIONS, icon: ReceiptText },
  ],
  MERCHANT: [
    { label: 'หน้าหลัก', to: APP_ROUTES.MERCHANT_HOME, icon: Home },
    { label: 'รับชำระเงิน / QR', to: APP_ROUTES.MERCHANT_POS_QR, icon: QrCode },
    { label: 'ยอดขาย', to: APP_ROUTES.MERCHANT_SALES, icon: ChartNoAxesCombined },
    { label: 'ข้อมูลร้านค้า', to: APP_ROUTES.MERCHANT_PROFILE, icon: Store },
  ],
  ADMIN: [
    { label: 'ตรวจคำขอร้านค้า', to: APP_ROUTES.ADMIN_MERCHANT_APPLICATIONS, icon: ClipboardCheck },
    { label: 'จัดการร้านค้า', to: APP_ROUTES.ADMIN_MERCHANTS, icon: Store },
    { label: 'คำขอเปลี่ยนพิกัด', to: APP_ROUTES.ADMIN_MERCHANT_LOCATION_REQUESTS, icon: MapPin },
    { label: 'ตรวจสอบทุจริต', to: APP_ROUTES.ADMIN_FRAUD_ALERTS, icon: ShieldAlert },
    { label: 'Dashboard ผลกระทบทางสังคม', to: APP_ROUTES.ADMIN_SOCIAL_IMPACT, icon: Activity },
  ],
  GOVERNMENT_EXECUTIVE: [
    { label: 'Dashboard ผลกระทบทางสังคม', to: APP_ROUTES.ADMIN_SOCIAL_IMPACT, icon: Activity },
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
