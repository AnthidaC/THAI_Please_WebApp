import React from 'react';
import { ArrowRight, Gift, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import { useAuthStore } from '../../stores/authStore';

export const CitizenHomePage: React.FC = () => {
  const name = useAuthStore((state) => state.user?.name);

  return (
    <div className="min-h-screen bg-surface-soft pb-24 font-sans text-ink md:pb-14">
      <header className="border-b border-hairline bg-white px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-pretty text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            สวัสดี {name || 'คุณ'}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-body sm:text-lg">
            ติดตามภารกิจและสิทธิพิเศษของคุณได้ที่นี่
          </p>
        </div>
      </header>

      <section
        aria-labelledby="citizen-home-actions"
        className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      >
        <h2 id="citizen-home-actions" className="sr-only">ภารกิจและสิทธิพิเศษ</h2>
        <Link
          to={APP_ROUTES.CITIZEN_MISSIONS}
          className="group touch-manipulation flex min-h-28 w-full items-center justify-between gap-4 rounded-card border border-hairline border-l-4 border-l-brand-blue bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/30 active:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 motion-reduce:transition-none sm:p-6"
        >
          <span className="flex min-w-0 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue">
              <Target className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-pretty text-lg font-bold text-ink">ภารกิจของคุณ</span>
              <span className="mt-1 block break-words text-sm leading-relaxed text-ink-body">
                ดูภารกิจที่กำลังเปิดและติดตามความคืบหน้าของคุณ
              </span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-brand-blue">
            <span className="hidden sm:inline">ดูภารกิจ</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
          </span>
        </Link>

        <Link
          to={APP_ROUTES.CITIZEN_REFERRALS}
          className="group touch-manipulation flex min-h-28 w-full items-center justify-between gap-4 rounded-card border border-hairline border-l-4 border-l-emerald-800 bg-white p-5 transition-colors hover:border-emerald-300 hover:bg-emerald-50/30 active:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 motion-reduce:transition-none sm:p-6"
        >
          <span className="flex min-w-0 items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
              <Gift className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-pretty text-lg font-bold text-ink">ชวนเพื่อนรับคูปอง</span>
              <span className="mt-1 block break-words text-sm leading-relaxed text-ink-body">
                แนะนำร้านค้าให้เพื่อน แล้วติดตามสถานะการแนะนำและคูปองของคุณ
              </span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-emerald-800">
            <span className="hidden sm:inline">แนะนำเพื่อน</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
          </span>
        </Link>
      </section>
    </div>
  );
};
