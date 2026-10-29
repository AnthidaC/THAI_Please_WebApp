import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { APP_ROUTES } from '../../../constants/routes';
import { CitizenMissionPortal } from '../../../components/missions/CitizenMissionPortal';

export const CitizenMissionsPage: React.FC = () => (
  <div className="min-h-screen bg-surface-soft pb-28 pt-4 font-sans text-ink md:pb-14">
    <div className="mx-auto max-w-5xl space-y-5 px-3.5 sm:px-6 lg:px-8">
      <header className="flex items-center gap-3 border-b border-hairline/80 pb-4">
        <Link
          to={APP_ROUTES.HOME}
          aria-label="กลับหน้าหลัก"
          className="touch-manipulation inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-pill border border-hairline bg-white px-3 text-xs font-semibold text-ink-body transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">หน้าแรก</span>
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold leading-tight text-ink sm:text-xl">
            ภารกิจของฉัน
          </h1>
          <p className="mt-0.5 truncate text-xs text-ink-muted sm:text-sm">
            ดูภารกิจที่กำลังเปิดและติดตามความคืบหน้าของคุณ
          </p>
        </div>
      </header>

      <CitizenMissionPortal />
    </div>
  </div>
);
