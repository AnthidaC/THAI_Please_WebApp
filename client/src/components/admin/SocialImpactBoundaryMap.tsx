import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BoundaryFeature, ImpactArea, ImpactLevel } from '../../services/socialImpactDashboardService';

interface Props {
  level: ImpactLevel;
  features: BoundaryFeature[];
  areas: ImpactArea[];
  onSelect: (feature: BoundaryFeature) => void;
}

const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });
const nameFor = (feature: BoundaryFeature, level: ImpactLevel) => String(level === 'province' ? feature.properties.pro_th : level === 'district' ? feature.properties.amp_th : feature.properties.tam_th ?? '');
const codeFor = (feature: BoundaryFeature, level: ImpactLevel) => String(level === 'province' ? feature.properties.pro_code : level === 'district' ? feature.properties.amp_code : feature.properties.tam_code ?? '');

export const SocialImpactBoundaryMap: React.FC<Props> = ({ level, features, areas, onSelect }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || features.length === 0) return;
    const map = L.map(containerRef.current, { center: [13.2, 101], zoom: 5, zoomControl: true, scrollWheelZoom: false });
    const values = new Map(areas.map((area) => [area.code, area]));
    const maxValue = Math.max(1, ...areas.map((area) => area.totalCirculation));
    const geoJson = L.geoJSON(features as unknown as GeoJSON.Feature[], {
      style: (rawFeature) => {
        const feature = rawFeature as unknown as BoundaryFeature;
        const amount = values.get(codeFor(feature, level))?.totalCirculation ?? 0;
        const ratio = amount / maxValue;
        const hue = 210 - Math.round(ratio * 165);
        return { color: '#334155', weight: 0.8, opacity: 0.8, fillColor: amount ? `hsl(${hue} 72% 46%)` : '#cbd5e1', fillOpacity: amount ? 0.25 + ratio * 0.55 : 0.3 };
      },
      onEachFeature: (rawFeature, layer) => {
        const feature = rawFeature as unknown as BoundaryFeature;
        const area = values.get(codeFor(feature, level));
        const tooltip = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = nameFor(feature, level);
        const detail = document.createElement('div');
        detail.textContent = `ยอดหมุนเวียน ${money.format(area?.totalCirculation ?? 0)}`;
        const merchant = document.createElement('div');
        merchant.textContent = `ร้านค้า (รวมรายวัน) ${(area?.benefitedMerchantDays ?? 0).toLocaleString('th-TH')}`;
        tooltip.append(title, detail, merchant);
        layer.bindTooltip(tooltip);
        if (level !== 'subdistrict') {
          layer.on('mouseover', () => (layer as L.Path).setStyle({ weight: 2, color: '#0f172a', fillOpacity: 0.75 }));
          layer.on('mouseout', () => geoJson.resetStyle(layer));
          layer.on('click', () => onSelect(feature));
        }
      },
    }).addTo(map);
    const bounds = geoJson.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [12, 12], maxZoom: level === 'province' ? 6 : level === 'district' ? 8 : 10 });
    const resize = () => map.invalidateSize();
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); map.remove(); };
  }, [areas, features, level, onSelect]);

  return <div ref={containerRef} className="h-[55vh] min-h-[360px] w-full" role="img" aria-label={`แผนที่ผลกระทบระดับ${level === 'province' ? 'จังหวัด' : level === 'district' ? 'อำเภอ' : 'ตำบล'}`} />;
};
