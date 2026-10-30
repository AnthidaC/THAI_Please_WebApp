import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

interface MerchantLocationPickerProps {
  latitude: number;
  longitude: number;
  onChange?: (latitude: number, longitude: number) => void;
  readOnly?: boolean;
}

export const MerchantLocationPicker: React.FC<MerchantLocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, { center: [latitude, longitude], zoom: 15 });
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    markerRef.current = L.circleMarker([latitude, longitude], {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillColor: '#0052ff',
      fillOpacity: 1,
    }).addTo(map);

    if (!readOnly) {
      map.on('click', (event: L.LeafletMouseEvent) => {
        onChangeRef.current?.(event.latlng.lat, event.latlng.lng);
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [readOnly]);

  useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;
    const coordinates: L.LatLngExpression = [latitude, longitude];
    marker.setLatLng(coordinates);
    map.setView(coordinates, Math.max(map.getZoom(), 15));
  }, [latitude, longitude]);

  return (
    <div className="overflow-hidden rounded-xl border border-hairline">
      <div className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold ${readOnly ? 'bg-slate-50 text-slate-700' : 'bg-blue-50 text-brand-blue'}`}>
        <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{readOnly ? 'ตำแหน่งร้านค้าปัจจุบันบนแผนที่' : 'คลิกบนแผนที่เพื่อเลือกพิกัดร้าน'}</span>
      </div>
      <div ref={containerRef} className="h-64 w-full" aria-label="แผนที่แสดงพิกัดร้านค้า" />
    </div>
  );
};
