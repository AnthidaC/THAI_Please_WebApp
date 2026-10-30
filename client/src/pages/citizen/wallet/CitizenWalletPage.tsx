import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  QrCode,
  ArrowUpRight,
  History,
  ShieldCheck,
  PlusCircle,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Award,
  UserCheck,
  Info,
} from 'lucide-react';
import {
  getWalletBalance,
  topUpWallet,
  enrollInCampaign,
  getBuyerHistory,
} from '../../../services/paymentApi';
import { APP_ROUTES } from '../../../constants/routes';
import { WalletSecuritySettings } from '../../../components/payment/WalletSecuritySettings';

export const CitizenWalletPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(300);
  const [topUpSuccessMsg, setTopUpSuccessMsg] = useState<string | null>(null);
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);

  // ดึงข้อมูลกระเป๋าเงิน
  const {
    data: wallet,
    isLoading: isWalletLoading,
    isError: isWalletError,
    refetch: refetchWallet,
  } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: getWalletBalance,
    refetchInterval: 10000,
  });

  // ดึงประวัติธุรกรรมล่าสุด
  const { data: transactions, isLoading: isTxLoading } = useQuery({
    queryKey: ['buyer-history'],
    queryFn: getBuyerHistory,
  });

  // Mutation สำหรับเติมเงิน
  const topUpMutation = useMutation({
    mutationFn: (amount: number) => topUpWallet(amount),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-history'] });
      setTopUpSuccessMsg(
        `เติมเงินสำเร็จ ฿${topUpAmount.toLocaleString()} ยอดคงเหลือใหม่: ฿${data.newBalance.toLocaleString()}`
      );
      setTimeout(() => {
        setTopUpSuccessMsg(null);
        setShowTopUpModal(false);
      }, 1500);
    },
  });

  // Mutation สำหรับลงทะเบียนขอรับสิทธิ์โครงการ Co-pay
  const enrollMutation = useMutation({
    mutationFn: (campaignId?: string) => enrollInCampaign(campaignId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      setEnrollMsg(
        `ลงทะเบียนขอรับสิทธิสำเร็จ! ได้รับโควตารวม ฿${data.wallet.totalQuotaRemaining.toLocaleString()} (เพดาน ฿${data.wallet.dailyQuotaLimit.toFixed(0)}/วัน)`
      );
      setTimeout(() => setEnrollMsg(null), 6000);
    },
    onError: (err: any) => {
      alert(
        err.response?.data?.message ||
          'ไม่สามารถลงทะเบียนขอรับสิทธิได้ กรุณาลองใหม่อีกครั้ง'
      );
    },
  });

  const dailyLimit = wallet?.dailyQuotaLimit || 200;
  const dailyUsedPercent = wallet
    ? Math.min(100, Math.round((wallet.dailyQuotaUsed / dailyLimit) * 100))
    : 0;

  // คำนวณยอดใช้ไปและเปอร์เซ็นต์ของช่วงสิทธิ / ยอดรวม
  const periodLimit = wallet?.periodQuota.enabled && wallet.periodQuota.currentPeriod
    ? wallet.periodQuota.currentPeriod.quotaLimit
    : (wallet?.campaignInfo?.totalLimit || 0);
  const periodUsed = wallet?.periodQuota.enabled && wallet.periodQuota.currentPeriod
    ? wallet.periodQuota.currentPeriod.quotaUsed
    : (wallet?.campaignInfo ? Math.max(0, wallet.campaignInfo.totalLimit - (wallet.totalQuotaRemaining || 0)) : 0);
  const periodUsedPercent = periodLimit > 0
    ? Math.min(100, Math.round((periodUsed / periodLimit) * 100))
    : 0;

  // คำนวณวันสิ้นสุดของงวดปัจจุบัน (วันสิ้นเดือนของงวดปัจจุบัน)
  const getFallbackCycleDates = () => {
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
    ];
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear() + 543;
    const lastDay = new Date(now.getFullYear(), m + 1, 0).getDate();
    return {
      monthName: `${thaiMonths[m]} ${y}`,
      validUntil: `${lastDay} ${thaiMonths[m]} ${y}`,
    };
  };
  const fallbackCycle = getFallbackCycleDates();
  const formatThaiPeriodDate = (dateStr: string) => new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(dateStr));
  const periodStatusLabel: Record<string, string> = {
    BEFORE_FIRST: 'ยังไม่เริ่มช่วงสิทธิ์',
    BETWEEN_PERIODS: 'ไม่มีช่วงที่ใช้งานในขณะนี้',
    AFTER_LAST: 'สิ้นสุดช่วงสิทธิ์แล้ว',
    ALLOCATION_MISSING: 'กำลังจัดสรรวงเงินช่วงนี้',
    INVALID_OVERLAP: 'ช่วงเวลาโครงการมีข้อมูลทับซ้อน',
  };
  const currentCycleName = wallet?.periodQuota.enabled
    ? wallet.periodQuota.currentPeriod?.name ?? periodStatusLabel[wallet.periodQuota.status] ?? 'ไม่มีช่วงที่ใช้งาน'
    : wallet?.monthlyCycle?.currentMonthName ?? fallbackCycle.monthName;
  const currentValidUntil = wallet?.periodQuota.enabled && wallet.periodQuota.currentPeriod
    ? formatThaiPeriodDate(wallet.periodQuota.currentPeriod.endDate)
    : wallet?.monthlyCycle?.validUntilDate ?? fallbackCycle.validUntil;

  // แปลงวันที่แบบย่อภาษาไทย
  const formatThaiDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
    ];
    return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
  };

  const isEligible = wallet?.eligibilityStatus === 'ELIGIBLE';
  const periodCanBeSpent = !wallet?.periodQuota.enabled || wallet.periodQuota.status === 'ACTIVE';
  const availableReg = wallet?.availableCampaignForRegistration;
  const hasOpenRegistration = !isEligible && !!availableReg?.isRegistrationOpen;

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* 1. Page Header (Seamlessly integrated into canvas — No duplicate white bar) */}
      <div className="mx-auto max-w-6xl px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue shadow-xs">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-ink truncate">
                กระเป๋าเงินประชาชน
              </h1>
              <p className="text-xs text-ink-muted truncate">
                ยอดเงินคงเหลือและสิทธิร่วมจ่าย Co-pay 60/40
              </p>
            </div>
          </div>
          <button
            onClick={() => refetchWallet()}
            className="flex shrink-0 items-center space-x-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 hover:text-ink transition border border-slate-200/80 shadow-2xs"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-brand-blue ${isWalletLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">อัปเดตข้อมูล</span>
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-3.5 sm:px-6 lg:px-8 space-y-4">
        {/* ข้อความแจ้งเตือนข้อผิดพลาด (ถ้ามี) */}
        {isWalletError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 sm:p-4 text-xs sm:text-sm text-status-error flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">ไม่สามารถเชื่อมต่อข้อมูลกระเป๋าเงินได้</p>
              <p className="text-xs mt-0.5 text-red-600">กรุณาเข้าสู่ระบบ หรือลองใหม่อีกครั้ง</p>
            </div>
          </div>
        )}

        {/* ข้อความแจ้งเตือนเมื่อลงทะเบียนสิทธิสำเร็จ */}
        {enrollMsg && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-900 flex items-center space-x-3 shadow-xs animate-in fade-in duration-300">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="flex-1 font-medium">{enrollMsg}</div>
          </div>
        )}

        {/* Responsive Grid: Single column on Mobile, 12-Col Split on Tablet/Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Left Column: Balances & Quota (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-3 sm:space-y-4">
            {/* 1. การ์ดยอดเงินส่วนตัว (Personal Wallet Balance) */}
            <section className="relative overflow-hidden rounded-2xl border border-hairline bg-white p-3.5 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink-muted">
                  ยอดเงินในกระเป๋าส่วนตัว
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-status-success border border-emerald-200">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
                  พร้อมใช้งาน
                </span>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-ink truncate">
                    ฿{' '}
                    {isWalletLoading
                      ? '---.--'
                      : (wallet?.balance ?? 0).toLocaleString('th-TH', {
                          minimumFractionDigits: 2,
                        })}
                  </div>
                </div>
                <button
                  id="btn-open-topup"
                  onClick={() => setShowTopUpModal(true)}
                  className="inline-flex items-center justify-center space-x-1 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-brand-blue transition hover:bg-blue-100 active:scale-95 shrink-0"
                >
                  <PlusCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>เติมเงิน</span>
                </button>
              </div>
            </section>

            {/* 2. สิทธิโครงการ Co-pay: กระชับ พอดีหน้าจอ ไม่ใหญ่เทอะทะ */}
            {isEligible && (
              <section className="rounded-2xl border border-blue-100 bg-white p-3.5 sm:p-5 shadow-xs space-y-3">
                {/* Header: ชื่อโครงการและงวด */}
                <div className="flex items-center justify-between gap-2 border-b border-hairline/70 pb-2.5">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-brand-blue flex items-center justify-center shrink-0">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-bold text-ink truncate">
                        {wallet.campaignInfo?.campaignName || 'สิทธิรัฐช่วยจ่าย 60% (Co-pay)'}
                      </h2>
                      <span className="text-[10px] sm:text-xs text-ink-muted block truncate">
                        งวดประจำเดือน: {currentCycleName}
                      </span>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold text-brand-blue border border-blue-200/80 shrink-0">
                    <Calendar className="mr-1 h-3 w-3 shrink-0" />
                    <span>ถึง {currentValidUntil}</span>
                  </span>
                </div>

                {/* 2 คอลัมน์คู่ขนานทั้งบน Mobile และ Desktop กระชับพอดี ไม่กินพื้นที่แนวตั้ง */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {/* กล่อง 1: สิทธิวันนี้ */}
                  <div className="rounded-xl border border-hairline bg-surface-soft/60 p-2.5 sm:p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[10px] sm:text-xs">
                        <span className="font-semibold text-ink-muted truncate">สิทธิวันนี้</span>
                        <span className="font-mono text-brand-blue font-medium shrink-0">
                          ฿{wallet.dailyQuotaLimit.toFixed(0)}/วัน
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-lg sm:text-2xl font-extrabold text-brand-blue truncate">
                        ฿ {isWalletLoading ? '---' : wallet.dailyQuotaRemaining.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    
                    {/* Mini progress bar */}
                    <div className="mt-2 pt-1.5 border-t border-hairline/60">
                      <div className="flex items-center justify-between text-[9px] sm:text-[11px] text-ink-muted mb-1">
                        <span>ใช้แล้ว</span>
                        <span className="font-mono font-semibold text-ink">
                          ฿{wallet.dailyQuotaUsed.toFixed(0)} ({dailyUsedPercent}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-blue transition-all duration-500"
                          style={{ width: `${dailyUsedPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* กล่อง 2: สิทธิคงเหลือรอบนี้ / รวม */}
                  <div className="rounded-xl border border-hairline bg-surface-soft/60 p-2.5 sm:p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[10px] sm:text-xs">
                        <span className="font-semibold text-ink-muted truncate">
                          {wallet.periodQuota.enabled ? 'คงเหลือช่วงนี้' : 'คงเหลือรวม'}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-emerald-700 border border-emerald-200 shrink-0">
                          {wallet.periodQuota.enabled && wallet.periodQuota.currentPeriod
                            ? `เต็ม ฿${wallet.periodQuota.currentPeriod.quotaLimit.toLocaleString('th-TH')}`
                            : 'สะสม'}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-lg sm:text-2xl font-extrabold text-emerald-600 truncate">
                        ฿{' '}
                        {isWalletLoading
                          ? '---'
                          : (wallet.periodQuota.enabled && wallet.periodQuota.currentPeriod
                              ? wallet.periodQuota.currentPeriod.quotaRemaining
                              : wallet.totalQuotaRemaining
                            ).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Mini progress bar */}
                    <div className="mt-2 pt-1.5 border-t border-hairline/60">
                      <div className="flex items-center justify-between text-[9px] sm:text-[11px] text-ink-muted mb-1">
                        <span>ใช้แล้ว</span>
                        <span className="font-mono font-semibold text-ink">
                          ฿{periodUsed.toFixed(0)} ({periodUsedPercent}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                          style={{ width: `${periodUsedPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status banner when period is not active */}
                {wallet.periodQuota.enabled && !wallet.periodQuota.currentPeriod && (
                  <div role="status" className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-900 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                    <span>{periodStatusLabel[wallet.periodQuota.status] ?? 'ไม่มีช่วงโครงการที่เปิดใช้งานในขณะนี้'}</span>
                  </div>
                )}
              </section>
            )}

            {/* กรณีที่ 2: ผู้ใช้ยังไม่มีสิทธิ์ แต่มีโครงการเปิดรับสมัครและโควตาเหลือ (Open Registration) */}
            {hasOpenRegistration && availableReg && (
              <section className="rounded-card border-2 border-brand-blue/30 bg-gradient-to-br from-blue-50 via-indigo-50/40 to-white p-4 sm:p-5 md:p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Award className="h-5 w-5 text-brand-blue shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">
                      เปิดรับสมัครสิทธิใหม่
                    </span>
                  </div>
                  <span className="inline-flex items-center rounded-pill bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[11px] font-semibold border border-emerald-300">
                    <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping" />
                    เปิดให้ลงทะเบียนรับสิทธิ
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="text-base sm:text-lg font-bold text-ink">
                    {availableReg.campaignName}
                  </h3>
                  <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                    รัฐช่วยจ่ายสมทบ {availableReg.governmentCopayRatePercent}% ประชาชนร่วมจ่าย {availableReg.citizenPaymentRatePercent}%
                    เพดานสูงสุด ฿{availableReg.dailyQuotaLimit.toFixed(0)} ต่อวัน ยอดรวมตลอดโครงการ ฿
                    {availableReg.totalQuotaLimit.toLocaleString()} {availableReg.periodCount > 0
                      ? `แบ่งเป็น ${availableReg.periodCount} ช่วง รวมวงเงินช่วงละ ฿${availableReg.configuredPeriodQuota.toLocaleString('th-TH')} โดยไม่ยกยอดวงเงินที่เหลือ`
                      : 'โควตาตามการตั้งค่าของโครงการ'}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl border border-hairline bg-white/90 p-3 shadow-2xs">
                    <span className="text-ink-muted block text-[11px]">เพดานรัฐช่วยจ่ายต่อวัน</span>
                    <span className="font-mono font-bold text-brand-blue text-sm sm:text-base">
                      ฿{availableReg.dailyQuotaLimit.toFixed(2)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-hairline bg-white/90 p-3 shadow-2xs">
                    <span className="text-ink-muted block text-[11px]">ระยะเวลารับสิทธิ</span>
                    <span className="font-medium text-ink text-[11px] sm:text-xs block mt-0.5">
                      {formatThaiDate(availableReg.startDate)} - {formatThaiDate(availableReg.endDate)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-hairline/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="text-[11px] text-ink-muted flex items-center space-x-1.5">
                    <Info className="h-4 w-4 text-brand-blue shrink-0" />
                    <span>กดรับสิทธิเพื่อเริ่มใช้จ่ายร่วม Co-pay ได้ทันที</span>
                  </div>
                  <button
                    id="btn-enroll-copay"
                    disabled={enrollMutation.isPending}
                    onClick={() => enrollMutation.mutate(availableReg.campaignId)}
                    className="inline-flex items-center justify-center space-x-2 rounded-pill bg-brand-blue px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-brand-blue-hover active:scale-95 disabled:opacity-50"
                  >
                    {enrollMutation.isPending ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>กำลังลงทะเบียน...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" />
                        <span>ลงทะเบียนขอรับสิทธิโครงการ</span>
                      </>
                    )}
                  </button>
                </div>
              </section>
            )}

            {/* กรณีที่ 3: ผู้ใช้ไม่มีสิทธิ และไม่มีโครงการเปิดรับสมัคร หรือโครงการหมดอายุ */}
            {!isEligible && !hasOpenRegistration && (
              <section className="rounded-card border border-amber-200 bg-amber-50/60 p-4 sm:p-5 md:p-6 shadow-sm">
                <div className="flex items-start space-x-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm sm:text-base font-bold text-amber-950">
                        ไม่มีสิทธิรับเงินสมทบโครงการ Co-pay
                      </h3>
                      <span className="rounded-pill bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                        {wallet?.eligibilityStatus === 'CAMPAIGN_EXPIRED'
                          ? 'โครงการสิ้นสุดแล้ว'
                          : 'ยังไม่ได้รับสิทธิ'}
                      </span>
                    </div>

                    <p className="text-xs text-amber-800 mt-1.5 leading-relaxed">
                      {wallet?.eligibilityStatus === 'CAMPAIGN_EXPIRED'
                        ? `โครงการ Co-pay ได้สิ้นสุดระยะเวลาแล้วเมื่อ ${formatThaiDate(
                            wallet.campaignInfo?.endDate
                          )} ขณะนี้ยังไม่มีโครงการใหม่เปิดรับสมัคร`
                        : 'ขณะนี้ท่านยังไม่มีสิทธิในโครงการ Co-pay และยังไม่มีโครงการเปิดรับสมัครสิทธิใหม่ในระบบ'}
                    </p>

                    <div className="mt-3 rounded-xl bg-white/70 border border-amber-200 p-3 text-[11px] text-amber-900 space-y-1">
                      <p className="font-semibold">คำแนะนำ:</p>
                      <p>
                        • ท่านยังคงสามารถใช้จ่ายผ่านกระเป๋าเงินส่วนตัว (Personal Wallet) ได้ตามปกติ
                      </p>
                      <p>
                        • เมื่อภาครัฐเปิดโครงการใหม่หรือเพิ่มโควตา ปุ่มลงทะเบียนขอรับสิทธิจะแสดงขึ้นบนหน้านี้โดยอัตโนมัติ
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Right Column: CTA & Transactions (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-3 sm:space-y-4">
            {/* 3. Primary CTA: สแกน QR ชำระเงิน (แถบสีน้ำเงินหลัก) */}
            <section>
              <button
                id="btn-scan-copay"
                type="button"
                disabled={!periodCanBeSpent}
                onClick={() => navigate(APP_ROUTES.CITIZEN_SCAN_COPAY)}
                title={!periodCanBeSpent ? 'ยังไม่มีช่วงโครงการที่เปิดใช้งาน' : undefined}
                className="group flex w-full items-center justify-between rounded-2xl bg-brand-blue p-3.5 sm:p-4 text-white shadow-md shadow-blue-500/20 transition-all hover:bg-brand-blue-hover active:scale-98 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-sm group-hover:scale-105 transition shadow-xs">
                    <QrCode className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-xs sm:text-sm font-bold leading-tight truncate">
                      {isEligible ? 'สแกนชำระ Co-pay 60/40' : 'สแกนชำระเงินดิจิทัล'}
                    </div>
                    <div className="text-[10px] sm:text-xs text-blue-100 mt-0.5 truncate">
                      {isEligible
                        ? 'สแกน QR ร้านค้าเพื่อรับเงินสมทบ 60%'
                        : 'สแกน QR ชำระด้วยยอดเงินส่วนตัว'}
                    </div>
                  </div>
                </div>
                <div className="pl-2 shrink-0">
                  <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-white/90 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                </div>
              </button>
            </section>

            {/* 4. รายการธุรกรรมล่าสุด (Recent Transactions) */}
            <section className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center space-x-2">
                  <History className="h-4 w-4 text-ink-muted shrink-0" />
                  <h3 className="text-sm font-semibold text-ink">ประวัติการใช้จ่ายล่าสุด</h3>
                </div>
                <button
                  onClick={() => navigate(APP_ROUTES.CITIZEN_TRANSACTIONS)}
                  className="text-xs font-medium text-brand-blue hover:underline shrink-0"
                >
                  ดูทั้งหมด
                </button>
              </div>

              {isTxLoading ? (
                <div className="py-6 text-center text-xs text-ink-muted">กำลังโหลดประวัติ...</div>
              ) : !transactions || transactions.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-ink-muted mb-2">
                    <History className="h-6 w-6" />
                  </div>
                  <p className="text-xs text-ink-muted">ยังไม่มีประวัติการใช้จ่าย</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    กดสแกน QR เพื่อเริ่มต้นใช้จ่ายได้ทันที
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-hairline">
                  {transactions.slice(0, 4).map((tx) => {
                    const isTopUp = tx.transactionType === 'TOPUP';
                    const isRefund = tx.transactionType === 'REFUND';
                    const isPositive = isTopUp || isRefund;
                    return (
                      <div
                        key={tx.transactionId}
                        onClick={() =>
                          isTopUp
                            ? navigate(APP_ROUTES.CITIZEN_TRANSACTIONS)
                            : navigate(`/citizen/slip/${tx.transactionId}`)
                        }
                        className="flex items-center justify-between gap-3 py-3 cursor-pointer hover:bg-surface-soft/60 px-2 rounded-xl transition"
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold text-xs ${
                              isPositive
                                ? 'bg-emerald-50 text-status-success'
                                : 'bg-blue-50 text-brand-blue'
                            }`}
                          >
                            {isPositive ? '+฿' : '฿'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-medium text-ink leading-snug truncate">
                              {tx.shopName}
                            </p>
                            <p className="text-[11px] text-ink-muted truncate">
                              {new Date(tx.createdAt).toLocaleDateString('th-TH', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`font-mono text-xs sm:text-sm font-semibold whitespace-nowrap ${
                              isPositive ? 'text-status-success' : 'text-status-error'
                            }`}
                          >
                            {isPositive ? '+' : '-'}฿{tx.citizenPaidAmount.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-brand-blue whitespace-nowrap">
                            {isTopUp
                              ? 'เติมเงินสำเร็จ'
                              : isRefund
                              ? `คืนโควตารัฐ ฿${tx.governmentCopayAmount.toFixed(2)}`
                              : `รัฐช่วย ฿${tx.governmentCopayAmount.toFixed(2)}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ตั้งค่าความปลอดภัย (เปลี่ยน PIN) — วางท้ายหน้าเพื่อไม่ให้เด่นเหนือยอดเงิน */}
            <WalletSecuritySettings />

            {/* Institutional Calm Badge */}
            <section className="flex items-center justify-center space-x-2 py-2 text-[11px] sm:text-xs text-ink-muted text-center">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>ธุรกรรมได้รับการคุ้มครองตามมาตรฐานความปลอดภัย</span>
            </section>
          </div>
        </div>
      </main>

      {/* Modal เติมเงินด่วน (Quick Top-up Modal) */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 backdrop-blur-sm transition-all">
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-card border border-hairline bg-white p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom duration-200">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
            <h3 className="text-base sm:text-lg font-bold text-ink">เติมเงินเข้ากระเป๋า</h3>
            <p className="text-xs text-ink-muted mt-1">
              เลือกหรือระบุจำนวนเงินที่ต้องการเติม
            </p>

            {topUpSuccessMsg ? (
              <div className="my-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center text-status-success font-medium text-sm">
                🎉 {topUpSuccessMsg}
              </div>
            ) : (
              <>
                {/* ช่องกรอกจำนวนเงินเอง */}
                <div className="mt-4">
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">
                    จำนวนเงินที่ต้องการเติม (บาท)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-ink-muted">
                      ฿
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="1"
                      max="100000"
                      value={topUpAmount || ''}
                      onChange={(e) => setTopUpAmount(Math.max(0, Number(e.target.value)))}
                      className="w-full rounded-2xl border border-hairline pl-9 pr-4 py-2.5 font-mono text-xl font-bold text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* ปุ่มเลือกจำนวนเงินสำเร็จรูป */}
                <div className="my-4 grid grid-cols-3 gap-2">
                  {[100, 300, 500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      className={`rounded-pill border py-2.5 text-xs font-semibold font-mono transition ${
                        topUpAmount === amt
                          ? 'border-brand-blue bg-brand-blue-light text-brand-blue ring-1 ring-brand-blue'
                          : 'border-hairline text-ink hover:border-gray-400'
                      }`}
                    >
                      ฿{amt.toLocaleString()}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-hairline pt-4">
                  <button
                    type="button"
                    onClick={() => setShowTopUpModal(false)}
                    className="rounded-pill px-4 py-2.5 sm:py-2 text-xs font-medium text-ink-muted hover:bg-gray-100 transition text-center"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    id="btn-confirm-topup"
                    disabled={topUpMutation.isPending || topUpAmount <= 0}
                    onClick={() => topUpMutation.mutate(topUpAmount)}
                    className="inline-flex items-center justify-center space-x-1.5 rounded-pill bg-brand-blue px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-brand-blue-hover active:scale-95 disabled:opacity-50"
                  >
                    {topUpMutation.isPending ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>กำลังประมวลผล...</span>
                      </>
                    ) : (
                      <span>ยืนยันเติมเงิน ฿{(topUpAmount || 0).toLocaleString()}</span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
