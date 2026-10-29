import React from 'react';
import { Award, Check, Lock, Trophy } from 'lucide-react';
import type { CitizenBadge } from '../../services/badgeApi';

const CONDITION_LABEL: Record<string, string> = {
  transaction_count: 'จำนวนธุรกรรมที่ชำระสำเร็จ',
  referral_count: 'จำนวนคำชวนเพื่อนที่สำเร็จ',
  review_count: 'จำนวนรีวิวร้านค้า',
  total_spending: 'ยอดใช้จ่ายสะสม',
};

const formatValue = (conditionType: string, value: number): string => {
  if (conditionType === 'total_spending') {
    return `${value.toLocaleString('th-TH', { maximumFractionDigits: 2 })} บาท`;
  }
  return value.toLocaleString('th-TH');
};

const formatEarnedAt = (iso: string): string =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });

const progressPercent = (progress: number, required: number): number => {
  if (required <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress / required) * 100)));
};

interface BadgeProgressCardProps {
  badge: CitizenBadge;
}

export const BadgeProgressCard: React.FC<BadgeProgressCardProps> = ({ badge }) => {
  const conditionLabel = badge.conditionDisplayName || CONDITION_LABEL[badge.conditionType] || 'เงื่อนไขความสำเร็จ';
  const progress = badge.progress;
  const target = badge.nextTier;
  const percent = progress !== null && target
    ? progressPercent(progress, target.requiredCount)
    : progress !== null && badge.isMaxTier
      ? 100
      : 0;

  return (
    <article className="rounded-2xl border border-hairline bg-white p-4 shadow-2xs sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-blue-light text-brand-blue">
          {badge.iconUrl ? (
            <img src={badge.iconUrl} alt="" width={44} height={44} loading="lazy" className="h-full w-full object-cover" />
          ) : badge.isUnlocked ? (
            <Award className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Trophy className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="truncate text-sm font-bold text-ink">{badge.name}</h2>
            {badge.currentTier && (
              <span className="rounded-pill bg-brand-blue px-2.5 py-0.5 text-[11px] font-semibold text-white">
                {badge.currentTier.name}
              </span>
            )}
            {badge.isMaxTier && (
              <span className="rounded-pill bg-status-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-status-success">
                ครบทุกระดับ
              </span>
            )}
            {!badge.isUnlocked && (
              <span className="inline-flex items-center gap-1 rounded-pill border border-hairline px-2.5 py-0.5 text-[11px] font-medium text-ink-muted">
                <Lock className="h-3 w-3" aria-hidden="true" />
                ยังไม่ปลดล็อก
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {badge.description || conditionLabel}
          </p>
        </div>
      </div>

      {progress === null ? (
        <p className="mt-3 rounded-xl bg-surface-soft px-3 py-2 text-[11px] text-ink-muted">
          ยังไม่สามารถคำนวณความคืบหน้าของเงื่อนไขนี้ได้ในขณะนี้
        </p>
      ) : (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2 text-[11px] text-ink-muted">
            <span>{conditionLabel}</span>
            <span className="font-mono font-semibold text-ink">
              {formatValue(badge.conditionType, progress)}
              {target ? ` / ${formatValue(badge.conditionType, target.requiredCount)}` : ''}
            </span>
          </div>

          <div
            role="progressbar"
            aria-label={`ความคืบหน้า ${badge.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={
              target
                ? `${formatValue(badge.conditionType, progress)} จาก ${formatValue(badge.conditionType, target.requiredCount)}`
                : 'ครบทุกระดับแล้ว'
            }
            className="mt-1.5 h-2 w-full overflow-hidden rounded-pill bg-hairline-soft"
          >
            <div
              className={`h-full rounded-pill transition-[width] duration-300 motion-reduce:transition-none ${
                badge.isMaxTier ? 'bg-status-success' : 'bg-brand-blue'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>

          <p className="mt-1.5 text-[11px] text-ink-muted">
            {target
              ? `อีก ${formatValue(badge.conditionType, Math.max(0, target.requiredCount - progress))} ก็ถึงระดับ ${target.name}`
              : 'คุณปลดล็อกระดับสูงสุดของเหรียญตรานี้แล้ว'}
          </p>
        </div>
      )}

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {badge.tiers.map((tier) => (
          <li
            key={tier.id}
            className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-[11px] font-medium ${
              tier.unlocked
                ? 'border-brand-blue/30 bg-brand-blue-light text-brand-blue'
                : 'border-hairline text-ink-muted'
            }`}
          >
            {tier.unlocked ? (
              <Check className="h-3 w-3" aria-hidden="true" />
            ) : (
              <Lock className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{tier.name}</span>
            <span className="font-mono">{formatValue(badge.conditionType, tier.requiredCount)}</span>
          </li>
        ))}
      </ul>

      {badge.currentTier?.earnedAt && (
        <p className="mt-2 text-[11px] text-ink-muted">
          ได้รับระดับ {badge.currentTier.name} เมื่อ{' '}
          <time dateTime={badge.currentTier.earnedAt}>{formatEarnedAt(badge.currentTier.earnedAt)}</time>
        </p>
      )}
    </article>
  );
};
