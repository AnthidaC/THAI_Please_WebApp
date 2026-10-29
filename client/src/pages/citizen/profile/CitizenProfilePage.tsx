import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  ShieldCheck,
  Wallet,
  Gamepad2,
  Settings,
  ChevronRight,
  Trophy,
  History,
  Lock,
  Compass,
  LogOut,
  Sparkles,
  Award,
  CheckCircle2,
  ArrowRight,
  Info,
  Star,
  Store,
  SlidersHorizontal,
  Users,
  Gift,
} from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { APP_ROUTES } from '../../../constants/routes';
import { getWalletBalance } from '../../../services/paymentApi';
import { getMyBadges } from '../../../services/badgeApi';
import { usePaymentPinStatus } from '../../../hooks/usePaymentPinStatus';
import { WalletSecuritySettings } from '../../../components/payment/WalletSecuritySettings';

export const CitizenProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, clearAuth } = useAuthStore();

  // ดึงข้อมูลกระเป๋าเงินและยอดเงิน
  const { data: wallet, isLoading: isWalletLoading } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: getWalletBalance,
    enabled: isAuthenticated,
    staleTime: 10000,
  });

  // ดึงข้อมูลเหรียญตราและความสำเร็จสำหรับศูนย์เกม
  const { data: badges, isLoading: isBadgesLoading } = useQuery({
    queryKey: ['my-badges'],
    queryFn: getMyBadges,
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  // สถานะ PIN ความปลอดภัย
  const { data: pinStatus } = usePaymentPinStatus();

  const badgeList = badges ?? [];
  const unlockedBadges = badgeList.filter((b) => b.isUnlocked);
  const nextTargetBadge = badgeList.find((b) => !b.isUnlocked && !b.isMaxTier) || badgeList[0];

  const handleLogout = () => {
    if (window.confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
      clearAuth();
      navigate(APP_ROUTES.HOME);
    }
  };

  return (
    <div className="min-h-screen bg-surface-soft pb-28 pt-4 font-sans text-ink md:pb-14">
      <div className="mx-auto max-w-4xl px-3.5 sm:px-6 lg:px-8 space-y-5">
        
        {/* ================= 1. HEADER / BREADCRUMB ================= */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-hairline/80 pb-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-brand-blue-light text-brand-blue">
                <User className="h-5 w-5" />
              </span>
              <span>โปรไฟล์ส่วนตัว</span>
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
              จัดการข้อมูลประชาชน เชื่อมต่อไปยังเกมเหรียญตรา และการตั้งค่าระบบ
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-xs font-semibold bg-emerald-50 text-status-success border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>สิทธิ์ Co-pay 60/40 พร้อมใช้งาน</span>
            </span>
          </div>
        </div>

        {/* ================= 2. CITIZEN IDENTITY CARD ================= */}
        <section aria-labelledby="profile-identity-title" className="bg-white rounded-3xl border border-hairline p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Avatar & User Details */}
            <div className="flex items-start sm:items-center space-x-4">
              <div className="relative">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-tr from-brand-blue to-blue-400 text-white flex items-center justify-center font-bold text-xl sm:text-2xl shadow-md shadow-blue-500/20">
                  {user?.name ? user.name.slice(0, 1).toUpperCase() : 'U'}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-xs">
                  <ShieldCheck className="h-5 w-5 text-brand-blue fill-blue-50" />
                </div>
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 id="profile-identity-title" className="text-lg sm:text-xl font-bold text-ink truncate">
                    {user?.name || 'ประชาชนผู้รับสิทธิ์'}
                  </h2>
                  <span className="text-[11px] font-semibold bg-brand-blue-light text-brand-blue px-2 py-0.5 rounded-pill border border-blue-200">
                    ประชาชน (Citizen)
                  </span>
                </div>
                <p className="text-xs text-ink-muted truncate">
                  {user?.email || 'citizen@thaiplease.gov.th'}
                </p>
                <div className="flex items-center gap-3 pt-1 text-xs text-ink-muted">
                  <span className="font-mono bg-surface-soft px-2 py-0.5 rounded-md border border-hairline">
                    รหัสประชาชน: 1-1002-XXXXX-89-0
                  </span>
                  <span className="inline-flex items-center gap-1 text-status-success font-medium">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>ยืนยันตัวตน KYC ผ่านแล้ว</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Wallet Info Badge */}
            <div className="bg-surface-soft border border-hairline rounded-2xl p-3.5 sm:text-right shrink-0">
              <p className="text-[11px] font-medium text-ink-muted flex items-center sm:justify-end gap-1">
                <Wallet className="h-3.5 w-3.5 text-brand-blue" />
                <span>ยอดเงินในกระเป๋า</span>
              </p>
              <p className="text-xl sm:text-2xl font-bold font-mono font-numeric text-ink mt-0.5">
                ฿{isWalletLoading ? '...' : (wallet?.balance ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </p>
              <button
                type="button"
                onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:text-brand-blue-hover transition"
              >
                <span>จัดการกระเป๋าเงิน</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* ================= 3. QUICK WALLET & CO-PAY STATS ================= */}
        <section aria-label="สถิติกระเป๋าเงินและสิทธิ์คนละครึ่ง" className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="bg-white rounded-2xl border border-hairline p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-brand-blue" />
                <span>สิทธิคนละครึ่งวันนี้ (Co-pay 60%)</span>
              </p>
              <p className="text-lg font-bold font-mono font-numeric text-ink">
                ฿{(wallet?.dailyQuotaRemaining ?? 150).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                <span className="text-xs font-normal text-ink-muted ml-1.5">/ 150.00 บาท</span>
              </p>
              <p className="text-[11px] text-ink-muted">
                รีเซ็ตโควตารัฐสมทบทุกวันเวลา 06:00 น.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="px-3.5 py-2 text-xs font-semibold text-brand-blue bg-brand-blue-light hover:bg-blue-100 rounded-pill transition border border-blue-200"
            >
              เติมเงิน / สิทธิ์
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-hairline p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-ink-muted flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-ink-muted" />
                <span>ประวัติรายการธุรกรรม</span>
              </p>
              <p className="text-sm font-semibold text-ink">
                ตรวจสอบบิลและสลิป Co-pay
              </p>
              <p className="text-[11px] text-ink-muted">
                ดูย้อนหลังยอดรัฐสมทบและยอดจ่ายจริง
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.CITIZEN_TRANSACTIONS)}
              className="px-3.5 py-2 text-xs font-semibold text-ink-body bg-surface-soft hover:bg-gray-200 rounded-pill transition border border-hairline"
            >
              ดูประวัติ
            </button>
          </div>
        </section>

        {/* ================= ประวัติการรีวิวของฉัน ================= */}
        <section aria-label="ประวัติการรีวิวร้านค้า" className="bg-white rounded-2xl border border-hairline p-4 sm:p-5 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <p className="text-xs text-ink-muted flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              <span>ประวัติการรีวิวของฉัน</span>
            </p>
            <p className="text-sm font-semibold text-ink">
              ร้านค้าที่คุณเคยให้คะแนน
            </p>
            <p className="text-[11px] text-ink-muted">
              ตรวจสอบดาวและความคิดเห็นที่คุณเคยให้แก่ร้านค้าชุมชน
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.CITIZEN_REVIEW, { state: { from: 'profile' } })}
            className="px-3.5 py-2 text-xs font-semibold text-ink-body bg-surface-soft hover:bg-gray-200 rounded-pill transition border border-hairline shrink-0"
          >
            ดูรีวิว
          </button>
        </section>

        {/* ================= 4. ศูนย์รวมภารกิจและรางวัล (GAMIFICATION CENTER - UC 2.4) ================= */}
        <section aria-labelledby="gamification-hub-heading" className="bg-white rounded-3xl border border-hairline p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-hairline/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-xs">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h2 id="gamification-hub-heading" className="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
                  <span>ศูนย์รวมภารกิจและรางวัล (Gamification Center)</span>
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-pill">
                    UC 2.4
                  </span>
                </h2>
                <p className="text-xs text-ink-muted">
                  ทำภารกิจ สะสมเหรียญตรา และชวนเพื่อนเพื่อรับสิทธิประโยชน์และคูปองส่วนลดพิเศษ
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 2.4.1 หน้ากระดานภารกิจและเหรียญตรา (Quests & Badges) [Dev 4] */}
            <div className="bg-gradient-to-br from-indigo-900 via-brand-blue to-blue-700 text-white rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between space-y-4">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-white/15 backdrop-blur-md text-amber-300 border border-white/20 text-[11px] font-bold">
                  <Gamepad2 className="h-3 w-3 text-amber-300" />
                  <span>2.4.1 ภารกิจ &amp; ตราประทับ (Quests &amp; Badges)</span>
                </div>
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>ล่าเหรียญตราความสำเร็จ</span>
                  <Award className="h-4 w-4 text-amber-300" />
                </h3>
                <p className="text-xs text-blue-100 leading-relaxed">
                  สะสมความคืบหน้าจากการสแกนจ่าย Co-pay รีวิวร้านค้าชุมชน และคำชวนเพื่อน เพื่อปลดล็อกตราประทับ
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="bg-white/15 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg text-xs font-medium">
                    ปลดล็อกแล้ว: <strong className="text-white font-mono">{isBadgesLoading ? '...' : unlockedBadges.length}</strong> / {badgeList.length} ตรา
                  </div>
                  {nextTargetBadge && (
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg text-[11px] text-blue-100">
                      ถัดไป: <strong>{nextTargetBadge.name}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative z-10 pt-2">
                <button
                  type="button"
                  onClick={() => navigate(APP_ROUTES.CITIZEN_ACHIEVEMENTS)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-brand-blue font-bold text-xs sm:text-sm shadow-sm hover:bg-blue-50 active:scale-95 transition"
                >
                  <Gamepad2 className="h-4 w-4 text-brand-blue" />
                  <span>เข้าสู่หน้าภารกิจ &amp; เหรียญตรา</span>
                  <ArrowRight className="h-4 w-4 text-brand-blue" />
                </button>
              </div>
            </div>

            {/* 2.4.3 หน้าแชร์โค้ดแนะนำเพื่อน (Merchant Referral) [Dev 3] */}
            <div className="bg-gradient-to-br from-emerald-800 via-teal-700 to-emerald-600 text-white rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between space-y-4">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-white/15 backdrop-blur-md text-emerald-200 border border-white/20 text-[11px] font-bold">
                  <Users className="h-3 w-3 text-emerald-200" />
                  <span>2.4.3 แนะนำเพื่อน (Merchant Referral)</span>
                </div>
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>ชวนเพื่อนรับคูปอง ฿40</span>
                  <Gift className="h-4 w-4 text-amber-300" />
                </h3>
                <p className="text-xs text-emerald-50 leading-relaxed">
                  แชร์รหัสร้านโปรดที่คุณเคยชำระเงินสำเร็จ รับคูปอง ฿40 ทุกๆ 5 ร้านค้าที่แนะนำเพื่อนใหม่สำเร็จ (คูปองมีอายุ 14 วัน)
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="bg-white/15 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg text-xs font-medium">
                    รางวัล: <strong className="text-amber-300 font-mono">฿40</strong> ต่อ 5 ร้านสำเร็จ
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg text-[11px] text-emerald-100">
                    อายุคูปอง: <strong>14 วัน</strong>
                  </div>
                </div>
              </div>

              <div className="relative z-10 pt-2">
                <button
                  type="button"
                  onClick={() => navigate(APP_ROUTES.CITIZEN_REFERRALS)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-800 font-bold text-xs sm:text-sm shadow-sm hover:bg-emerald-50 active:scale-95 transition"
                >
                  <Users className="h-4 w-4 text-emerald-800" />
                  <span>เปิดหน้าระบบชวนเพื่อน (Referral)</span>
                  <ArrowRight className="h-4 w-4 text-emerald-800" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 5. ทางไปหน้าตั้งค่า (SETTINGS & SECURITY HUB) ================= */}
        <section aria-labelledby="settings-hub-heading" className="bg-white rounded-3xl border border-hairline p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-hairline/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h2 id="settings-hub-heading" className="text-base sm:text-lg font-bold text-ink">
                  ศูนย์การตั้งค่า &amp; ความปลอดภัย
                </h2>
                <p className="text-xs text-ink-muted">
                  ตั้งค่ารหัส PIN ความปลอดภัยกระเป๋าเงิน และการใช้งานระบบ
                </p>
              </div>
            </div>

            <span className="text-xs font-medium text-brand-blue bg-brand-blue-light px-2.5 py-1 rounded-pill border border-blue-200">
              ความปลอดภัยสูง
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
            {/* 5.1 PIN Security Settings */}
            <div className="rounded-2xl border border-hairline bg-surface-soft/60 p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Lock className="h-4 w-4 text-brand-blue" />
                  <span>รหัส PIN ความปลอดภัย 6 หลัก</span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  ต้องใช้รหัส PIN ยืนยันทุกครั้งก่อนชำระเงิน Co-pay เพื่อป้องกันการสวมสิทธิ์เงินกระเป๋า
                </p>
                <div className="pt-1">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-pill ${
                    pinStatus?.isSet
                      ? 'bg-emerald-50 text-status-success border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{pinStatus?.isSet ? 'ตั้งค่ารหัส PIN เรียบร้อยแล้ว' : 'ยังไม่ได้ตั้งค่ารหัส PIN'}</span>
                  </span>
                </div>
              </div>

              {/* WalletSecuritySettings Trigger Modal Component */}
              <div className="pt-2">
                <WalletSecuritySettings />
              </div>
            </div>

            {/* 5.2 Near-Me Recommendations & Location Setting */}
            <div className="rounded-2xl border border-hairline bg-surface-soft/60 p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <Compass className="h-4 w-4 text-brand-blue" />
                  <span>แนะนำร้านค้าใกล้คุณ (GPS)</span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  ค้นหาร้านค้า Co-pay และร้านอาหารสตรีทฟู้ดชุมชนใกล้ตำแหน่งพิกัดจริงของคุณ
                </p>
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-brand-blue px-2.5 py-0.5 rounded-pill border border-blue-200">
                    <Sparkles className="h-3 w-3" />
                    <span>ระบบค้นหาอัจฉริยะ พร้อม AI Explainability</span>
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate(APP_ROUTES.CITIZEN_NEAR_ME)}
                  className="flex w-full items-center justify-between rounded-2xl border border-hairline bg-white px-4 py-3 text-left text-xs sm:text-sm font-medium text-ink transition hover:bg-surface-soft"
                >
                  <div className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-brand-blue" />
                    <span>เปิดหน้าแนะนำร้านค้า</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-muted" />
                </button>
              </div>
            </div>

            {/* 5.3 Citizen Category Preferences (UC 2.5.3) */}
            <div className="rounded-2xl border border-hairline bg-surface-soft/60 p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <SlidersHorizontal className="h-4 w-4 text-brand-blue" />
                  <span>ประเภทร้านค้าที่สนใจ</span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  เลือกประเภทสินค้าและบริการที่คุณชื่นชอบเพื่อช่วยให้ AI แนะนำร้านค้าได้ตรงใจคุณ
                </p>
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-brand-blue px-2.5 py-0.5 rounded-pill border border-blue-200">
                    <Sparkles className="h-3 w-3" />
                    <span>5 หมวดหมู่ทางการ (UC 2.5.3)</span>
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => navigate(APP_ROUTES.CITIZEN_PREFERENCES)}
                  className="flex w-full items-center justify-between rounded-2xl border border-hairline bg-white px-4 py-3 text-left text-xs sm:text-sm font-medium text-ink transition hover:bg-surface-soft"
                >
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-brand-blue" />
                    <span>ตั้งค่าหมวดหมู่ที่สนใจ</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-muted" />
                </button>
              </div>
            </div>

            </div>

          {/* 5.5 Program Terms & Privacy */}
          <div className="rounded-2xl border border-hairline p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-ink-muted">
            <div className="flex items-start gap-2.5">
              <Info className="h-4 w-4 text-brand-blue shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-ink">ข้อกำหนดโครงการคนละครึ่ง THAI Please Co-pay</p>
                <p className="mt-0.5">
                  คุ้มครองข้อมูลส่วนบุคคลตาม พ.ร.บ. PDPA และมาตรการความปลอดภัยธนาคารแห่งประเทศไทย
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[11px] bg-surface-soft px-2 py-1 rounded-md border border-hairline">
                v1.2.0-secure
              </span>
            </div>
          </div>

          {/* 5.4 Sign Out Action */}
          <div className="pt-2 border-t border-hairline flex justify-end">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-status-error bg-red-50 hover:bg-red-100 border border-red-200 rounded-pill transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>ออกจากระบบบัญชีประชาชน</span>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default CitizenProfilePage;
