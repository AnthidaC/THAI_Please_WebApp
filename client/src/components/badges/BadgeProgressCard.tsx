import React from 'react';
import { Award, Check, Lock, Trophy } from 'lucide-react';
import type { CitizenBadge, CitizenBadgeTier } from '../../services/badgeApi';

const CONDITION_LABEL: Record<string, string> = {
  transaction_count: 'จำนวนธุรกรรมที่ชำระสำเร็จ',
  referral_count: 'จำนวนคำชวนเพื่อนที่สำเร็จ',
  review_count: 'จำนวนรีวิวร้านค้า',
  total_spending: 'ยอดใช้จ่ายสะสม',
};

const numberFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Bangkok',
});

const formatValue = (conditionType: string, value: number): string => {
  const formatted = numberFormat.format(value);
  return conditionType === 'total_spending' ? `${formatted} บาท` : formatted;
};

const formatEarnedAt = (iso: string): string => dateFormat.format(new Date(iso));

const progressPercent = (progress: number, required: number): number => {
  if (required <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress / required) * 100)));
};

const hasReachedTier = (progress: number | null, tier: CitizenBadgeTier): boolean =>
  progress !== null && progress >= tier.requiredCount;

interface BadgeProgressCardProps {
  badge: CitizenBadge;
}

export const BadgeProgressCard: React.FC<BadgeProgressCardProps> = ({ badge }) => {
  const conditionLabel = badge.conditionDisplayName || CONDITION_LABEL[badge.conditionType] || 'เงื่อนไขความสำเร็จ';
  const progress = badge.progress;
  const target = badge.nextTier;
  const targetReached = target ? hasReachedTier(progress, target) : false;
  const percent = progress !== null && target
    ? progressPercent(progress, target.requiredCount)
    : progress !== null && badge.isMaxTier
      ? 100
      : 0;

  const statusLabel = badge.isMaxTier
    ? 'ครบทุกระดับ'
    : badge.currentTier
      ? `ได้รับระดับ ${badge.currentTier.name}`
      : progress === null
        ? 'ข้อมูลไม่พร้อม'
        : targetReached && target
          ? `ถึงเกณฑ์ ${target.name}`
          : 'กำลังสะสม';
  const statusClass = badge.isMaxTier
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : badge.currentTier
      ? 'border-blue-200 bg-blue-50 text-blue-800'
      : targetReached
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-hairline bg-surface-soft text-ink-muted';

  return (
    <article className="rounded-3xl border border-hairline bg-white p-4 shadow-2xs sm:p-5">
      <div className="flex items-start gap-3.5">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${badge.isUnlocked ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-blue-100 bg-blue-50 text-brand-blue'}`}>
          {badge.iconUrl ? (
            <img src={badge.iconUrl} alt="" width={56} height={56} loading="lazy" className="h-full w-full object-cover" />
          ) : badge.isUnlocked ? (
            <Award className="h-7 w-7" aria-hidden="true" />
          ) : (
            <Trophy className="h-6 w-6" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 flex-1 text-base font-bold leading-snug text-ink [overflow-wrap:anywhere]">{badge.name}</h3>
            <span className={`rounded-pill border px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted [overflow-wrap:anywhere]">
            {badge.description || conditionLabel}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-surface-soft p-3.5 sm:p-4">
        {progress === null ? (
          <p className="text-sm leading-relaxed text-ink-muted">
            ยังไม่สามารถคำนวณความคืบหน้าของเงื่อนไขนี้ได้ในขณะนี้
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-medium leading-relaxed text-ink-muted">{conditionLabel}</p>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                {formatValue(badge.conditionType, progress)}
              </p>
            </div>

            <div
              role="progressbar"
              aria-label={`ความคืบหน้า ${badge.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-valuetext={target
                ? `${conditionLabel}: ${formatValue(badge.conditionType, progress)} จากเกณฑ์ ${target.name} ${formatValue(badge.conditionType, target.requiredCount)}${targetReached ? ' ถึงเกณฑ์แล้ว' : ''}`
                : badge.isMaxTier ? 'ครบทุกระดับแล้ว' : 'ยังไม่มีเกณฑ์ระดับถัดไป'}
              className="mt-2.5 h-2.5 w-full overflow-hidden rounded-pill bg-hairline"
            >
              <div
                className={`h-full rounded-pill transition-[width] duration-300 motion-reduce:transition-none ${badge.isMaxTier ? 'bg-status-success' : targetReached ? 'bg-amber-500' : 'bg-brand-blue'}`}
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
              {target ? (
                <span className="text-ink-muted">
                  เกณฑ์ {target.name}: {formatValue(badge.conditionType, target.requiredCount)}
                </span>
              ) : (
                <span className="text-ink-muted">{badge.isMaxTier ? 'ครบทุกระดับแล้ว' : 'ยังไม่มีระดับถัดไป'}</span>
              )}
              {target && (
                <span className={`font-semibold ${targetReached ? 'text-amber-800' : 'text-brand-blue'}`}>
                  {targetReached
                    ? `ถึงเกณฑ์ ${target.name} แล้ว`
                    : `อีก ${formatValue(badge.conditionType, Math.max(0, target.requiredCount - progress))}`}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-semibold text-ink-body">ระดับเหรียญตรา</h4>
        <ol className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {badge.tiers.map((tier) => {
            const reached = hasReachedTier(progress, tier);
            const stateLabel = tier.unlocked ? 'ได้รับแล้ว' : reached ? 'ถึงเกณฑ์แล้ว แต่ยังไม่ได้รับ' : 'ยังไม่ถึงเกณฑ์';
            const tierClass = tier.unlocked
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : reached
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-hairline bg-white text-ink-muted';

            return (
              <li
                key={tier.id}
                aria-label={`ระดับ ${tier.name}, ${formatValue(badge.conditionType, tier.requiredCount)}: ${stateLabel}`}
                className={`min-w-0 rounded-xl border px-2.5 py-2 ${tierClass}`}
              >
                <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                  {tier.unlocked ? (
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : reached ? (
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">{tier.name}</span>
                </div>
                <p className="mt-1 truncate pl-5 text-[11px] tabular-nums">
                  {formatValue(badge.conditionType, tier.requiredCount)}
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      {badge.currentTier?.earnedAt && (
        <p className="mt-4 flex items-center gap-1.5 border-t border-hairline pt-3 text-xs text-ink-muted">
          <Check className="h-3.5 w-3.5 text-status-success" aria-hidden="true" />
          <span>
            ได้รับระดับ {badge.currentTier.name} เมื่อ{' '}
            <time dateTime={badge.currentTier.earnedAt}>{formatEarnedAt(badge.currentTier.earnedAt)}</time>
          </span>
        </p>
      )}
    </article>
  );
};
