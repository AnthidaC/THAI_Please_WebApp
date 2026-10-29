import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Trophy } from 'lucide-react';
import { getMyBadges } from '../../../services/badgeApi';
import { APP_ROUTES } from '../../../constants/routes';
import { BadgeProgressCard } from '../../../components/badges/BadgeProgressCard';

const numberFormat = new Intl.NumberFormat('th-TH');

export const CitizenAchievementsPage: React.FC = () => {
  const { data: badges, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['my-badges'],
    queryFn: getMyBadges,
  });

  const list = badges ?? [];

  return (
    <div className="min-h-screen bg-surface-soft pb-28 pt-4 font-sans text-ink md:pb-14">
      <div className="mx-auto max-w-5xl space-y-5 px-3.5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 border-b border-hairline/80 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              to={APP_ROUTES.PROFILE}
              aria-label="กลับไปยังโปรไฟล์"
              className="touch-manipulation inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-pill border border-hairline bg-white px-3 text-xs font-semibold text-ink-body transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">โปรไฟล์</span>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold leading-tight text-ink sm:text-xl">เหรียญตราของฉัน</h1>
              <p className="mt-0.5 truncate text-xs text-ink-muted sm:text-sm">
                ติดตามความคืบหน้าและเหรียญตราที่ได้รับ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            aria-label="โหลดข้อมูลเหรียญตราใหม่"
            title="รีเฟรชเหรียญตรา"
            className="touch-manipulation inline-flex min-h-10 shrink-0 items-center gap-2 rounded-pill border border-hairline bg-white px-3 text-xs font-semibold text-ink-body transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
            <span className="hidden xs:inline">รีเฟรช</span>
          </button>
        </header>

        {isLoading && (
          <div role="status" aria-live="polite" className="space-y-4">
            <span className="sr-only">กำลังโหลดเหรียญตรา…</span>
            <div className="grid gap-4 lg:grid-cols-2">
              {[0, 1].map((index) => (
                <div key={index} className="h-64 animate-pulse rounded-3xl border border-hairline bg-white motion-reduce:animate-none" />
              ))}
            </div>
          </div>
        )}

        {isError && (
          <div role="alert" className="rounded-3xl border border-rose-200 bg-white p-6 text-center sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
              <Trophy className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-base font-bold text-ink">โหลดเหรียญตราไม่สำเร็จ</h2>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink-muted">
              ตรวจสอบการเชื่อมต่อแล้วลองโหลดข้อมูลอีกครั้ง
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="touch-manipulation mt-5 inline-flex min-h-11 items-center justify-center rounded-pill bg-brand-blue px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {!isLoading && !isError && list.length === 0 && (
          <div className="rounded-3xl border border-hairline bg-white p-6 text-center sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Trophy className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-base font-bold text-ink">ยังไม่มีเหรียญตราให้สะสม</h2>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink-muted">
              เมื่อมีเหรียญตราเปิดให้สะสม ความคืบหน้าของคุณจะแสดงที่นี่
            </p>
            <Link
              to={APP_ROUTES.PROFILE}
              className="touch-manipulation mt-5 inline-flex min-h-11 items-center justify-center rounded-pill border border-hairline px-5 text-sm font-semibold text-ink-body transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            >
              กลับไปยังโปรไฟล์
            </Link>
          </div>
        )}

        {!isLoading && !isError && list.length > 0 && (
          <>
            <section aria-labelledby="badge-list-heading" className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 id="badge-list-heading" className="text-lg font-bold text-ink sm:text-xl">คลังเหรียญตรา</h2>
                  <p className="mt-1 text-xs text-ink-muted sm:text-sm">ดูความคืบหน้าและเกณฑ์ของแต่ละระดับ</p>
                </div>
                <span className="shrink-0 rounded-pill border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-ink-body">
                  {numberFormat.format(list.length)} เหรียญตรา
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {list.map((badge) => (
                  <BadgeProgressCard key={badge.id} badge={badge} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
