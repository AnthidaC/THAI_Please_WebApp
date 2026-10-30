import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SocialImpactLocation } from '../../services/socialImpactApi';

interface SocialImpactHeatmapProps {
  locations: SocialImpactLocation[];
}

const money = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

const getColor = (intensity: number): string => {
  if (intensity >= 0.75) return '#ef4444';
  if (intensity >= 0.4) return '#f59e0b';
  return '#10b981';
};

export const SocialImpactHeatmap: React.FC<SocialImpactHeatmapProps> = ({ locations }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { center: [13.7563, 100.5018], zoom: 6 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    if (locations.length > 0) {
      const maxAmount = Math.max(...locations.map((location) => location.totalCirculation), 1);
      const bounds: L.LatLngExpression[] = [];
      locations.forEach((location) => {
        const intensity = location.totalCirculation / maxAmount;
        const color = getColor(intensity);
        const radius = 18 + Math.round(intensity * 26);
        const center: L.LatLngExpression = [location.latitude, location.longitude];
        bounds.push(center);
        L.circleMarker(center, {
          radius,
          color,
          weight: 1,
          opacity: 0.3 + intensity * 0.25,
          fillColor: color,
          fillOpacity: 0.12 + intensity * 0.25,
        }).addTo(map);
        L.circleMarker(center, {
          radius: Math.max(5, Math.round(radius * 0.42)),
          color,
          weight: 0,
          fillColor: color,
          fillOpacity: 0.55 + intensity * 0.35,
        })
          .bindTooltip(
            `ยอดใช้จ่ายรวม ฿${money.format(location.totalCirculation)} · ${money.format(location.transactionCount)} รายการ`,
            { direction: 'top', opacity: 0.95 }
          )
          .addTo(map);
      });
      if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds).pad(0.12), { maxZoom: 12 });
      else map.setView(bounds[0], 12);
    }

    const resize = () => map.invalidateSize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      map.remove();
    };
  }, [locations]);

  return <div ref={containerRef} className="relative z-0 isolate h-[420px] w-full" aria-label="แผนที่ heatmap ยอดใช้จ่ายแยกตามพื้นที่" />;
};
