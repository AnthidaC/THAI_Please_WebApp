import React from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet,
  QrCode,
  ArrowRight,
  Sparkles,
  Gift,
} from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';
import { CitizenMissionPortal } from '../../components/missions/CitizenMissionPortal';

export const HomePage: React.FC = () => {
  return (
    <div className="min-h-[85vh] bg-surface-soft py-6 md:py-8 px-4 pb-24 md:pb-12 font-sans text-ink">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="rounded-card border border-hairline bg-white p-8 shadow-sm text-center">
          <div className="inline-flex items-center space-x-1.5 rounded-pill bg-brand-blue-light px-3 py-1 text-xs font-semibold text-brand-blue border border-blue-200 mb-4">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>แพลตฟอร์มดิจิทัลกระตุ้นเศรษฐกิจฐานราก</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-ink">
            ไทยช่วยไทยพลีส (THAI Please)
          </h1>
          <p className="mt-3 text-sm text-ink-body max-w-xl mx-auto leading-relaxed">
            ระบบกระเป๋าเงินดิจิทัล ชำระเงินร่วม (Co-pay 60/40) สแกน Dynamic QR หน้าร้าน
            พร้อมระบบตรวจจับการทุจริตพิกัด GPS & Semi-AI Anomaly Engine มาตรฐานสากล
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to={APP_ROUTES.CITIZEN_WALLET}
              className="touch-manipulation inline-flex items-center space-x-2 rounded-pill bg-brand-blue px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-blue-hover active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              <span>เข้าสู่กระเป๋าเงิน (Citizen Wallet)</span>
              <ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" />
            </Link>
            <Link
              to={APP_ROUTES.CITIZEN_SCAN_COPAY}
              className="touch-manipulation inline-flex items-center space-x-2 rounded-pill border border-hairline bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 motion-reduce:transition-none"
            >
              <QrCode className="h-4 w-4 text-brand-blue" aria-hidden="true" />
              <span>สแกนชำระเงินร่วม (Co-pay 60/40)</span>
            </Link>
          </div>
        </div>

        <CitizenMissionPortal />

        <section aria-labelledby="citizen-activities-heading">
          <div className="mb-4">
            <h2 id="citizen-activities-heading" className="text-base font-bold text-ink">
              สิทธิพิเศษจากการแนะนำ
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              ติดตามการแนะนำร้านค้าและคูปองของคุณที่นี่
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <article className="flex w-full flex-col justify-between rounded-card border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-800 text-white">
                  <Gift className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-pretty text-base font-bold leading-snug text-ink">
                    ชวนเพื่อนรับคูปอง
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-body">
                    แนะนำร้านค้าให้เพื่อน แล้วติดตามสถานะการแนะนำและคูปองของคุณ
                  </p>
                </div>
              </div>
              <Link
                to={APP_ROUTES.CITIZEN_REFERRALS}
                className="touch-manipulation mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 motion-reduce:transition-none"
              >
                <Gift className="h-4 w-4" aria-hidden="true" />
                <span>แนะนำเพื่อน</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          </div>
        </section>

      </div>
    </div>
  );
};
