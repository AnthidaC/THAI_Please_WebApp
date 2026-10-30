import React from 'react';
import { ArrowRight, Gift, Target, QrCode, Wallet, Store, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { APP_ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../stores/authStore';
import { getWalletBalance } from '../../services/paymentApi';

const moneyFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});

export const CitizenHomePage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const name = user?.name;

  // ดึงข้อมูลกระเป๋าเงินและโควตารัฐสมทบ Co-pay แบบเบาๆ
  const { data: wallet } = useQuery({
    queryKey: ['citizen-home-wallet', user?.id],
    queryFn: getWalletBalance,
    enabled: Boolean(user?.id),
    staleTime: 30000,
  });

  const balance = wallet?.balance ?? 0;
  const dailyRemaining = wallet?.dailyQuotaRemaining ?? 0;
  const dailyLimit = wallet?.dailyQuotaLimit;
  const dailyLimitLabel = dailyLimit === undefined ? '—' : moneyFormatter.format(dailyLimit);

  return (
    <div className="min-h-screen bg-surface-soft pb-24 font-sans text-ink md:pb-14">
      {/* Header */}
      <header className="border-b border-hairline bg-white px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-pretty text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                สวัสดี {name || 'คุณ'}
              </h1>
              <p className="mt-1 text-sm sm:text-base leading-relaxed text-ink-body">
                ยินดีต้อนรับสู่โครงการไทยช่วยไทยพลีส (Co-pay 60/40)
              </p>
            </div>

            {/* Quick Status Pill */}
            <div className="inline-flex items-center gap-1.5 rounded-pill bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-blue border border-blue-200 self-start sm:self-auto">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" aria-hidden="true" />
              <span>รัฐสมทบ 60% สูงสุด {dailyLimitLabel}/วัน</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        
        {/* สรุปสิทธิ Co-pay วันนี้และกระเป๋าเงิน (Clean & Light Summary Card) */}
        <section aria-label="สรุปสิทธิและยอดเงินกระเป๋า">
          <div className="rounded-card border border-hairline bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-ink-muted">
                  สิทธิประโยชน์และกระเป๋าเงินของคุณ
                </span>
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                  <div>
                    <span className="text-xs text-ink-muted">โควตารัฐช่วยจ่ายวันนี้: </span>
                    <span className="font-mono text-base sm:text-lg font-bold text-ink">
                      {moneyFormatter.format(dailyRemaining)}
                    </span>
                    <span className="text-[11px] text-ink-muted ml-1">(เพดาน {dailyLimitLabel})</span>
                  </div>
                  <div className="text-slate-300 hidden sm:inline" aria-hidden="true">•</div>
                  <div>
                    <span className="text-xs text-ink-muted">ยอดเงินในกระเป๋า: </span>
                    <span className="font-mono text-base sm:text-lg font-bold text-brand-blue">
                      {moneyFormatter.format(balance)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0 pt-2 sm:pt-0 border-t border-slate-100 sm:border-t-0 w-full sm:w-auto justify-end">
                <Link
                  to={APP_ROUTES.CITIZEN_SCAN_COPAY}
                  className="inline-flex items-center space-x-1.5 rounded-pill bg-brand-blue hover:bg-brand-blue-hover text-white px-4 py-2 text-xs sm:text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
                >
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                  <span>สแกนจ่าย</span>
                </Link>
                <Link
                  to={APP_ROUTES.CITIZEN_WALLET}
                  className="inline-flex items-center space-x-1.5 rounded-pill border border-hairline bg-surface-soft hover:bg-slate-100 px-3.5 py-2 text-xs sm:text-sm font-semibold text-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                >
                  <Wallet className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                  <span>กระเป๋าเงิน</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* รายการบริการหลัก 4 รายการ (คงสไตล์เดิม border-l-4 สะอาดตา) */}
        <section aria-label="เมนูบริการโครงการ" className="flex flex-col gap-4">
          
          {/* 1. ภารกิจของคุณ */}
          <Link
            to={APP_ROUTES.CITIZEN_MISSIONS}
            className="group touch-manipulation flex min-h-24 sm:min-h-28 w-full items-center justify-between gap-4 rounded-card border border-hairline border-l-4 border-l-brand-blue bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/30 active:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 motion-reduce:transition-none sm:p-6"
          >
            <span className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue">
                <Target className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-pretty text-base sm:text-lg font-bold text-ink">ภารกิจของคุณ</span>
                <span className="mt-1 block break-words text-xs sm:text-sm leading-relaxed text-ink-body">
                  ดูภารกิจที่กำลังเปิดและติดตามความคืบหน้าเพื่อรับรางวัล
                </span>
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 text-xs sm:text-sm font-bold text-brand-blue">
              <span className="hidden sm:inline">ดูภารกิจ</span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </span>
          </Link>

          {/* 2. ชวนเพื่อนรับคูปอง */}
          <Link
            to={APP_ROUTES.CITIZEN_REFERRALS}
            className="group touch-manipulation flex min-h-24 sm:min-h-28 w-full items-center justify-between gap-4 rounded-card border border-hairline border-l-4 border-l-emerald-800 bg-white p-5 transition-colors hover:border-emerald-300 hover:bg-emerald-50/30 active:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 motion-reduce:transition-none sm:p-6"
          >
            <span className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                <Gift className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-pretty text-base sm:text-lg font-bold text-ink">ชวนเพื่อนรับคูปอง</span>
                <span className="mt-1 block break-words text-xs sm:text-sm leading-relaxed text-ink-body">
                  แนะนำร้านค้าให้เพื่อน แล้วติดตามสถานะการแนะนำและรับคูปองส่วนลด
                </span>
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 text-xs sm:text-sm font-bold text-emerald-800">
              <span className="hidden sm:inline">แนะนำเพื่อน</span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </span>
          </Link>

          {/* 3. รางวัลและคูปองของฉัน */}
          <Link
            to={APP_ROUTES.CITIZEN_REWARDS}
            className="group touch-manipulation flex min-h-24 sm:min-h-28 w-full items-center justify-between gap-4 rounded-card border border-hairline border-l-4 border-l-purple-600 bg-white p-5 transition-colors hover:border-purple-300 hover:bg-purple-50/30 active:bg-purple-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-200 motion-reduce:transition-none sm:p-6"
          >
            <span className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                <Ticket className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-pretty text-base sm:text-lg font-bold text-ink">รางวัลและคูปองของฉัน</span>
                <span className="mt-1 block break-words text-xs sm:text-sm leading-relaxed text-ink-body">
                  ดูคูปองส่วนลดพิเศษที่ได้รับและเลือกใช้งานกับร้านค้าในโครงการ
                </span>
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 text-xs sm:text-sm font-bold text-purple-700">
              <span className="hidden sm:inline">ดูรางวัล</span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </span>
          </Link>

          {/* 4. ร้านค้าใกล้ฉัน */}
          <Link
            to={APP_ROUTES.CITIZEN_NEAR_ME}
            className="group touch-manipulation flex min-h-24 sm:min-h-28 w-full items-center justify-between gap-4 rounded-card border border-hairline border-l-4 border-l-amber-600 bg-white p-5 transition-colors hover:border-amber-300 hover:bg-amber-50/30 active:bg-amber-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 motion-reduce:transition-none sm:p-6"
          >
            <span className="flex min-w-0 items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <Store className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-pretty text-base sm:text-lg font-bold text-ink">ร้านค้าใกล้ฉัน</span>
                <span className="mt-1 block break-words text-xs sm:text-sm leading-relaxed text-ink-body">
                  ค้นหาร้านอาหารและร้านค้าชุมชนที่เข้าร่วมโครงการ Co-pay
                </span>
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 text-xs sm:text-sm font-bold text-amber-700">
              <span className="hidden sm:inline">ค้นหาร้าน</span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </span>
          </Link>

        </section>

      </main>
    </div>
  );
};
