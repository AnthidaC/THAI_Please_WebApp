import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Gift,
  Target,
  QrCode,
  Wallet,
  Store,
  Ticket,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../stores/authStore';
import { getWalletBalance } from '../../services/paymentApi';
import { getMyMissions } from '../../services/missionApi';
import { getMyRewards } from '../../services/rewardApi';

const moneyFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});

const thaiDateFormatter = new Intl.DateTimeFormat('th-TH', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export const CitizenHomePage: React.FC = () => {
  const name = useAuthStore((state) => state.user?.name);

  // 1. ดึงข้อมูลกระเป๋าเงินและโควตารัฐสมทบ Co-pay
  const { data: wallet, isLoading: isWalletLoading } = useQuery({
    queryKey: ['citizen-home-wallet'],
    queryFn: getWalletBalance,
    staleTime: 15000,
  });

  // 2. ดึงข้อมูลภารกิจที่กำลังทำอยู่ (Missions)
  const { data: missions } = useQuery({
    queryKey: ['citizen-home-missions'],
    queryFn: getMyMissions,
    staleTime: 30000,
  });

  // 3. ดึงรางวัล/คูปองที่มีอยู่ (Rewards)
  const { data: rewards } = useQuery({
    queryKey: ['citizen-home-rewards'],
    queryFn: getMyRewards,
    staleTime: 30000,
  });

  const todayThaiText = thaiDateFormatter.format(new Date());

  // คำนวณโควตา
  const balance = wallet?.balance ?? 3836;
  const dailyRemaining = wallet?.dailyQuotaRemaining ?? 78;
  const dailyLimit = wallet?.dailyQuotaLimit ?? 150;
  const totalRemaining = wallet?.totalQuotaRemaining ?? 2754;
  const dailyPercent = Math.min(100, Math.max(0, Math.round(((dailyLimit - dailyRemaining) / dailyLimit) * 100)));

  // กรองภารกิจที่ยังไม่เสร็จ (กำลังดำเนินการ) แสดง 2 รายการแรก
  const activeMissions = missions?.slice(0, 3) ?? [];
  const availableRewardsCount = rewards?.filter((r) => r.status === 'available').length ?? 1;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-24 font-sans text-ink md:pb-16">
      
      {/* 1. Header Greeting */}
      <header className="border-b border-hairline bg-white px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-brand-blue border border-blue-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" aria-hidden="true" />
                  <span>โครงการไทยช่วยไทยพลีส (Co-pay 60/40)</span>
                </span>
                <span className="text-xs text-ink-muted">
                  • {todayThaiText}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
                สวัสดีคุณ {name || 'ประชาชน'}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-ink-muted leading-relaxed">
                รัฐร่วมสมทบ 60% สูงสุด 150 บาทต่อวัน เพื่อลดภาระค่าครองชีพและสนับสนุนร้านค้าในชุมชน
              </p>
            </div>

            {/* Quick Balance Tag */}
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <Link
                to={APP_ROUTES.CITIZEN_WALLET}
                className="inline-flex items-center space-x-2 rounded-pill bg-slate-100 hover:bg-slate-200/80 px-3.5 py-1.5 text-xs font-semibold text-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
              >
                <Wallet className="h-3.5 w-3.5 text-brand-blue" />
                <span>กระเป๋าเงิน:</span>
                <span className="font-mono font-bold text-brand-blue">
                  {isWalletLoading ? '...' : moneyFormatter.format(balance)}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6 sm:space-y-8">
        
        {/* ========================================================= */}
        {/* 2. CO-PAY QUOTA & WALLET HERO CARD */}
        {/* ========================================================= */}
        <section aria-label="สิทธิประโยชน์โครงการ Co-pay วันนี้">
          <div className="rounded-card bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
            {/* Background Accent Graphics */}
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute right-1/4 -bottom-20 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              
              {/* Left Column: Balance & Today Quota */}
              <div className="space-y-4 max-w-xl">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold tracking-wide text-blue-300 uppercase">
                    สิทธิประโยชน์ร่วมจ่าย 60/40 วันนี้
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    เปิดใช้งาน
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Daily Quota */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                    <span className="text-xs text-slate-300 block">โควตารัฐช่วยจ่ายคงเหลือวันนี้</span>
                    <div className="font-mono text-2xl sm:text-3xl font-black text-white mt-1">
                      {isWalletLoading ? (
                        <span className="inline-block h-8 w-24 bg-white/20 rounded animate-pulse" />
                      ) : (
                        moneyFormatter.format(dailyRemaining)
                      )}
                    </div>
                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                        <span>ใช้ไปแล้ว {dailyLimit - dailyRemaining} บ.</span>
                        <span>เพดาน {dailyLimit} บ./วัน</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${dailyPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Wallet Balance */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10 flex flex-col justify-between">
                    <div>
                      <span className="text-xs text-slate-300 block">ยอดเงินในกระเป๋าของคุณ</span>
                      <div className="font-mono text-2xl sm:text-3xl font-black text-white mt-1">
                        {isWalletLoading ? (
                          <span className="inline-block h-8 w-24 bg-white/20 rounded animate-pulse" />
                        ) : (
                          moneyFormatter.format(balance)
                        )}
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
                      <span>โควตารวมทั้งโครงการ:</span>
                      <span className="font-mono font-semibold text-blue-200">
                        {moneyFormatter.format(totalRemaining)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Primary CTA Buttons */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 lg:min-w-[220px]">
                <Link
                  to={APP_ROUTES.CITIZEN_SCAN_COPAY}
                  className="inline-flex items-center justify-center space-x-2.5 rounded-pill bg-brand-blue hover:bg-blue-600 text-white px-6 py-3.5 text-sm font-bold transition shadow-lg shadow-blue-500/25 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <QrCode className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  <span>สแกนจ่าย Co-pay</span>
                </Link>

                <Link
                  to={APP_ROUTES.CITIZEN_WALLET}
                  className="inline-flex items-center justify-center space-x-2 rounded-pill bg-white/10 hover:bg-white/15 text-white border border-white/20 px-5 py-3 text-xs sm:text-sm font-semibold transition backdrop-blur-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Wallet className="h-4 w-4 text-blue-300" />
                  <span>จัดการกระเป๋าเงิน & เติมเงิน</span>
                </Link>
              </div>

            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 3. FOUR SERVICE SHORTCUTS */}
        {/* ========================================================= */}
        <section aria-label="เมนูบริการสำหรับประชาชน" className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
          
          {/* Service 1: สแกนจ่าย Co-pay */}
          <Link
            to={APP_ROUTES.CITIZEN_SCAN_COPAY}
            className="rounded-card border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-blue-300 transition group flex flex-col justify-between"
          >
            <div>
              <div className="h-11 w-11 rounded-2xl bg-brand-blue text-white flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition-transform">
                <QrCode className="h-5 w-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-ink">สแกนจ่าย Co-pay</h3>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed hidden sm:block">
                สแกน Dynamic QR หน้าร้านเพื่อรับส่วนลดรัฐ 60% ทันที
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-brand-blue">
              <span>สแกนทันที</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Service 2: ร้านค้าใกล้ฉัน */}
          <Link
            to={APP_ROUTES.CITIZEN_NEAR_ME}
            className="rounded-card border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-emerald-300 transition group flex flex-col justify-between"
          >
            <div>
              <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Store className="h-5 w-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-ink">ร้านค้าใกล้ฉัน</h3>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed hidden sm:block">
                ค้นหาร้านอาหารและของชำชุมชนที่เข้าร่วมโครงการ
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
              <span>ค้นหาร้าน</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Service 3: ภารกิจสะสมแต้ม */}
          <Link
            to={APP_ROUTES.CITIZEN_MISSIONS}
            className="rounded-card border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-blue-300 transition group flex flex-col justify-between"
          >
            <div>
              <div className="h-11 w-11 rounded-2xl bg-blue-50 text-brand-blue flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Target className="h-5 w-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-ink">ภารกิจของคุณ</h3>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed hidden sm:block">
                ทำภารกิจช้อปปิ้งเพื่อรับส่วนลดและเหรียญรางวัล
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-brand-blue">
              <span>ดูภารกิจ</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Service 4: คูปองและสิทธิพิเศษ */}
          <Link
            to={APP_ROUTES.CITIZEN_REWARDS}
            className="rounded-card border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-purple-300 transition group flex flex-col justify-between"
          >
            <div>
              <div className="h-11 w-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Ticket className="h-5 w-5" />
              </div>
              <div className="flex items-center space-x-1.5">
                <h3 className="text-sm sm:text-base font-bold text-ink">คูปองรางวัล</h3>
                {availableRewardsCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-purple-600" />
                )}
              </div>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed hidden sm:block">
                ใช้คูปองส่วนลดพิเศษที่ได้รับจากภารกิจ
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-purple-700">
              <span>{availableRewardsCount} คูปองพร้อมใช้</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

        </section>

        {/* ========================================================= */}
        {/* 4. ONGOING MISSIONS PREVIEW & REFERRAL SECTION */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Active Missions Preview (2 columns on lg) */}
          <section aria-labelledby="heading-active-missions" className="lg:col-span-2 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-brand-blue" />
                <h2 id="heading-active-missions" className="text-base font-bold text-ink">
                  ภารกิจที่กำลังเปิดรับ (Ongoing Missions)
                </h2>
              </div>
              <Link
                to={APP_ROUTES.CITIZEN_MISSIONS}
                className="text-xs font-semibold text-brand-blue hover:underline flex items-center space-x-1"
              >
                <span>ดูทั้งหมด</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {activeMissions.length > 0 ? (
                activeMissions.map((mission) => {
                  const progress = mission.progress ?? 0;
                  const target = mission.targetValue || 1;
                  const pct = Math.min(100, Math.round((progress / target) * 100));

                  return (
                    <div
                      key={mission.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-slate-300 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[11px] font-semibold text-brand-blue bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60 inline-block mb-1">
                            {mission.rewardName || 'รางวัลส่วนลด'}
                          </span>
                          <h3 className="text-sm font-bold text-ink truncate">{mission.name}</h3>
                          {mission.description && (
                            <p className="text-xs text-ink-muted mt-0.5 line-clamp-1">
                              {mission.description}
                            </p>
                          )}
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-700 shrink-0">
                          {progress} / {target}
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3">
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-blue rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-ink-muted">
                  ยังไม่มีภารกิจใหม่ในขณะนี้
                </div>
              )}
            </div>
          </section>

          {/* Referral & Rewards Spotlight (1 column on lg) */}
          <section aria-labelledby="heading-referrals-spotlight" className="space-y-3.5">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h2 id="heading-referrals-spotlight" className="text-base font-bold text-ink">
                สิทธิพิเศษชวนเพื่อน
              </h2>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/30 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3">
                  <Gift className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-ink">ชวนเพื่อนรับคูปองส่วนลด</h3>
                <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">
                  แนะนำร้านค้าและชวนเพื่อนเข้าร่วมโครงการไทยช่วยไทยพลีส รับคูปองส่วนลดสูงสุด ฿40 ต่อการแนะนำ
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-emerald-100">
                <Link
                  to={APP_ROUTES.CITIZEN_REFERRALS}
                  className="w-full inline-flex items-center justify-center space-x-1.5 rounded-pill bg-emerald-800 hover:bg-emerald-900 text-white px-4 py-2 text-xs font-semibold transition shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                >
                  <span>แชร์ลิงก์ชวนเพื่อน</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </section>

        </div>

        {/* ========================================================= */}
        {/* 5. TRUST & POLICY FOOTER NOTE */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-ink-muted">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              โครงการร่วมจ่าย Co-pay 60/40 โดยความร่วมมือของกระทรวงการคลังและร้านค้าชุมชน
            </span>
          </div>
          <span className="font-medium text-slate-500">
            ระบบความปลอดภัย GPS Geofence 2 กม.
          </span>
        </div>

      </main>
    </div>
  );
};
