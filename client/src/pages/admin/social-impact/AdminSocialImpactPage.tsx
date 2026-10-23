import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  Banknote,
  Clock3,
  MapPinned,
  RefreshCw,
  Users,
} from 'lucide-react';
import { SocialImpactHeatmap } from '../../../components/admin/SocialImpactHeatmap';
import {
  getSocialImpactHeatmap,
  getSocialImpactSummary,
  SocialImpactRange,
  SocialImpactTimelinePoint,
} from '../../../services/socialImpactApi';

const RANGES: Array<{ days: SocialImpactRange; label: string }> = [
  { days: 7, label: '7 วัน' },
  { days: 30, label: '30 วัน' },
  { days: 90, label: '90 วัน' },
  { days: 365, label: '1 ปี' },
];

const money = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});

const dateLabel = (date: string, days: number): string =>
  new Intl.DateTimeFormat('th-TH', days <= 7
    ? { weekday: 'short', day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short' }).format(new Date(date));

const errorMessage = (error: unknown): string => {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? 'ไม่สามารถเชื่อมต่อระบบได้';
  }
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
};

const ImpactChart: React.FC<{ points: SocialImpactTimelinePoint[]; days: number }> = ({ points, days }) => {
  if (points.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-ink-muted">ยังไม่มีธุรกรรมที่ชำระสำเร็จในช่วงเวลานี้</div>;
  }

  const width = 760;
  const height = 260;
  const padding = { top: 18, right: 18, bottom: 42, left: 68 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...points.map((point) => point.totalCirculation), 1);
  const coordinates = points.map((point, index) => ({
    x: padding.left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth),
    y: padding.top + chartHeight - (point.totalCirculation / maxValue) * chartHeight,
    point,
  }));
  const line = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');
  const area = `${padding.left},${padding.top + chartHeight} ${line} ${padding.left + chartWidth},${padding.top + chartHeight}`;
  const labelIndexes = points.length <= 7
    ? points.map((_, index) => index)
    : [0, Math.floor((points.length - 1) / 3), Math.floor(((points.length - 1) * 2) / 3), points.length - 1];

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-[600px] w-full" role="img" aria-label="กราฟยอดเงินหมุนเวียนรายวัน">
        {[0, 1, 2, 3, 4].map((tick) => {
          const y = padding.top + chartHeight - (tick / 4) * chartHeight;
          const value = (maxValue * tick) / 4;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="#64748b" fontSize="10">
                {value >= 1000 ? `${(value / 1000).toFixed(0)}k` : Math.round(value)}
              </text>
            </g>
          );
        })}
        <polygon points={area} fill="url(#impact-area)" />
        <defs>
          <linearGradient id="impact-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0052ff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0052ff" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <polyline points={line} fill="none" stroke="#0052ff" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {coordinates.map(({ x, y, point }) => (
          <circle key={point.date} cx={x} cy={y} r="4" fill="#ffffff" stroke="#0052ff" strokeWidth="2">
            <title>{`${dateLabel(point.date, days)}: ${money.format(point.totalCirculation)} · ${point.transactionCount} รายการ`}</title>
          </circle>
        ))}
        {labelIndexes.map((index) => {
          const { x, point } = coordinates[index];
          return (
            <text key={point.date} x={x} y={height - 14} textAnchor="middle" fill="#64748b" fontSize="10">
              {dateLabel(point.date, days)}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex items-center justify-center gap-2 text-xs text-ink-muted">
        <span className="h-2.5 w-2.5 rounded-full bg-brand-blue" /> เงินหมุนเวียนจากธุรกรรมชำระแล้ว
      </div>
    </div>
  );
};

export const AdminSocialImpactPage: React.FC = () => {
  const [days, setDays] = useState<SocialImpactRange>(30);
  const summaryQuery = useQuery({
    queryKey: ['admin-social-impact-summary', days],
    queryFn: () => getSocialImpactSummary(days),
    refetchInterval: 15000,
  });
  const heatmapQuery = useQuery({
    queryKey: ['admin-social-impact-heatmap', days],
    queryFn: () => getSocialImpactHeatmap(days),
    refetchInterval: 15000,
  });
  const summary = summaryQuery.data?.summary;
  const lastUpdated = summaryQuery.data?.refreshedAt
    ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(summaryQuery.data.refreshedAt))
    : null;

  const cards = [
    { label: 'เงินหมุนเวียนรวม', value: money.format(summary?.totalCirculation ?? 0), detail: 'ยอดชำระรวมจากธุรกรรมที่สำเร็จ', icon: Banknote, color: 'bg-blue-50 text-brand-blue' },
    { label: 'ภาครัฐร่วมจ่าย', value: money.format(summary?.governmentContribution ?? 0), detail: 'เงินสนับสนุนจากภาครัฐ', icon: Activity, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'ประชาชนร่วมจ่าย', value: money.format(summary?.citizenContribution ?? 0), detail: 'ยอดชำระจากประชาชน', icon: Users, color: 'bg-violet-50 text-violet-700' },
    { label: 'ธุรกรรมที่ชำระแล้ว', value: (summary?.transactionCount ?? 0).toLocaleString('th-TH'), detail: 'รวมรายการที่อยู่ระหว่างตรวจสอบ', icon: Clock3, color: 'bg-amber-50 text-amber-700' },
  ];

  return (
    <div className="min-h-screen bg-surface-soft pb-24 font-sans text-ink">
      <header className="border-b border-hairline bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold sm:text-xl">แดชบอร์ดผลกระทบทางสังคม</h1>
            <p className="mt-1 text-xs text-ink-muted">ติดตามเงินหมุนเวียนและการกระจายเม็ดเงินจากธุรกรรม Co-pay</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="impact-range" className="text-xs font-semibold text-ink-muted">ช่วงเวลา</label>
            <select id="impact-range" value={days} onChange={(event) => setDays(Number(event.target.value) as SocialImpactRange)}
              className="rounded-xl border border-hairline bg-white px-3 py-2 text-xs font-semibold focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100">
              {RANGES.map((range) => <option key={range.days} value={range.days}>{range.label}</option>)}
            </select>
            <button type="button" onClick={() => { void summaryQuery.refetch(); void heatmapQuery.refetch(); }}
              className="inline-flex items-center gap-2 rounded-pill border border-hairline px-3 py-2 text-xs font-semibold hover:bg-surface-soft">
              <RefreshCw className="h-4 w-4 text-brand-blue" /><span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
        {summaryQuery.isLoading ? (
          <p className="rounded-2xl border border-hairline bg-white p-5 text-sm text-ink-muted">กำลังโหลดสรุปผล...</p>
        ) : summaryQuery.error ? (
          <p role="alert" className="flex items-center gap-2 rounded-2xl border border-red-200 bg-white p-5 text-sm text-status-error">
            <AlertCircle className="h-5 w-5 shrink-0" /> {errorMessage(summaryQuery.error)}
          </p>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map(({ label, value, detail, icon: Icon, color }) => (
                <article key={label} className="rounded-2xl border border-hairline bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-ink-muted">{label}</p>
                      <p className="mt-2 text-xl font-bold tracking-tight">{value}</p>
                    </div>
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon className="h-5 w-5" /></span>
                  </div>
                  <p className="mt-2 text-[11px] text-ink-muted">{detail}</p>
                </article>
              ))}
            </section>

            <section className="rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold">ยอดเงินหมุนเวียนตามวัน</h2>
                  <p className="mt-1 text-xs text-ink-muted">ยอดธุรกรรมที่เสร็จสมบูรณ์ในช่วง {days} วันล่าสุด</p>
                </div>
                {lastUpdated && <span className="text-[11px] text-ink-muted">อัปเดต {lastUpdated}</span>}
              </div>
              <ImpactChart points={summaryQuery.data?.timeline ?? []} days={days} />
            </section>

            <section className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold"><MapPinned className="h-4 w-4 text-brand-blue" /> แผนที่การกระจายเม็ดเงิน</h2>
                  <p className="mt-1 text-xs text-ink-muted">แสดงยอดธุรกรรมแยกตามพื้นที่โดยประมาณ ไม่แสดงตำแหน่งประชาชน</p>
                </div>
                <span className="text-[11px] text-ink-muted">พิกัดถูกรวมเป็นช่องประมาณ 1 กม.</span>
              </div>
              {heatmapQuery.isLoading ? (
                <div className="flex h-72 items-center justify-center text-sm text-ink-muted">กำลังโหลดข้อมูลแผนที่...</div>
              ) : heatmapQuery.error ? (
                <p role="alert" className="m-4 rounded-xl bg-red-50 p-4 text-sm text-status-error">{errorMessage(heatmapQuery.error)}</p>
              ) : (
                <>
                  <SocialImpactHeatmap locations={heatmapQuery.data?.locations ?? []} />
                  <div className="flex flex-wrap items-center justify-center gap-4 border-t border-hairline px-4 py-3 text-[11px] text-ink-muted">
                    <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-emerald-500" /> เม็ดเงินน้อย</span>
                    <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-amber-500" /> ปานกลาง</span>
                    <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-red-500" /> เม็ดเงินสูง</span>
                    <span className="ml-auto inline-flex items-center gap-1"><RefreshCw className="h-3 w-3" /> อัปเดตทุก 15 วินาที</span>
                  </div>
                  {heatmapQuery.data?.locations.length === 0 && (
                    <p className="px-4 pb-4 text-center text-xs text-ink-muted">ยังไม่มีธุรกรรมที่ชำระสำเร็จในช่วงเวลาที่เลือก</p>
                  )}
                </>
              )}
            </section>
            <p className="text-center text-[11px] text-ink-muted">
              ยอดรวมคิดจากรายการ SUCCESS และ FLAGGED ที่มียอดชำระแล้ว โดยรวมรายการที่รอตรวจทุจริตไว้ด้วย
            </p>
          </>
        )}
      </main>
    </div>
  );
};
