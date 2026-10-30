import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, Gift, RefreshCw, Ticket } from 'lucide-react';
import { APP_ROUTES } from '../../../constants/routes';
import { getMyRewards } from '../../../services/rewardApi';

const numberFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
const bahtFormat = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat('th-TH', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'Asia/Bangkok',
});

export const CitizenRewardsPage: React.FC = () => {
  const {
    data: rewards,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['my-rewards'],
    queryFn: getMyRewards,
    staleTime: 0,
  });

  const rewardList = rewards ?? [];
  const availableRewardCount = rewardList.filter((reward) =>
    reward.status === 'available' &&
    (!reward.expiresAt || new Date(reward.expiresAt).getTime() > Date.now())
  ).length;

  return (
    <div className="min-h-screen bg-surface-soft pb-28 pt-4 font-sans text-ink md:pb-14">
      <div className="mx-auto max-w-5xl space-y-5 px-3.5 sm:px-6 lg:px-8">
        <header className="flex items-center gap-3 border-b border-hairline/80 pb-4">
          <Link
            to={APP_ROUTES.PROFILE}
            aria-label="กลับไปหน้าโปรไฟล์"
            className="touch-manipulation inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-pill border border-hairline bg-white px-3 text-xs font-semibold text-ink-body transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">โปรไฟล์</span>
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight text-ink sm:text-xl">รางวัลของฉัน</h1>
            <p className="mt-0.5 text-xs text-ink-muted sm:text-sm">
              ดูคูปอง รหัสรางวัล และสถานะการใช้งานของคุณ
            </p>
          </div>
        </header>

        <section
          aria-label="สรุปรางวัลของฉัน"
          aria-busy={isLoading}
          className="overflow-hidden rounded-2xl border border-emerald-700 bg-emerald-800 text-white shadow-sm"
        >
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <Gift className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-100">สิทธิ์ที่คุณได้รับ</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {isLoading || isError ? '—' : numberFormat.format(rewardList.length)}
                  <span className="ml-2 text-sm font-medium text-emerald-100">รายการทั้งหมด</span>
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 sm:min-w-44">
              <p className="text-xs font-medium text-emerald-100">พร้อมใช้</p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {isLoading || isError ? '—' : numberFormat.format(availableRewardCount)}
                <span className="ml-1.5 text-sm font-medium text-emerald-100">รายการ</span>
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="reward-list-heading" aria-busy={isLoading}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="reward-list-heading" className="text-base font-bold text-ink sm:text-lg">
              คูปองและรางวัลทั้งหมด
            </h2>
            {!isLoading && !isError && (
              <span className="text-xs text-ink-muted">
                {numberFormat.format(rewardList.length)} รายการ
              </span>
            )}
          </div>

          {isLoading ? (
            <p role="status" aria-live="polite" className="rounded-xl border border-hairline bg-white px-4 py-6 text-center text-sm text-ink-muted">
              กำลังโหลดรางวัล…
            </p>
          ) : isError ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-white px-4 py-6 text-center">
              <p className="text-sm font-semibold text-rose-800">โหลดรางวัลไม่สำเร็จ</p>
              <p className="mt-1 text-sm text-ink-muted">ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง</p>
              <button
                type="button"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-hairline bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
                {isFetching ? 'กำลังโหลด…' : 'ลองอีกครั้ง'}
              </button>
            </div>
          ) : rewardList.length > 0 ? (
            <ul className="space-y-3">
              {rewardList.map((reward) => {
                const isUsed = reward.status === 'used';
                const isExpired = reward.status === 'expired' || Boolean(
                  reward.expiresAt && new Date(reward.expiresAt).getTime() <= Date.now()
                );
                const isAvailable = reward.status === 'available' && !isExpired;
                const statusLabel = isAvailable
                  ? 'พร้อมใช้'
                  : isUsed
                  ? 'ใช้แล้ว'
                  : isExpired
                  ? 'หมดอายุ'
                  : 'ไม่พร้อมใช้';
                const statusClass = isAvailable
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : isExpired
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-hairline bg-surface-soft text-ink-muted';
                const discountLabel = reward.discountValue === null ||
                  (reward.discountType !== 'percent' && reward.discountType !== 'fixed')
                  ? null
                  : reward.discountType === 'percent'
                  ? `${numberFormat.format(reward.discountValue)}%`
                  : bahtFormat.format(reward.discountValue);

                return (
                  <li key={reward.userRewardId} className="overflow-hidden rounded-2xl border border-hairline bg-white">
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isAvailable ? 'bg-emerald-50 text-emerald-800' : 'bg-surface-soft text-ink-muted'}`}>
                          <Ticket className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-semibold text-ink sm:text-base">{reward.rewardName}</h3>
                          <p className="mt-1 break-all font-mono text-xs text-ink-muted" translate="no">
                            รหัส {reward.rewardCode}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3 sm:justify-end sm:border-t-0 sm:pt-0">
                        {discountLabel && (
                          <span className="font-semibold tabular-nums text-emerald-800">{discountLabel}</span>
                        )}
                        <span className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                          <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
                          {statusLabel}
                        </span>
                        {reward.expiresAt && (
                          <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            ใช้ได้ถึง {dateFormat.format(new Date(reward.expiresAt))}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div role="status" className="rounded-2xl border border-dashed border-emerald-200 bg-white px-5 py-8 text-center">
              <Gift className="mx-auto h-8 w-8 text-emerald-700" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-ink">ยังไม่มีรางวัลที่ได้รับ</p>
              <p className="mt-1 text-sm text-ink-muted">ทำภารกิจเพื่อรับรางวัลและคูปองจากร้านค้า</p>
              <Link
                to={APP_ROUTES.CITIZEN_MISSIONS}
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-blue-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 motion-reduce:transition-none"
              >
                ดูภารกิจ
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
