import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Banknote,
  Flame,
  Layers,
  MapPinned,
  ReceiptText,
  RefreshCw,
  Store,
  TrendingUp,
} from 'lucide-react';
import {
  BoundaryCollection,
  BoundaryFeature,
  getImpactDashboard,
  ImpactDashboardData,
  ImpactLevel,
  loadThailandBoundaries,
} from '../../../services/socialImpactDashboardService';
import { getSocialImpactHeatmap, SocialImpactLocation } from '../../../services/socialImpactApi';

const BoundaryMap = lazy(() =>
  import('../../../components/admin/SocialImpactBoundaryMap').then((module) => ({
    default: module.SocialImpactBoundaryMap,
  }))
);

const HeatmapView = lazy(() =>
  import('../../../components/admin/SocialImpactHeatmap').then((module) => ({
    default: module.SocialImpactHeatmap,
  }))
);

const money = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});

const today = new Date();
const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const initialTo = toInputDate(today);
const initialFromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);

const nameFor = (feature: BoundaryFeature, level: ImpactLevel) =>
  String(level === 'province' ? feature.properties.pro_th : level === 'district' ? feature.properties.amp_th : feature.properties.tam_th ?? '');

const ImpactChart: React.FC<{ points: Array<{ date: string; totalCirculation: number }> }> = ({ points }) => {
  if (!points.length) {
    return <p className="flex min-h-56 items-center justify-center text-base text-ink-muted">ไม่มีข้อมูลในช่วงวันที่เลือก</p>;
  }
  const width = 800;
  const height = 260;
  const pad = { left: 76, right: 16, top: 18, bottom: 40 };
  const max = Math.max(1, ...points.map((point) => point.totalCirculation));
  const coords = points.map((point, index) => ({
    x: pad.left + (points.length === 1 ? (width - pad.left - pad.right) / 2 : (index * (width - pad.left - pad.right)) / (points.length - 1)),
    y: pad.top + (height - pad.top - pad.bottom) * (1 - point.totalCirculation / max),
    point,
  }));
  const dateFormat = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' });

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-[560px] w-full" role="img" aria-label="กราฟยอดเงินหมุนเวียนรายวัน">
        {[0, 1, 2, 3].map((step) => {
          const y = pad.top + (step * (height - pad.top - pad.bottom)) / 3;
          return (
            <g key={step}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#cbd5e1" strokeDasharray="4 4" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#475569" fontSize="12">
                {money.format(max * (1 - step / 3))}
              </text>
            </g>
          );
        })}
        <polyline fill="none" stroke="#0052ff" strokeWidth="3" points={coords.map(({ x, y }) => `${x},${y}`).join(' ')} />
        {coords
          .filter((_, index) => index === 0 || index === coords.length - 1 || points.length <= 7)
          .map(({ x, y, point }) => (
            <g key={point.date}>
              <circle cx={x} cy={y} r="4" fill="white" stroke="#0052ff" strokeWidth="2">
                <title>{`${dateFormat.format(new Date(`${point.date}T00:00:00`))}: ${money.format(point.totalCirculation)}`}</title>
              </circle>
              <text x={x} y={height - 12} textAnchor="middle" fill="#475569" fontSize="12">
                {dateFormat.format(new Date(`${point.date}T00:00:00`))}
              </text>
            </g>
          ))}
      </svg>
    </div>
  );
};

export const AdminSocialImpactPage: React.FC = () => {
  const [level, setLevel] = useState<ImpactLevel>('province');
  const [provinceFeature, setProvinceFeature] = useState<BoundaryFeature | null>(null);
  const [districtFeature, setDistrictFeature] = useState<BoundaryFeature | null>(null);
  const [boundaries, setBoundaries] = useState<BoundaryCollection | null>(null);
  const [dashboard, setDashboard] = useState<ImpactDashboardData | null>(null);
  const [from, setFrom] = useState(toInputDate(initialFromDate));
  const [to, setTo] = useState(initialTo);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Map view toggle: 'boundary' (Choropleth by territory) vs 'heatmap' (GPS density)
  const [mapMode, setMapMode] = useState<'boundary' | 'heatmap'>('boundary');
  const [heatmapLocations, setHeatmapLocations] = useState<SocialImpactLocation[]>([]);
  const [isHeatmapLoading, setIsHeatmapLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setBusy(true);
    setBoundaries(null);
    setError(null);
    void loadThailandBoundaries(level)
      .then((result) => {
        if (active) setBoundaries(result);
      })
      .catch(() => {
        if (active) setError('โหลดขอบเขตแผนที่ไม่สำเร็จ');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [level]);

  const features = useMemo(() => {
    if (!boundaries) return [];
    return boundaries.features.filter((feature) => {
      if (level === 'district' && provinceFeature) return feature.properties.pro_code === provinceFeature.properties.pro_code;
      if (level === 'subdistrict' && districtFeature) return feature.properties.amp_code === districtFeature.properties.amp_code;
      return true;
    });
  }, [boundaries, districtFeature, level, provinceFeature]);

  const fetchDashboardData = useCallback(() => {
    if (!boundaries || !from || !to || from > to) return;
    setError(null);
    void getImpactDashboard({
      level,
      from,
      to,
      parentProvinceCode: provinceFeature?.properties.pro_code,
      parentDistrictCode: districtFeature?.properties.amp_code,
      features,
    })
      .then((result) => {
        setDashboard(result);
      })
      .catch(() => {
        setError('โหลดข้อมูลสรุปไม่สำเร็จ กรุณาลองอีกครั้ง');
      });
  }, [boundaries, districtFeature, features, from, level, provinceFeature, to]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, refreshIndex]);

  // Load heatmap points if in heatmap mode
  useEffect(() => {
    if (mapMode !== 'heatmap') return;
    let active = true;
    setIsHeatmapLoading(true);
    void getSocialImpactHeatmap(30)
      .then((data) => {
        if (active) setHeatmapLocations(data.locations);
      })
      .catch(() => {
        if (active) setHeatmapLocations([]);
      })
      .finally(() => {
        if (active) setIsHeatmapLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mapMode, refreshIndex]);

  const drillDown = useCallback((feature: BoundaryFeature) => {
    if (level === 'province') {
      setProvinceFeature(feature);
      setDistrictFeature(null);
      setLevel('district');
    } else if (level === 'district') {
      setDistrictFeature(feature);
      setLevel('subdistrict');
    }
  }, [level]);

  const goTo = (target: ImpactLevel) => {
    if (target === 'province') {
      setProvinceFeature(null);
      setDistrictFeature(null);
      setLevel('province');
    } else if (target === 'district' && provinceFeature) {
      setDistrictFeature(null);
      setLevel('district');
    } else if (target === 'subdistrict' && provinceFeature && districtFeature) {
      setLevel('subdistrict');
    }
  };

  const handleRefresh = () => {
    setRefreshIndex((prev) => prev + 1);
  };

  const areas = dashboard?.areas ?? [];
  const sourceNote = dashboard?.source === 'mock'
    ? 'ข้อมูลตัวอย่างจำลอง'
    : 'ข้อมูลจริงจากระบบธุรกรรม (daily_social_impact_metrics)';

  const govContribution = dashboard?.governmentContribution ?? 0;
  const citContribution = dashboard?.citizenContribution ?? 0;

  const summaryCards = [
    {
      title: 'ยอดเงินหมุนเวียนรวม',
      value: dashboard ? money.format(dashboard.totalCirculation) : '—',
      subtitle: dashboard?.totalCirculation
        ? `รัฐร่วม ${money.format(govContribution)} · ปชช. ${money.format(citContribution)}`
        : 'คำนวณจากธุรกรรมจริง',
      icon: Banknote,
    },
    {
      title: 'จำนวนธุรกรรม (บิล)',
      value: dashboard?.transactionCount != null ? `${dashboard.transactionCount.toLocaleString('th-TH')} รายการ` : '—',
      subtitle: 'ธุรกรรมที่ชำระเงินสำเร็จ',
      icon: ReceiptText,
    },
    {
      title: 'ร้านค้าที่ได้รับประโยชน์',
      value: dashboard?.benefitedMerchantDays != null ? `${dashboard.benefitedMerchantDays.toLocaleString('th-TH')} ร้าน` : '—',
      subtitle: 'ยอดรวมร้านค้ารายวัน (Merchant-Days)',
      icon: Store,
    },
    {
      title: 'สัดส่วนเมืองรอง',
      value: dashboard?.secondaryCityShare != null ? `${dashboard.secondaryCityShare}%` : '0%',
      subtitle: 'เป้าหมายกระจายเม็ดเงินสู่ 55 จังหวัด',
      icon: Activity,
    },
  ];

  const earliestAllowed = new Date(`${to}T00:00:00`);
  earliestAllowed.setDate(earliestAllowed.getDate() - 364);

  return (
    <div className="min-h-screen bg-surface-soft pb-12 font-sans text-ink">
      <header className="border-b border-hairline bg-white px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard ผลกระทบทางสังคม</h1>
            <p className="mt-1 text-base text-ink-muted">ติดตามการกระจายรายได้ตามพื้นที่ · {sourceNote}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-semibold">
              ตั้งแต่
              <input
                aria-label="วันที่เริ่มต้น"
                type="date"
                value={from}
                min={toInputDate(earliestAllowed)}
                max={to}
                onChange={(event) => setFrom(event.target.value)}
                className="mt-1 block min-h-11 rounded-xl border border-hairline bg-white px-3 text-base"
              />
            </label>
            <label className="text-sm font-semibold">
              ถึงวันที่
              <input
                aria-label="วันที่สิ้นสุด"
                type="date"
                value={to}
                min={from}
                max={initialTo}
                onChange={(event) => setTo(event.target.value)}
                className="mt-1 block min-h-11 rounded-xl border border-hairline bg-white px-3 text-base"
              />
            </label>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-hairline bg-white px-3.5 text-sm font-semibold text-ink hover:bg-surface-soft transition shadow-xs"
              title="รีเฟรชข้อมูลล่าสุด"
            >
              <RefreshCw className="h-4 w-4 text-brand-blue" />
              <span>รีเฟรช</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-base text-status-error">
            {error}
          </p>
        )}
        {from > to && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-base text-status-error">
            วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด
          </p>
        )}

        <nav aria-label="ตำแหน่งในแผนที่" className="flex flex-wrap items-center gap-2 text-base">
          <button
            type="button"
            onClick={() => goTo('province')}
            className="min-h-11 rounded-lg px-3 font-semibold text-brand-blue hover:bg-brand-blue-light"
          >
            ประเทศไทย
          </button>
          {provinceFeature && (
            <>
              <span aria-hidden="true" className="text-ink-muted">›</span>
              {level === 'province' ? (
                <span aria-current="location" className="font-semibold">{nameFor(provinceFeature, 'province')}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => goTo('district')}
                  className="min-h-11 rounded-lg px-3 font-semibold text-brand-blue hover:bg-brand-blue-light"
                >
                  {nameFor(provinceFeature, 'province')}
                </button>
              )}
            </>
          )}
          {districtFeature && (
            <>
              <span aria-hidden="true" className="text-ink-muted">›</span>
              <span aria-current="location" className="font-semibold">{nameFor(districtFeature, 'district')}</span>
            </>
          )}
        </nav>

        {/* 4 Summary KPI Cards */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="สรุปผลกระทบในพื้นที่">
          {summaryCards.map(({ title, value, subtitle, icon: Icon }) => (
            <article key={title} className="rounded-2xl border border-hairline bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue shrink-0">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-muted truncate">{title}</p>
                  <p className="mt-1 text-xl font-bold tracking-tight text-ink">{value}</p>
                </div>
              </div>
              <p className="mt-3 border-t border-hairline/60 pt-2 text-[11px] text-ink-muted truncate">
                {subtitle}
              </p>
            </article>
          ))}
        </section>

        {dashboard?.detailUnavailable && (
          <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950">
            ฐานข้อมูลปัจจุบันมีข้อมูลระดับจังหวัดเท่านั้น ระดับอำเภอและตำบลจึงแสดงแผนที่แต่ยังไม่มีตัวเลขจริง
          </p>
        )}

        {/* Interactive Map View with Mode Switcher */}
        <section className="relative z-0 isolate overflow-hidden rounded-2xl border border-hairline bg-white shadow-xs" aria-labelledby="impact-map-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-hairline">
            <div>
              <h2 id="impact-map-heading" className="flex items-center gap-2 text-lg font-bold">
                <MapPinned aria-hidden="true" className="h-5 w-5 text-brand-blue" />
                {mapMode === 'boundary'
                  ? `แผนที่ขอบเขต${level === 'province' ? 'จังหวัด' : level === 'district' ? 'อำเภอ' : 'ตำบล'}`
                  : 'แผนที่ความหนาแน่นจุดใช้จ่าย (Heatmap)'}
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                {mapMode === 'boundary'
                  ? 'เลือกพื้นที่เพื่อดูระดับย่อย · สีเข้มแสดงยอดเงินที่สูงกว่า'
                  : 'แสดงพิกัดความหนาแน่นของธุรกรรมจริงทั่วประเทศ'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-surface-soft p-1 border border-hairline">
                <button
                  type="button"
                  onClick={() => setMapMode('boundary')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    mapMode === 'boundary' ? 'bg-white text-brand-blue shadow-xs' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>ขอบเขตพื้นที่</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapMode('heatmap')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    mapMode === 'heatmap' ? 'bg-white text-brand-blue shadow-xs' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  <span>Heatmap</span>
                </button>
              </div>

              {mapMode === 'boundary' && level !== 'province' && (
                <button
                  type="button"
                  onClick={() => goTo(level === 'subdistrict' ? 'district' : 'province')}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-hairline px-3 text-xs font-semibold hover:bg-surface-soft"
                >
                  <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                  ย้อนระดับ
                </button>
              )}
            </div>
          </div>

          {mapMode === 'boundary' ? (
            <>
              {busy ? (
                <p className="p-8 text-center text-base text-ink-muted">กำลังโหลดขอบเขตแผนที่…</p>
              ) : boundaries ? (
                <Suspense fallback={<p className="p-8 text-center text-base text-ink-muted">กำลังเปิดแผนที่…</p>}>
                  <BoundaryMap level={level} features={features} areas={areas} onSelect={drillDown} />
                </Suspense>
              ) : null}
              <div className="flex flex-wrap items-center justify-center gap-3 border-t border-hairline px-4 py-3 text-xs text-ink-body">
                <span>ยอดต่ำ</span>
                <span
                  aria-hidden="true"
                  className="h-3.5 w-36 rounded-full"
                  style={{ background: 'linear-gradient(90deg, hsl(210 72% 46%), hsl(45 72% 46%))' }}
                />
                <span>ยอดสูง</span>
                <span className="ml-2 inline-flex items-center gap-1.5">
                  <i aria-hidden="true" className="h-3.5 w-3.5 rounded-sm bg-slate-300" />
                  ไม่มีข้อมูลธุรกรรม
                </span>
              </div>
            </>
          ) : (
            <>
              {isHeatmapLoading ? (
                <p className="p-8 text-center text-base text-ink-muted">กำลังโหลดข้อมูล Heatmap…</p>
              ) : (
                <Suspense fallback={<p className="p-8 text-center text-base text-ink-muted">กำลังเปิด Heatmap…</p>}>
                  <HeatmapView locations={heatmapLocations} />
                </Suspense>
              )}
              <div className="flex flex-wrap items-center justify-center gap-4 border-t border-hairline px-4 py-3 text-xs text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <i className="h-3 w-3 rounded-full bg-emerald-500" /> เม็ดเงินเริ่มต้น
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-3 w-3 rounded-full bg-amber-500" /> ปานกลาง
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-3 w-3 rounded-full bg-red-500" /> หนาแน่นสูง
                </span>
              </div>
            </>
          )}
        </section>

        {/* Daily Circulation Chart */}
        <section className="rounded-2xl border border-hairline bg-white p-4 shadow-xs sm:p-5" aria-labelledby="impact-chart-heading">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 id="impact-chart-heading" className="text-lg font-bold">ยอดเงินหมุนเวียนรายวัน</h2>
              <p className="text-xs text-ink-muted">{from} ถึง {to}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <TrendingUp className="h-4 w-4 text-brand-blue" />
              <span>ข้อมูลธุรกรรมสำเร็จจริง</span>
            </div>
          </div>
          <ImpactChart points={dashboard?.timeline ?? []} />
        </section>

        {/* Area Breakdown Table */}
        <section className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-xs" aria-labelledby="impact-table-heading">
          <div className="p-4 sm:p-5 border-b border-hairline">
            <h2 id="impact-table-heading" className="text-lg font-bold">ตารางสรุปพื้นที่</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              แสดงการกระจายเม็ดเงินในระดับ{level === 'province' ? 'จังหวัด' : level === 'district' ? 'อำเภอ' : 'ตำบล'} · เลือกแถวเพื่อเปิดดูระดับถัดไป
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="bg-surface-soft text-ink">
                <tr>
                  <th scope="col" className="px-4 py-3">พื้นที่</th>
                  <th scope="col" className="px-4 py-3">ยอดเงินหมุนเวียน</th>
                  <th scope="col" className="px-4 py-3">ร้านค้าที่ได้รับประโยชน์ (รวมรายวัน)</th>
                  <th scope="col" className="px-4 py-3">ดูรายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area) => (
                  <tr key={area.code} className="border-t border-hairline hover:bg-surface-soft/60 transition">
                    <th scope="row" className="px-4 py-3 font-semibold">
                      {level === 'province' ? (
                        <button
                          type="button"
                          onClick={() => {
                            const feature = features.find(
                              (item) => String(item.properties.pro_code) === area.code || item.properties.pro_th === area.name
                            );
                            if (feature) drillDown(feature);
                          }}
                          className="min-h-9 text-left font-semibold text-brand-blue hover:underline"
                        >
                          {area.name}
                        </button>
                      ) : level === 'district' ? (
                        <button
                          type="button"
                          onClick={() => {
                            const feature = features.find(
                              (item) => String(item.properties.amp_code) === area.code || item.properties.amp_th === area.name
                            );
                            if (feature) drillDown(feature);
                          }}
                          className="min-h-9 text-left font-semibold text-brand-blue hover:underline"
                        >
                          {area.name}
                        </button>
                      ) : (
                        area.name
                      )}
                    </th>
                    <td className="px-4 py-3 font-mono font-semibold">{money.format(area.totalCirculation)}</td>
                    <td className="px-4 py-3">{area.benefitedMerchantDays.toLocaleString('th-TH')} ร้าน</td>
                    <td className="px-4 py-3">
                      {level === 'subdistrict' ? (
                        <span className="text-ink-muted text-xs">ระดับย่อยสุดแล้ว</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const feature = features.find(
                              (item) =>
                                (level === 'province' && (String(item.properties.pro_code) === area.code || item.properties.pro_th === area.name)) ||
                                (level === 'district' && (String(item.properties.amp_code) === area.code || item.properties.amp_th === area.name))
                            );
                            if (feature) drillDown(feature);
                          }}
                          className="min-h-9 rounded-lg px-3 text-xs font-semibold text-brand-blue bg-brand-blue-light/50 hover:bg-brand-blue-light"
                        >
                          เปิดดูระดับย่อย
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!areas.length || dashboard?.detailUnavailable) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-ink-muted">
                      {dashboard?.detailUnavailable ? 'ยังไม่มีข้อมูลระดับพื้นที่นี้' : 'ไม่มีข้อมูลธุรกรรมในช่วงวันที่เลือก'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-center text-xs text-ink-muted">
          ดึงข้อมูลจริงจากระบบธุรกรรม (transactions) และ daily_social_impact_metrics · จำนวนร้านค้าเป็นยอดรวมรายวัน (Merchant-Days)
        </p>
      </main>
    </div>
  );
};
