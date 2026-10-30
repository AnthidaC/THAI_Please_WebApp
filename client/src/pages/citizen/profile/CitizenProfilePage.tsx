import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  ShieldCheck,
  Wallet,
  Settings,
  ChevronRight,
  History,
  Lock,
  Compass,
  LogOut,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Info,
  Star,
  Store,
  SlidersHorizontal,
  Gift,
} from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { APP_ROUTES } from '../../../constants/routes';
import { getWalletBalance } from '../../../services/paymentApi';
import { getMyBadges } from '../../../services/badgeApi';
import { getMyRewards } from '../../../services/rewardApi';
import { usePaymentPinStatus } from '../../../hooks/usePaymentPinStatus';
import { WalletSecuritySettings } from '../../../components/payment/WalletSecuritySettings';
import { getBadgeTierIcon } from '../../../components/badges/badgeTierIcons';

const numberFormat = new Intl.NumberFormat('th-TH');

export const CitizenProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, clearAuth } = useAuthStore();

  // ดึงข้อมูลกระเป๋าเงินและยอดเงิน
  const { data: wallet, isLoading: isWalletLoading } = useQuery({
    queryKey: ['wallet-balance', user?.id],
    queryFn: getWalletBalance,
    enabled: isAuthenticated && Boolean(user?.id),
    staleTime: 10000,
  });

  // ดึงข้อมูลเหรียญตราและความสำเร็จสำหรับศูนย์เกม
  const { data: badges, isLoading: isBadgesLoading, isError: isBadgesError } = useQuery({
    queryKey: ['my-badges'],
    queryFn: getMyBadges,
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  const { data: rewards, isLoading: isRewardsLoading, isError: isRewardsError } = useQuery({
    queryKey: ['my-rewards'],
    queryFn: getMyRewards,
    enabled: isAuthenticated,
    staleTime: 0,
  });

  // สถานะ PIN ความปลอดภัย
  const { data: pinStatus } = usePaymentPinStatus();

  const badgeList = badges ?? [];
  const unlockedBadges = badgeList.filter((b) => b.isUnlocked);
  const rewardList = rewards ?? [];
  const availableRewardCount = rewardList.filter((reward) =>
    reward.status === 'available' &&
    (!reward.expiresAt || new Date(reward.expiresAt).getTime() > Date.now())
  ).length;

  const handleLogout = () => {
    if (window.confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
      clearAuth();
      navigate(APP_ROUTES.HOME, { replace: true });
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

          <section aria-labelledby="earned-badges-heading" className="mt-4 -mx-3 rounded-2xl border border-hairline bg-surface-soft/60 p-3 sm:mt-5">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <h3 id="earned-badges-heading" className="text-sm font-semibold text-ink">
                เหรียญตราที่ได้รับ
              </h3>
              <Link
                to={APP_ROUTES.CITIZEN_ACHIEVEMENTS}
                className="touch-manipulation inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-brand-blue transition-colors hover:text-brand-blue-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
              >
                <span>ดูเหรียญตราทั้งหมด</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            {isBadgesLoading ? (
              <p role="status" aria-live="polite" className="text-sm text-ink-muted">กำลังโหลดเหรียญตรา…</p>
            ) : isBadgesError ? (
              <p role="alert" className="text-sm text-ink-muted">โหลดเหรียญตราไม่สำเร็จ ลองดูเหรียญตราทั้งหมดอีกครั้ง</p>
            ) : unlockedBadges.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2.5">
                {unlockedBadges.map((badge) => {
                  const tier = badge.currentTier;
                  if (!tier) return null;

                  const tooltip = `${badge.name} · ${tier.name}`;

                  return (
                    <span
                      key={badge.id}
                      role="img"
                      tabIndex={0}
                      aria-label={tooltip}
                      title={tooltip}
                      className="inline-flex h-12 w-12 shrink-0 cursor-help items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
                    >
                      <img
                        src={getBadgeTierIcon(tier.level)}
                        alt=""
                        aria-hidden="true"
                        width={48}
                        height={48}
                        loading="lazy"
                        className="h-12 w-12 object-contain"
                      />
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">ยังไม่มีเหรียญตราที่ได้รับ</p>
            )}
          </section>
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
              ไป  กระเป๋าเงิน
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

        <Link
          to={APP_ROUTES.CITIZEN_REWARDS}
          aria-labelledby="owned-rewards-heading"
          className="group block rounded-2xl border border-hairline bg-white shadow-xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Gift className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 id="owned-rewards-heading" className="text-sm font-bold text-ink sm:text-base">
                  รางวัลของฉัน
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  ดูรหัสรางวัล สถานะ และวันหมดอายุของคุณ
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs font-medium text-ink-muted">
                {isRewardsLoading
                  ? 'กำลังโหลด…'
                  : isRewardsError
                  ? 'ดูรางวัลทั้งหมด'
                  : `ทั้งหมด ${numberFormat.format(rewardList.length)} รายการ · พร้อมใช้ ${numberFormat.format(availableRewardCount)}`}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-emerald-700 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
            </div>
          </div>
        </Link>

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
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-status-error bg-red-50 hover:bg-red-100 border border-red-200 rounded-pill transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
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
