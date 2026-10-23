import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';

interface MerchantLocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
}

export const MerchantLocationPicker: React.FC<MerchantLocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
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
    map.on('click', (event: L.LeafletMouseEvent) => {
      onChangeRef.current(event.latlng.lat, event.latlng.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

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
      <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 text-xs font-semibold text-brand-blue">
        <MapPin className="h-4 w-4" />
        คลิกบนแผนที่เพื่อเลือกพิกัดร้าน
      </div>
      <div ref={containerRef} className="h-64 w-full" aria-label="แผนที่เลือกพิกัดร้านค้า" />
    </div>
  );
};
