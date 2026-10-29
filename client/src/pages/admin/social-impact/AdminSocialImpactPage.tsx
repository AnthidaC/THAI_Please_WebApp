import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, Banknote, MapPinned, Store } from 'lucide-react';
import {
  BoundaryCollection, BoundaryFeature, getImpactDashboard, ImpactDashboardData,
  ImpactLevel, loadThailandBoundaries,
} from '../../../services/socialImpactDashboardService';

const BoundaryMap = lazy(() => import('../../../components/admin/SocialImpactBoundaryMap').then((module) => ({ default: module.SocialImpactBoundaryMap })));
const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });
const today = new Date();
const toInputDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const initialTo = toInputDate(today);
const initialFromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);

const nameFor = (feature: BoundaryFeature, level: ImpactLevel) => String(level === 'province' ? feature.properties.pro_th : level === 'district' ? feature.properties.amp_th : feature.properties.tam_th ?? '');

const ImpactChart: React.FC<{ points: Array<{ date: string; totalCirculation: number }> }> = ({ points }) => {
  if (!points.length) return <p className="flex min-h-56 items-center justify-center text-base text-ink-muted">ไม่มีข้อมูลในช่วงวันที่เลือก</p>;
  const width = 800; const height = 260; const pad = { left: 76, right: 16, top: 18, bottom: 40 };
  const max = Math.max(1, ...points.map((point) => point.totalCirculation));
  const coords = points.map((point, index) => ({
    x: pad.left + (points.length === 1 ? (width - pad.left - pad.right) / 2 : index * (width - pad.left - pad.right) / (points.length - 1)),
    y: pad.top + (height - pad.top - pad.bottom) * (1 - point.totalCirculation / max), point,
  }));
  const dateFormat = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' });
  return <div className="overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-[560px] w-full" role="img" aria-label="กราฟยอดเงินหมุนเวียนรายวัน">
    {[0, 1, 2, 3].map((step) => { const y = pad.top + step * (height - pad.top - pad.bottom) / 3; return <g key={step}><line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#cbd5e1" strokeDasharray="4 4" /><text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#475569" fontSize="12">{money.format(max * (1 - step / 3))}</text></g>; })}
    <polyline fill="none" stroke="#0052ff" strokeWidth="3" points={coords.map(({ x, y }) => `${x},${y}`).join(' ')} />
    {coords.filter((_, index) => index === 0 || index === coords.length - 1 || points.length <= 7).map(({ x, y, point }) => <g key={point.date}><circle cx={x} cy={y} r="4" fill="white" stroke="#0052ff" strokeWidth="2"><title>{`${dateFormat.format(new Date(`${point.date}T00:00:00`))}: ${money.format(point.totalCirculation)}`}</title></circle><text x={x} y={height - 12} textAnchor="middle" fill="#475569" fontSize="12">{dateFormat.format(new Date(`${point.date}T00:00:00`))}</text></g>)}
  </svg></div>;
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

  useEffect(() => {
    let active = true;
    setBusy(true); setBoundaries(null); setError(null);
    void loadThailandBoundaries(level).then((result) => { if (active) setBoundaries(result); }).catch(() => { if (active) setError('โหลดขอบเขตแผนที่ไม่สำเร็จ'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [level]);

  const features = useMemo(() => {
    if (!boundaries) return [];
    return boundaries.features.filter((feature) => {
      if (level === 'district' && provinceFeature) return feature.properties.pro_code === provinceFeature.properties.pro_code;
      if (level === 'subdistrict' && districtFeature) return feature.properties.amp_code === districtFeature.properties.amp_code;
      return true;
    });
  }, [boundaries, districtFeature, level, provinceFeature]);

  useEffect(() => {
    if (!boundaries || !from || !to || from > to) return;
    let active = true;
    setError(null);
    void getImpactDashboard({ level, from, to,
      parentProvinceCode: provinceFeature?.properties.pro_code,
      parentDistrictCode: districtFeature?.properties.amp_code,
      features,
    }).then((result) => { if (active) setDashboard(result); }).catch(() => { if (active) setError('โหลดข้อมูลสรุปไม่สำเร็จ กรุณาลองอีกครั้ง'); });
    return () => { active = false; };
  }, [boundaries, districtFeature, features, from, level, provinceFeature, to]);

  const drillDown = useCallback((feature: BoundaryFeature) => {
    if (level === 'province') { setProvinceFeature(feature); setDistrictFeature(null); setLevel('district'); }
    else if (level === 'district') { setDistrictFeature(feature); setLevel('subdistrict'); }
  }, [level]);

  const goTo = (target: ImpactLevel) => {
    if (target === 'province') { setProvinceFeature(null); setDistrictFeature(null); setLevel('province'); }
    else if (target === 'district' && provinceFeature) { setDistrictFeature(null); setLevel('district'); }
    else if (target === 'subdistrict' && provinceFeature && districtFeature) setLevel('subdistrict');
  };

  const areas = dashboard?.areas ?? [];
  const sourceNote = dashboard?.source === 'mock' ? 'ข้อมูลตัวอย่างจำลอง' : 'ข้อมูลจาก daily_social_impact_metrics';
  const summaryCards = [
    { title: 'ยอดเงินหมุนเวียนรวม', value: dashboard ? money.format(dashboard.totalCirculation) : '—', icon: Banknote },
    { title: 'จำนวนร้านค้าที่ได้รับประโยชน์ (รวมรายวัน)', value: dashboard?.benefitedMerchantDays.toLocaleString('th-TH') ?? '—', icon: Store },
    { title: 'สัดส่วนเมืองรอง', value: dashboard?.secondaryCityShare == null ? 'ไม่มีข้อมูลจำแนก' : `${dashboard.secondaryCityShare}%`, icon: Activity },
  ];
  const earliestAllowed = new Date(`${to}T00:00:00`);
  earliestAllowed.setDate(earliestAllowed.getDate() - 364);

  return <div className="min-h-screen bg-surface-soft pb-12 font-sans text-ink">
    <header className="border-b border-hairline bg-white px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Dashboard ผลกระทบทางสังคม</h1><p className="mt-1 text-base text-ink-muted">ติดตามการกระจายรายได้ตามพื้นที่ · {sourceNote}</p></div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">ตั้งแต่<input aria-label="วันที่เริ่มต้น" type="date" value={from} min={toInputDate(earliestAllowed)} max={to} onChange={(event) => setFrom(event.target.value)} className="mt-1 block min-h-11 rounded-xl border border-hairline bg-white px-3 text-base" /></label>
          <label className="text-sm font-semibold">ถึงวันที่<input aria-label="วันที่สิ้นสุด" type="date" value={to} min={from} max={initialTo} onChange={(event) => setTo(event.target.value)} className="mt-1 block min-h-11 rounded-xl border border-hairline bg-white px-3 text-base" /></label>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-base text-status-error">{error}</p>}
      {from > to && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-base text-status-error">วันที่เริ่มต้นต้องไม่อยู่หลังวันที่สิ้นสุด</p>}
      <nav aria-label="ตำแหน่งในแผนที่" className="flex flex-wrap items-center gap-2 text-base">
        <button type="button" onClick={() => goTo('province')} className="min-h-11 rounded-lg px-3 font-semibold text-brand-blue hover:bg-brand-blue-light">ประเทศไทย</button>
        {provinceFeature && <><span aria-hidden="true">›</span>{level === 'province' ? <span aria-current="location">{nameFor(provinceFeature, 'province')}</span> : <button type="button" onClick={() => goTo('district')} className="min-h-11 rounded-lg px-3 font-semibold text-brand-blue hover:bg-brand-blue-light">{nameFor(provinceFeature, 'province')}</button>}</>}
        {districtFeature && <><span aria-hidden="true">›</span><span aria-current="location">{nameFor(districtFeature, 'district')}</span></>}
      </nav>

      <section className="grid gap-3 md:grid-cols-3" aria-label="สรุปผลกระทบในพื้นที่">
        {summaryCards.map(({ title, value, icon: Icon }) => <article key={title} className="rounded-2xl border border-hairline bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue"><Icon aria-hidden="true" className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-ink-muted">{title}</p><p className="mt-1 text-xl font-bold">{value}</p></div></div></article>)}
      </section>

      {dashboard?.detailUnavailable && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950">ฐานข้อมูลปัจจุบันมีข้อมูลระดับจังหวัดเท่านั้น ระดับอำเภอและตำบลจึงแสดงแผนที่แต่ยังไม่มีตัวเลขจริง</p>}

      <section className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm" aria-labelledby="impact-map-heading">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5"><div><h2 id="impact-map-heading" className="flex items-center gap-2 text-lg font-bold"><MapPinned aria-hidden="true" className="h-5 w-5 text-brand-blue" />แผนที่{level === 'province' ? 'จังหวัด' : level === 'district' ? 'อำเภอ' : 'ตำบล'}</h2><p className="mt-1 text-sm text-ink-muted">เลือกพื้นที่เพื่อดูระดับย่อย · สีเข้มแสดงยอดเงินที่สูงกว่า</p></div>{level !== 'province' && <button type="button" onClick={() => goTo(level === 'subdistrict' ? 'district' : 'province')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-hairline px-4 text-base font-semibold hover:bg-surface-soft"><ArrowLeft aria-hidden="true" className="h-4 w-4" />ย้อนระดับ</button>}</div>
        {busy ? <p className="p-8 text-center text-base text-ink-muted">กำลังโหลดขอบเขตแผนที่…</p> : boundaries && <Suspense fallback={<p className="p-8 text-center text-base text-ink-muted">กำลังเปิดแผนที่…</p>}><BoundaryMap level={level} features={features} areas={areas} onSelect={drillDown} /></Suspense>}
        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-hairline px-4 py-3 text-sm text-ink-body"><span>ยอดต่ำ</span><span aria-hidden="true" className="h-4 w-36 rounded-full" style={{ background: 'linear-gradient(90deg, hsl(210 72% 46%), hsl(45 72% 46%))' }} /><span>ยอดสูง</span><span className="ml-2 inline-flex items-center gap-2"><i aria-hidden="true" className="h-4 w-4 rounded-sm bg-slate-300" />ไม่มีข้อมูล</span></div>
      </section>

      <section className="rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:p-5" aria-labelledby="impact-chart-heading">
        <h2 id="impact-chart-heading" className="text-lg font-bold">ยอดเงินหมุนเวียนรายวัน</h2><p className="mb-4 mt-1 text-sm text-ink-muted">{from} ถึง {to}</p><ImpactChart points={dashboard?.timeline ?? []} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-sm" aria-labelledby="impact-table-heading">
        <div className="p-4 sm:p-5"><h2 id="impact-table-heading" className="text-lg font-bold">ตารางสรุปพื้นที่</h2><p className="mt-1 text-sm text-ink-muted">เลือกแถวเพื่อเปิดดูระดับถัดไป</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] border-collapse text-left text-sm"><thead className="bg-surface-soft text-ink"><tr><th scope="col" className="px-4 py-3">พื้นที่</th><th scope="col" className="px-4 py-3">ยอดเงินหมุนเวียน</th><th scope="col" className="px-4 py-3">ร้านค้าที่ได้รับประโยชน์ (รวมรายวัน)</th><th scope="col" className="px-4 py-3">ดูรายละเอียด</th></tr></thead><tbody>
          {areas.map((area) => <tr key={area.code} className="border-t border-hairline"><th scope="row" className="px-4 py-3 font-semibold">{level === 'province' ? area.name : <button type="button" onClick={() => { const feature = features.find((item) => String(level === 'district' ? item.properties.amp_code : item.properties.tam_code) === area.code); if (feature) drillDown(feature); }} className="min-h-11 text-left font-semibold text-brand-blue underline">{area.name}</button>}</th><td className="px-4 py-3">{money.format(area.totalCirculation)}</td><td className="px-4 py-3">{area.benefitedMerchantDays.toLocaleString('th-TH')}</td><td className="px-4 py-3">{level === 'subdistrict' ? '—' : <button type="button" onClick={() => { const feature = features.find((item) => String(level === 'province' ? item.properties.pro_code : item.properties.amp_code) === area.code); if (feature) drillDown(feature); }} className="min-h-11 rounded-lg px-3 font-semibold text-brand-blue hover:bg-brand-blue-light">เปิดดู</button>}</td></tr>)}
          {(!areas.length || dashboard?.detailUnavailable) && <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-muted">{dashboard?.detailUnavailable ? 'ยังไม่มีข้อมูลระดับพื้นที่นี้' : 'ไม่มีข้อมูลในช่วงวันที่เลือก'}</td></tr>}
        </tbody></table></div>
      </section>
      <p className="text-center text-sm text-ink-muted">{dashboard?.source === 'mock' ? 'ตัวเลขทั้งหมดเป็นข้อมูลจำลองเพื่อแสดงรูปแบบการใช้งาน' : 'จำนวนร้านค้าเป็นยอดรวมรายวัน ไม่ใช่จำนวนร้านค้าไม่ซ้ำ'}</p>
    </main>
  </div>;
};
