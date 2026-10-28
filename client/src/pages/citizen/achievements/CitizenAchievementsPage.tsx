import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Trophy } from 'lucide-react';
import { getMyBadges } from '../../../services/badgeApi';
import { APP_ROUTES } from '../../../constants/routes';
import { BadgeProgressCard } from '../../../components/badges/BadgeProgressCard';

export const CitizenAchievementsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: badges, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['my-badges'],
    queryFn: getMyBadges,
  });

  const list = badges ?? [];
  const unlockedCount = list.filter((badge) => badge.isUnlocked).length;
  const maxTierCount = list.filter((badge) => badge.isMaxTier).length;

  return (
    <div className="min-h-screen bg-surface-soft pb-24 font-sans text-ink md:pb-12">
      <div className="mb-3.5 border-b border-hairline bg-white px-3.5 py-3 shadow-2xs sm:mb-5 sm:px-6 sm:py-3.5 lg:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center space-x-2.5">
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="flex shrink-0 items-center space-x-1.5 rounded-pill border border-hairline bg-surface-soft px-2.5 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-gray-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">กลับกระเป๋าเงิน</span>
            </button>
            <div className="min-w-0 border-l border-hairline pl-2.5 sm:pl-3">
              <h1 className="truncate text-sm font-bold text-ink sm:text-base">เหรียญตราของฉัน</h1>
              <p className="truncate text-[11px] font-medium text-brand-blue sm:text-xs">
                สะสมความคืบหน้าจากการช้อป รีวิว และคำชวนเพื่อน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex shrink-0 items-center space-x-1.5 rounded-pill border border-hairline bg-surface-soft px-2.5 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-gray-200 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 sm:px-3.5"
            aria-label="โหลดข้อมูลเหรียญตราใหม่"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-3.5 sm:px-6 lg:px-8">
        {!isLoading && !isError && list.length > 0 && (
          <div className="mb-3.5 grid grid-cols-2 gap-3 sm:mb-5">
            <div className="rounded-2xl border border-hairline bg-white px-4 py-3">
              <p className="text-[11px] font-medium text-ink-muted">ปลดล็อกแล้ว</p>
              <p className="mt-0.5 font-mono text-xl font-semibold text-ink">
                {unlockedCount}
                <span className="ml-1 text-xs font-normal text-ink-muted">/ {list.length} เหรียญตรา</span>
              </p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white px-4 py-3">
              <p className="text-[11px] font-medium text-ink-muted">ถึงระดับสูงสุด</p>
              <p className="mt-0.5 font-mono text-xl font-semibold text-status-success">
                {maxTierCount}
                <span className="ml-1 text-xs font-normal text-ink-muted">เหรียญตรา</span>
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <div role="status" aria-live="polite" className="space-y-3">
            <span className="sr-only">กำลังโหลดเหรียญตรา</span>
            {[0, 1].map((index) => (
              <div key={index} className="h-36 animate-pulse rounded-2xl border border-hairline bg-white motion-reduce:animate-none" />
            ))}
          </div>
        )}

        {isError && (
          <div role="alert" className="rounded-2xl border border-hairline bg-white p-5 text-center">
            <p className="text-sm font-semibold text-ink">โหลดเหรียญตราไม่สำเร็จ</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              กรุณาลองใหม่อีกครั้ง หากยังไม่หายโปรดตรวจสอบการเชื่อมต่อระบบ
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-pill bg-brand-blue px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-blue-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {!isLoading && !isError && list.length === 0 && (
          <div className="rounded-2xl border border-hairline bg-white p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue-light text-brand-blue">
              <Trophy className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-semibold text-ink">ยังไม่มีเหรียญตราที่เปิดใช้งาน</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              เมื่อผู้ดูแลระบบเปิดใช้งานเหรียญตรา ความคืบหน้าของคุณจะแสดงที่นี่
            </p>
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.CITIZEN_TRANSACTIONS)}
              className="mt-3 rounded-pill border border-hairline px-4 py-2 text-xs font-semibold text-ink transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            >
              ดูประวัติธุรกรรม
            </button>
          </div>
        )}

        {!isLoading && !isError && list.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((badge) => (
              <BadgeProgressCard key={badge.id} badge={badge} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
