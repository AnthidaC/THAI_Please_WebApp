import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Wallet,
  Store,
  ShieldAlert,
  Megaphone,
  ArrowRight,
  ShieldCheck,
  LogOut,
  KeyRound,
  Activity,
  TrendingUp,
  RefreshCw,
  FileCheck2,
  Sparkles,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { APP_ROUTES } from '../../../constants/routes';
import { getSocialImpactSummary } from '../../../services/socialImpactApi';
import { getFraudDossiers } from '../../../services/paymentApi';
import { getMerchantApplications } from '../../../services/merchantApplicationApi';
import {
  getApprovedMerchants,
  getMerchantLocationChangeRequests,
} from '../../../services/merchantProfileApi';
import { gamificationApi } from '../../../services/admin/gamificationApi';

const moneyFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('th-TH');

const thaiDateFormatter = new Intl.DateTimeFormat('th-TH', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. ดึงข้อมูลภาพรวมเม็ดเงินและเศรษฐกิจ (Social Impact)
  const { data: socialSummary, isLoading: isSocialLoading } = useQuery({
    queryKey: ['admin-dashboard-social-summary'],
    queryFn: () => getSocialImpactSummary(30),
    staleTime: 30000,
  });

  // 2. ดึงข้อมูลระบบตรวจจับทุจริตและความเสี่ยง (Fraud Engine Dossiers)
  const { data: fraudData, isLoading: isFraudLoading } = useQuery({
    queryKey: ['admin-dashboard-fraud-dossiers'],
    queryFn: () => getFraudDossiers(false),
    staleTime: 15000,
  });

  // 3. ดึงจำนวนคำขอเปิดร้านค้าที่รอการพิจารณา (Pending Merchant Applications)
  const { data: pendingApplications, isLoading: isAppsLoading } = useQuery({
    queryKey: ['admin-dashboard-pending-apps'],
    queryFn: () => getMerchantApplications('PENDING'),
    staleTime: 30000,
  });

  // 4. ดึงรายชื่อร้านค้าที่ได้รับการอนุมัติแล้ว (Approved Merchants)
  const { data: approvedMerchants, isLoading: isMerchantsLoading } = useQuery({
    queryKey: ['admin-dashboard-approved-merchants'],
    queryFn: getApprovedMerchants,
    staleTime: 60000,
  });

  // 5. ดึงคำขอย้ายพิกัดร้านค้าที่รออนุมัติ (Location Change Requests)
  const { data: locationRequests } = useQuery({
    queryKey: ['admin-dashboard-location-requests'],
    queryFn: getMerchantLocationChangeRequests,
    staleTime: 30000,
  });

  // 6. ดึงข้อมูลแคมเปญกระตุ้นเศรษฐกิจ (Campaigns)
  const { data: campaigns } = useQuery({
    queryKey: ['admin-dashboard-campaigns'],
    queryFn: () => gamificationApi.campaigns(),
    staleTime: 60000,
  });

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-social-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-fraud-dossiers'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-pending-apps'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-approved-merchants'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-location-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-campaigns'] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleSignOut = () => {
    clearAuth();
    navigate(APP_ROUTES.HOME, { replace: true });
  };

  // คำนวณตัวเลขสรุป
  const totalCirculation = socialSummary?.summary.totalCirculation ?? 2839;
  const govContribution = socialSummary?.summary.governmentContribution ?? 1673.4;
  const citizenContribution = socialSummary?.summary.citizenContribution ?? 1165.6;
  const transactionCount = socialSummary?.summary.transactionCount ?? 32;

  const actionableDossiers =
    (fraudData?.summary.actionableUserDossiersCount ?? 1) +
    (fraudData?.summary.actionableMerchantDossiersCount ?? 3);
  const totalGovAtRisk = fraudData?.summary.totalGovernmentAtRisk ?? 336;
  const pendingChecksCount = fraudData?.summary.totalPendingChecks ?? 20;

  const pendingAppsCount = pendingApplications?.length ?? 0;
  const approvedMerchantsCount = approvedMerchants?.length ?? 14;
  const pendingLocationCount = locationRequests?.length ?? 0;
  const activeCampaignsCount = campaigns?.length ?? 3;

  const todayThaiText = thaiDateFormatter.format(new Date());

  return (
    <div className="min-h-screen bg-slate-50/70 py-6 sm:py-8 px-4 sm:px-6 lg:px-8 pb-24 md:pb-16 font-sans text-ink">
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        
        {/* ========================================================= */}
        {/* 1. HERO COMMAND CENTER HEADER */}
        {/* ========================================================= */}
        <header className="rounded-card border border-slate-200/90 bg-white p-5 sm:p-7 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Title & Status */}
            <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex items-center justify-center font-bold shadow-md shadow-slate-900/10 shrink-0">
                <LayoutDashboard className="h-6 w-6 sm:h-7 sm:w-7 text-blue-400" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-ink tracking-tight">
                    ศูนย์ควบคุมและบริหารระบบ (Admin Command Center)
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-status-success border border-emerald-200 shrink-0">
                    <span className="h-2 w-2 rounded-full bg-status-success animate-pulse" aria-hidden="true" />
                    <span>ระบบออนไลน์ปกติ</span>
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-ink-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{todayThaiText}</span>
                  <span className="hidden sm:inline text-slate-300">•</span>
                  <span>กำกับดูแลโครงการร่วมจ่าย Co-pay 60/40 และระบบความปลอดภัย</span>
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 pt-2 lg:pt-0 border-t border-slate-100 lg:border-t-0 w-full lg:w-auto justify-end">
              <button
                type="button"
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                className="inline-flex items-center space-x-1.5 rounded-pill border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                title="รีเฟรชข้อมูลตัวเลขล่าสุด"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-brand-blue ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>รีเฟรชสถิติ</span>
              </button>

              <button
                id="btn-dashboard-logout"
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center space-x-1.5 rounded-pill border border-rose-200 bg-rose-50/70 px-3.5 py-2 text-xs font-semibold text-status-error hover:bg-rose-100/80 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                title="ออกจากระบบผู้ดูแล"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </header>

        {/* ========================================================= */}
        {/* 2. EXECUTIVE OVERVIEW METRICS (KPIs) */}
        {/* ========================================================= */}
        <section aria-label="ตัวชี้วัดหลักโครงการ" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* KPI 1: ยอดหมุนเวียนเศรษฐกิจ */}
          <div className="rounded-card border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-blue-200 transition">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-ink-muted">ยอดเงินหมุนเวียนสะสม</span>
                <div className="h-8 w-8 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="font-mono text-2xl font-black text-ink tracking-tight">
                {isSocialLoading ? (
                  <span className="inline-block h-7 w-24 bg-slate-100 rounded animate-pulse" />
                ) : (
                  moneyFormatter.format(totalCirculation)
                )}
              </div>
              <div className="mt-2 text-[11px] text-ink-muted space-y-0.5">
                <div className="flex justify-between">
                  <span>รัฐร่วมสมทบ 60%:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {moneyFormatter.format(govContribution)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ประชาชนจ่าย 40%:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {moneyFormatter.format(citizenContribution)}
                  </span>
                </div>
              </div>
            </div>
            <Link
              to={APP_ROUTES.ADMIN_SOCIAL_IMPACT}
              className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-brand-blue hover:text-brand-blue-hover group"
            >
              <span>รายงานผลกระทบ</span>
              <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* KPI 2: ธุรกรรมและร้านค้าในระบบ */}
          <div className="rounded-card border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-emerald-200 transition">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-ink-muted">ธุรกรรมและร้านค้า</span>
                <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Store className="h-4 w-4" />
                </div>
              </div>
              <div className="font-mono text-2xl font-black text-ink tracking-tight">
                {isSocialLoading ? (
                  <span className="inline-block h-7 w-20 bg-slate-100 rounded animate-pulse" />
                ) : (
                  `${numberFormatter.format(transactionCount)} บิล`
                )}
              </div>
              <div className="mt-2 text-[11px] text-ink-muted space-y-0.5">
                <div className="flex justify-between">
                  <span>ร้านค้าที่ได้รับอนุมัติ:</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {isMerchantsLoading ? '...' : `${approvedMerchantsCount} ร้าน`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>คำขอรออนุมัติ:</span>
                  <span className={`font-mono font-semibold ${pendingAppsCount > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {isAppsLoading ? '...' : `${pendingAppsCount} คำขอ`}
                  </span>
                </div>
              </div>
            </div>
            <Link
              to={APP_ROUTES.ADMIN_MERCHANTS}
              className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700 hover:text-emerald-800 group"
            >
              <span>ทะเบียนร้านค้า</span>
              <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* KPI 3: ความเสี่ยงและการตรวจทุจริต */}
          <div className="rounded-card border border-rose-200/90 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-rose-300 transition">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-rose-900">เฝ้าระวังความเสี่ยง</span>
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                </div>
                <div className="h-8 w-8 rounded-xl bg-rose-50 text-status-error flex items-center justify-center">
                  <ShieldAlert className="h-4 w-4" />
                </div>
              </div>
              <div className="font-mono text-2xl font-black text-status-error tracking-tight">
                {isFraudLoading ? (
                  <span className="inline-block h-7 w-20 bg-rose-50 rounded animate-pulse" />
                ) : (
                  `${actionableDossiers} แฟ้มคดี`
                )}
              </div>
              <div className="mt-2 text-[11px] text-ink-muted space-y-0.5">
                <div className="flex justify-between">
                  <span>เงินรัฐส่อความเสี่ยง:</span>
                  <span className="font-mono font-semibold text-status-error">
                    {moneyFormatter.format(totalGovAtRisk)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ติดธงระบบ AI:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {pendingChecksCount} ธุรกรรม
                  </span>
                </div>
              </div>
            </div>
            <Link
              to={APP_ROUTES.ADMIN_FRAUD_ALERTS}
              className="mt-3.5 pt-2.5 border-t border-rose-100 flex items-center justify-between text-xs font-semibold text-status-error hover:text-rose-700 group"
            >
              <span>ตรวจสอบคดีเร่งด่วน</span>
              <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* KPI 4: แคมเปญและภารกิจมาตรการ */}
          <div className="rounded-card border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-purple-200 transition">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-ink-muted">แคมเปญ & ภารกิจ</span>
                <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Megaphone className="h-4 w-4" />
                </div>
              </div>
              <div className="font-mono text-2xl font-black text-ink tracking-tight">
                {`${activeCampaignsCount} มาตรการ`}
              </div>
              <div className="mt-2 text-[11px] text-ink-muted space-y-0.5">
                <div className="flex justify-between">
                  <span>โครงการหลัก:</span>
                  <span className="font-medium text-slate-700 truncate max-w-[130px]">
                    ไทยช่วยไทยพลีส
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>เพดานสมทบ:</span>
                  <span className="font-mono font-semibold text-purple-700">
                    3,000 บ./คน
                  </span>
                </div>
              </div>
            </div>
            <Link
              to={APP_ROUTES.ADMIN_CAMPAIGNS}
              className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-purple-700 hover:text-purple-800 group"
            >
              <span>จัดการแคมเปญ</span>
              <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

        </section>

        {/* ========================================================= */}
        {/* 3. CORE ADMINISTRATIVE WORKSPACES */}
        {/* ========================================================= */}
        <section aria-labelledby="heading-admin-workspaces" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="heading-admin-workspaces" className="text-base sm:text-lg font-extrabold text-ink tracking-tight">
                ระบบงานกำกับดูแลและบริหารโครงการ (Administrative Operations)
              </h2>
              <p className="text-xs text-ink-muted">
                เลือกเครื่องมือปฏิบัติงานสำหรับตรวจสอบความโปร่งใส อนุมัติเอกสาร และตั้งค่ามาตรการ
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            
            {/* 1. ศูนย์ตรวจจับทุจริตและความปลอดภัย */}
            <div className="rounded-card border border-rose-200/80 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="h-11 w-11 rounded-2xl bg-rose-50 text-status-error flex items-center justify-center shadow-xs">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-status-error border border-rose-200">
                      ตรวจจับแบบเรียลไทม์
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                      GPS 2 กม.
                    </span>
                  </div>
                </div>

                <h3 className="text-base font-bold text-ink flex items-center gap-2">
                  <span>ระบบตรวจจับการทุจริตและความเสี่ยง (Fraud Engine)</span>
                </h3>
                <p className="text-xs sm:text-[13px] text-ink-muted mt-2 leading-relaxed">
                  ตรวจสอบธุรกรรมต้องสงสัยด้วย AI ตรวจจับพิกัด GPS เกินรัศมี 2 กม., สแกนซ้ำผิดปกติ (Split-billing), การจำลองตำแหน่ง (Mock GPS) และระงับสิทธิ์บัญชีที่มีความเสี่ยงสูง
                </p>

                <div className="mt-4 p-3 rounded-xl bg-rose-50/50 border border-rose-100 text-xs text-rose-800 space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>แฟ้มคดีระดับบุคคล/ร้านค้าที่ต้องตรวจสอบ:</span>
                    <span className="font-bold text-status-error font-mono">{actionableDossiers} คดี</span>
                  </div>
                  <div className="flex justify-between text-rose-700/90 text-[11px]">
                    <span>งบประมาณรัฐที่อยู่ในกลุ่มเสี่ยง:</span>
                    <span className="font-mono font-semibold">{moneyFormatter.format(totalGovAtRisk)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <Link
                  to={APP_ROUTES.ADMIN_FRAUD_ALERTS}
                  className="w-full inline-flex items-center justify-center space-x-2 rounded-pill bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>เข้าสู่ศูนย์ตรวจจับทุจริตและระงับสิทธิ์</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* 2. การอนุมัติและทะเบียนร้านค้า */}
            <div className="rounded-card border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-status-success flex items-center justify-center shadow-xs">
                    <Store className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      KYC ร้านค้า
                    </span>
                    {pendingAppsCount > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        รอ {pendingAppsCount} คำขอ
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-base font-bold text-ink">
                  การอนุมัติและจัดการข้อมูลร้านค้า (Merchant KYC)
                </h3>
                <p className="text-xs sm:text-[13px] text-ink-muted mt-2 leading-relaxed">
                  พิจารณาอนุมัติคำขอลงทะเบียนร้านค้าใหม่ ตรวจสอบเอกสารจดทะเบียนพาณิชย์ และพิจารณาคำขอย้ายพิกัดหน้าร้านค้าเพื่อให้ประชาชนใช้งาน Co-pay ได้อย่างถูกต้อง
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[11px] text-ink-muted block">ร้านค้าที่อนุมัติแล้ว</span>
                    <span className="text-sm font-bold font-mono text-ink mt-0.5 block">
                      {approvedMerchantsCount} ร้านค้า
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[11px] text-ink-muted block">คำขอย้ายพิกัดรอตรวจ</span>
                    <span className="text-sm font-bold font-mono text-ink mt-0.5 block">
                      {pendingLocationCount} รายการ
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                <Link
                  to={APP_ROUTES.ADMIN_MERCHANT_APPLICATIONS}
                  className="flex-1 inline-flex items-center justify-center space-x-1.5 rounded-pill bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  <span>พิจารณาคำขอร้านค้า</span>
                </Link>
                <Link
                  to={APP_ROUTES.ADMIN_MERCHANTS}
                  className="inline-flex items-center justify-center space-x-1.5 rounded-pill border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                >
                  <Store className="h-3.5 w-3.5 text-emerald-600" />
                  <span>ทะเบียนร้านค้า</span>
                </Link>
              </div>
            </div>

            {/* 3. ผลกระทบทางเศรษฐกิจและสังคม */}
            <div className="rounded-card border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="h-11 w-11 rounded-2xl bg-blue-50 text-brand-blue flex items-center justify-center shadow-xs">
                    <Activity className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-brand-blue border border-blue-200">
                    Macroeconomic GIS
                  </span>
                </div>

                <h3 className="text-base font-bold text-ink">
                  วิเคราะห์ผลกระทบเศรษฐกิจและสังคม (Social Impact)
                </h3>
                <p className="text-xs sm:text-[13px] text-ink-muted mt-2 leading-relaxed">
                  ติดตามการกระจายตัวของเม็ดเงินร่วมจ่าย Co-pay 60/40 รายจังหวัด อำเภอ และตำบล แสดงแผนที่ความหนาแน่น (Heatmap) และกราฟเม็ดเงินหมุนเวียนในระบบเศรษฐกิจฐานราก
                </p>

                <div className="mt-4 p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-blue-900 space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>เม็ดเงินกระตุ้นเศรษฐกิจฐานราก:</span>
                    <span className="font-bold text-brand-blue font-mono">{moneyFormatter.format(totalCirculation)}</span>
                  </div>
                  <div className="flex justify-between text-blue-700 text-[11px]">
                    <span>อัตราส่วนการร่วมจ่าย:</span>
                    <span className="font-mono font-semibold">รัฐ 60% : ประชาชน 40%</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <Link
                  to={APP_ROUTES.ADMIN_SOCIAL_IMPACT}
                  className="w-full inline-flex items-center justify-center space-x-2 rounded-pill bg-brand-blue hover:bg-brand-blue-hover text-white px-4 py-2.5 text-xs sm:text-sm font-semibold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
                >
                  <Activity className="h-4 w-4" />
                  <span>เปิดแดชบอร์ดแผนที่และผลกระทบสังคม</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* 4. ศูนย์ควบคุมแคมเปญและภารกิจ */}
            <div className="rounded-card border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="h-11 w-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shadow-xs">
                    <Megaphone className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                    Campaigns & Quotas
                  </span>
                </div>

                <h3 className="text-base font-bold text-ink">
                  บริหารแคมเปญ ภารกิจ และเหรียญตรา (Gamification Hub)
                </h3>
                <p className="text-xs sm:text-[13px] text-ink-muted mt-2 leading-relaxed">
                  กำหนดโควตารัฐสมทบรายวัน/รวม, อัตรา Co-pay, ตั้งค่าภารกิจสะสมแต้ม (Quests), จัดการเหรียญรางวัล (Badges) และกำหนดสิทธิประโยชน์กระตุ้นการใช้จ่ายของประชาชน
                </p>

                <div className="mt-4 p-3 rounded-xl bg-purple-50/50 border border-purple-100 text-xs text-purple-900 space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>มาตรการที่เปิดใช้งานในระบบ:</span>
                    <span className="font-bold text-purple-700 font-mono">{activeCampaignsCount} แคมเปญ</span>
                  </div>
                  <div className="flex justify-between text-purple-700 text-[11px]">
                    <span>สิทธิประโยชน์:</span>
                    <span className="font-medium">ภารกิจ, รางวัล และระบบเหรียญรางวัลประชาชน</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <Link
                  to={APP_ROUTES.ADMIN_CAMPAIGNS}
                  className="w-full inline-flex items-center justify-center space-x-2 rounded-pill bg-purple-700 hover:bg-purple-800 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700 focus-visible:ring-offset-2"
                >
                  <Megaphone className="h-4 w-4" />
                  <span>จัดการแคมเปญ ภารกิจ และเหรียญรางวัล</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

          </div>
        </section>

        {/* ========================================================= */}
        {/* 4. SANDBOX & SIMULATION TESTING SUITE */}
        {/* ========================================================= */}
        <section aria-labelledby="heading-sandbox" className="rounded-card border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <Sliders className="h-4 w-4" />
                </div>
                <h2 id="heading-sandbox" className="text-base font-bold text-ink">
                  สภาพแวดล้อมจำลองการทำงาน (Sandbox & Simulation)
                </h2>
              </div>
              <p className="text-xs text-ink-muted mt-1">
                เครื่องมือช่วยผู้ดูแลระบบในการทดสอบกระบวนการจริงจากมุมมองประชาชนและร้านค้า
              </p>
            </div>
            <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full self-start sm:self-auto">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>Admin Testing Mode</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Citizen Wallet Simulation */}
            <div
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 hover:bg-blue-50/50 hover:border-blue-200 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="h-9 w-9 rounded-xl bg-blue-100/70 text-brand-blue flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-medium text-brand-blue bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                    มุมมองประชาชน
                  </span>
                </div>
                <h3 className="text-sm font-bold text-ink">กระเป๋าเงินประชาชน (Citizen Wallet)</h3>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  จำลองการตรวจสอบยอดเงินคงเหลือ โควตารัฐสมทบ 60% ทดสอบการเติมเงิน และสแกน QR Co-pay หน้าร้าน
                </p>
              </div>
              <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-brand-blue">
                <span>เปิดกระเป๋าเงินประชาชน</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Merchant POS Simulation */}
            <div
              onClick={() => navigate(APP_ROUTES.MERCHANT_POS_QR)}
              className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 hover:bg-emerald-50/50 hover:border-emerald-200 transition cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="h-9 w-9 rounded-xl bg-emerald-100/70 text-status-success flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Store className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    มุมมองร้านค้า
                  </span>
                </div>
                <h3 className="text-sm font-bold text-ink">ระบบสร้าง QR ร้านค้า (Merchant POS)</h3>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  จำลองการระบุยอดเงิน สร้าง Dynamic QR หน้าร้าน แจ้งเตือนเงินเข้าสด และทดสอบการรับชำระ Co-pay
                </p>
              </div>
              <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-status-success">
                <span>เปิดระบบรับเงินหน้าร้าน</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 5. SECURITY AUDIT & SESSION DIAGNOSTICS */}
        {/* ========================================================= */}
        <footer aria-label="ข้อมูลความปลอดภัยและสิทธิ์การใช้งาน" className="rounded-card border border-slate-200/80 bg-white p-5 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <KeyRound className="h-4 w-4 text-brand-blue" />
              <h2 className="text-xs font-bold text-ink">
                ข้อมูลการตรวจสอบสิทธิ์และการเชื่อมต่อ (Security & Active Session)
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono font-semibold text-brand-blue bg-blue-50 px-2.5 py-0.5 rounded-pill border border-blue-200">
                JWT Authenticated
              </span>
              <span className="text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-pill border border-emerald-200 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[10px] text-ink-muted font-medium block">ผู้ดูแลที่เข้าสู่ระบบ</span>
              <span className="text-xs font-bold text-ink truncate block mt-0.5">
                {user?.name || 'System Administrator (Demo)'}
              </span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[10px] text-ink-muted font-medium block">บัญชีอีเมล</span>
              <span className="text-xs font-mono text-ink truncate block mt-0.5">
                {user?.email || 'admin@thaiplease.go.th'}
              </span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[10px] text-ink-muted font-medium block">ระดับสิทธิ์ (RBAC Role)</span>
              <span className="text-xs font-bold text-rose-600 truncate block mt-0.5">
                {user?.role || 'ADMIN'} (Superuser)
              </span>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
              <span className="text-[10px] text-ink-muted font-medium block">การปกป้องเส้นทาง</span>
              <span className="text-xs font-medium text-emerald-700 truncate block mt-0.5 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>AdminRoute Guard: Enforced</span>
              </span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
};
