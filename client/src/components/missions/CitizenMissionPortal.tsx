import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { getMyMissions } from '../../services/missionApi';
import {
  CalendarClock,
  Check,
  CircleHelp,
  Gift,
  RefreshCw,
  Target,
} from 'lucide-react';

const numberFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
const bahtFormat = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 2,
});
const dateFormat = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Bangkok',
});

const formatValue = (value: number, conditionType: string) =>
  conditionType === 'total_spending' ? bahtFormat.format(value) : numberFormat.format(value);

export const CitizenMissionPortal: React.FC = () => {
  const isCitizen = useAuthStore((state) => state.isAuthenticated && state.user?.role === 'USER');
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['citizenMissions'],
    queryFn: getMyMissions,
    enabled: isCitizen,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const conditionFilter = searchParams.get('condition') ?? 'all';
  const missions = data ?? [];
  const conditionOptions = useMemo(() => {
    const options = new Map<string, string>();
    missions.forEach((mission) => options.set(mission.conditionType, mission.conditionDisplayName));
    if (!options.has('referral_count')) {
      options.set('referral_count', 'จำนวนผู้ใช้ที่แนะนำ');
    }
    return Array.from(options.entries());
  }, [missions]);
  const updateConditionFilter = (condition: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (condition === 'all') next.delete('condition');
      else next.set('condition', condition);
      return next;
    }, { replace: true });
  };
  const filteredMissions = useMemo(
    () => conditionFilter === 'all'
      ? missions
      : missions.filter((mission) => mission.conditionType === conditionFilter),
    [conditionFilter, missions]
  );

  if (!isCitizen) return null;

  return (
    <section
      aria-labelledby="citizen-missions-heading"
      aria-busy={isLoading}
      className="overflow-hidden rounded-card border border-blue-100 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue">
            <Target className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="citizen-missions-heading" className="text-base font-bold text-ink">
              ภารกิจที่กำลังเปิด
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              ติดตามความคืบหน้าจากกิจกรรมในช่วงเวลาของแต่ละภารกิจ
            </p>
          </div>
        </div>
        {!isLoading && !isError && missions.length > 0 && (
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-blue">
            {numberFormat.format(missions.length)} ภารกิจที่เปิดอยู่
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <p role="status" aria-live="polite" className="rounded-xl bg-surface-soft px-4 py-6 text-center text-sm text-ink-muted">
            กำลังโหลดภารกิจ…
          </p>
        ) : isError ? (
          <div role="status" aria-live="polite" className="rounded-xl bg-rose-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-rose-800">โหลดภารกิจไม่สำเร็จ</p>
            <p className="mt-1 text-sm text-rose-700">ตรวจสอบการเชื่อมต่อ แล้วลองโหลดอีกครั้ง</p>
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-800 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none"
            >
              <RefreshCw className={'h-4 w-4 ' + (isFetching ? 'animate-spin motion-reduce:animate-none' : '')} aria-hidden="true" />
              {isFetching ? 'กำลังโหลด…' : 'ลองอีกครั้ง'}
            </button>
          </div>
        ) : missions.length === 0 ? (
          <div role="status" aria-live="polite" className="rounded-xl bg-surface-soft px-4 py-6 text-center">
            <CircleHelp className="mx-auto h-6 w-6 text-ink-muted" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-ink">ยังไม่มีภารกิจที่เปิดอยู่</p>
            <p className="mt-1 text-sm text-ink-muted">ภารกิจใหม่จะแสดงที่นี่เมื่อเริ่มกิจกรรม</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <label htmlFor="mission-condition-filter" className="block w-full space-y-1.5 sm:max-w-sm">
                <span className="block text-sm font-semibold text-ink">กรองตามประเภทภารกิจ</span>
                <select
                  id="mission-condition-filter"
                  name="missionCondition"
                  value={conditionFilter}
                  onChange={(event) => updateConditionFilter(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                >
                  <option value="all">ทุกประเภท</option>
                  {conditionOptions.map(([conditionType, displayName]) => (
                    <option key={conditionType} value={conditionType}>{displayName}</option>
                  ))}
                </select>
              </label>
              <p role="status" aria-live="polite" className="text-xs text-ink-muted">
                แสดง {numberFormat.format(filteredMissions.length)} จาก {numberFormat.format(missions.length)} ภารกิจ
              </p>
            </div>

            {filteredMissions.length === 0 ? (
              <div role="status" aria-live="polite" className="rounded-xl bg-surface-soft px-4 py-6 text-center">
                <p className="text-sm text-ink-muted">ไม่พบภารกิจประเภทนี้</p>
                <button
                  type="button"
                  onClick={() => updateConditionFilter('all')}
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-brand-blue hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                >
                  แสดงทุกภารกิจ
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredMissions.map((mission) => {
                  const isComplete = mission.progress !== null && mission.progress >= mission.targetValue;
                  const progressRatio = mission.progress === null || mission.targetValue <= 0
                    ? 0
                    : Math.min(1, Math.max(0, mission.progress / mission.targetValue));
                  const progressPercent = Math.round(progressRatio * 100);

                  return (
                    <article key={mission.id} className="flex min-w-0 flex-col rounded-2xl border border-hairline bg-white p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          {mission.campaignName && (
                            <p className="mb-1 truncate text-xs font-medium text-ink-muted">{mission.campaignName}</p>
                          )}
                          <h3 className="break-words text-sm font-bold leading-snug text-ink">{mission.name}</h3>
                        </div>
                        <span className={
                          'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ' +
                          (isComplete ? 'bg-emerald-50 text-emerald-800' : 'bg-blue-50 text-brand-blue')
                        }>
                          {isComplete && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                          {isComplete ? 'สำเร็จแล้ว' : 'กำลังดำเนินการ'}
                        </span>
                      </div>

                      {mission.description && (
                        <p className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-ink-body">
                          {mission.description}
                        </p>
                      )}

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                          <span className="font-medium text-ink-muted">{mission.conditionDisplayName}</span>
                          {mission.progress !== null ? (
                            <span className="shrink-0 font-semibold tabular-nums text-ink">
                              {formatValue(mission.progress, mission.conditionType)} / {formatValue(mission.targetValue, mission.conditionType)}
                            </span>
                          ) : (
                            <span className="shrink-0 text-ink-muted">ยังคำนวณไม่ได้</span>
                          )}
                        </div>
                        {mission.progress !== null ? (
                          <div
                            role="progressbar"
                            aria-label={mission.name + ': ' + mission.conditionDisplayName}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progressPercent}
                            aria-valuetext={formatValue(mission.progress, mission.conditionType) + ' จาก ' + formatValue(mission.targetValue, mission.conditionType)}
                            className="h-2 overflow-hidden rounded-full bg-blue-50"
                          >
                            <div
                              className={'h-full origin-left rounded-full transition-transform motion-reduce:transition-none ' + (isComplete ? 'bg-emerald-500' : 'bg-brand-blue')}
                              style={{ transform: 'scaleX(' + progressRatio + ')' }}
                            />
                          </div>
                        ) : (
                          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                            ระบบยังไม่สามารถคำนวณความคืบหน้าของภารกิจนี้ได้
                          </p>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-hairline pt-3 text-xs">
                        {mission.rewardName ? (
                          <span className="inline-flex min-w-0 items-center gap-1.5 text-ink-body">
                            <Gift className="h-3.5 w-3.5 shrink-0 text-brand-blue" aria-hidden="true" />
                            <span className="break-words">{mission.rewardName}</span>
                          </span>
                        ) : <span />}
                        <span className="inline-flex shrink-0 items-center gap-1.5 text-ink-muted">
                          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                          ถึง {dateFormat.format(new Date(mission.endsAt))}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
