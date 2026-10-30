import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number, isUserConfirmed: boolean) => void;
  isConfirmed?: boolean;
  isApproximate?: boolean;
  approximateSource?: 'IP' | 'PROVINCE' | null;
  onLocateUser?: () => void;
  isLocating?: boolean;
}

export const MerchantLocationPicker: React.FC<LocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
  isConfirmed = false,
  isApproximate = false,
  approximateSource = null,
  onLocateUser,
  isLocating = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapEngine, setMapEngine] = useState<'GOOGLE' | 'LEAFLET'>('LEAFLET');
  const [googleLoadError, setGoogleLoadError] = useState(false);

  // References for Google Maps
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkerRef = useRef<google.maps.Marker | null>(null);

  // References for Leaflet
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletMarkerRef = useRef<L.Marker | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';

  // Handle user manual pin relocation (Click or Drag) -> Marks as user confirmed
  const handleLocationUpdate = useCallback((newLat: number, newLng: number) => {
    onChangeRef.current(Number(newLat.toFixed(6)), Number(newLng.toFixed(6)), true);
  }, []);

  // Initialize Map Engine (Google Maps if key provided, otherwise Leaflet OSM fallback)
  useEffect(() => {
    let active = true;

    if (!apiKey) {
      setMapEngine('LEAFLET');
      return;
    }

    const loader = new Loader({
      apiKey,
      version: 'quarterly',
      libraries: ['places'],
    });

    loader
      .load()
      .then(() => {
        if (!active) return;
        setMapEngine('GOOGLE');
      })
      .catch(() => {
        if (!active) return;
        setGoogleLoadError(true);
        setMapEngine('LEAFLET');
      });

    return () => {
      active = false;
    };
  }, [apiKey]);

  // Render Google Maps when engine is GOOGLE
  useEffect(() => {
    if (mapEngine !== 'GOOGLE' || !containerRef.current || !window.google?.maps) return;

    const initialCenter = { lat: latitude, lng: longitude };
    const map = new google.maps.Map(containerRef.current, {
      center: initialCenter,
      zoom: 16,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    googleMapRef.current = map;

    // Standard Google Maps Marker (draggable, supports touch/mouse)
    const marker = new google.maps.Marker({
      position: initialCenter,
      map,
      draggable: true,
      animation: google.maps.Animation.DROP,
      title: 'ลากเพื่อปรับตำแหน่งร้านค้า',
    });
    googleMarkerRef.current = marker;

    marker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        handleLocationUpdate(event.latLng.lat(), event.latLng.lng());
      }
    });

    map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        marker.setPosition(event.latLng);
        handleLocationUpdate(event.latLng.lat(), event.latLng.lng());
      }
    });

    return () => {
      googleMarkerRef.current?.setMap(null);
      googleMarkerRef.current = null;
      googleMapRef.current = null;
    };
  }, [mapEngine, handleLocationUpdate]);

  // Update Google Marker position when lat/lng change from outside (e.g. GPS or province select)
  useEffect(() => {
    if (mapEngine !== 'GOOGLE' || !googleMarkerRef.current || !googleMapRef.current) return;
    const currentPos = googleMarkerRef.current.getPosition();
    if (currentPos && Math.abs(currentPos.lat() - latitude) < 0.00001 && Math.abs(currentPos.lng() - longitude) < 0.00001) {
      return;
    }
    const nextPos = new google.maps.LatLng(latitude, longitude);
    googleMarkerRef.current.setPosition(nextPos);
    googleMapRef.current.panTo(nextPos);
  }, [latitude, longitude, mapEngine]);

  // Render Leaflet Map when engine is LEAFLET (Fallback or default)
  useEffect(() => {
    if (mapEngine !== 'LEAFLET' || !containerRef.current) return;

    const map = L.map(containerRef.current, { center: [latitude, longitude], zoom: 16 });
    leafletMapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Custom distinct draggable marker icon for Leaflet
    const defaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    const marker = L.marker([latitude, longitude], {
      icon: defaultIcon,
      draggable: true,
    }).addTo(map);
    leafletMarkerRef.current = marker;

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      handleLocationUpdate(pos.lat, pos.lng);
    });

    map.on('click', (event: L.LeafletMouseEvent) => {
      marker.setLatLng(event.latlng);
      handleLocationUpdate(event.latlng.lat, event.latlng.lng);
    });

    return () => {
      map.remove();
      leafletMapRef.current = null;
      leafletMarkerRef.current = null;
    };
  }, [mapEngine, handleLocationUpdate]);

  // Update Leaflet Marker position when lat/lng change from outside
  useEffect(() => {
    if (mapEngine !== 'LEAFLET' || !leafletMarkerRef.current || !leafletMapRef.current) return;
    const currentLatLng = leafletMarkerRef.current.getLatLng();
    if (Math.abs(currentLatLng.lat - latitude) < 0.00001 && Math.abs(currentLatLng.lng - longitude) < 0.00001) {
      return;
    }
    const nextCoords: L.LatLngExpression = [latitude, longitude];
    leafletMarkerRef.current.setLatLng(nextCoords);
    leafletMapRef.current.setView(nextCoords, Math.max(leafletMapRef.current.getZoom(), 16));
  }, [latitude, longitude, mapEngine]);

  return (
    <div className="space-y-2 font-sans">
      <div className="overflow-hidden rounded-xl border border-hairline bg-white shadow-xs">
        {/* Header / Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-slate-50/80 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-ink">
            <MapPin className="h-4 w-4 text-brand-blue" />
            <span>ปักหมุดที่ตั้งร้านค้า (แตะหรือลากหมุดได้)</span>
          </div>

          {onLocateUser && (
            <button
              type="button"
              onClick={onLocateUser}
              disabled={isLocating}
              className="inline-flex items-center gap-1 rounded-pill border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-blue shadow-2xs hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue disabled:opacity-60"
            >
              <Navigation className={`h-3 w-3 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'กำลังค้นหาพิกัด...' : 'ใช้ตำแหน่งปัจจุบันของฉัน'}</span>
            </button>
          )}
        </div>

        {/* Map Canvas */}
        <div ref={containerRef} className="h-64 sm:h-72 w-full touch-pan-x touch-pan-y" aria-label="แผนที่เลือกพิกัดร้านค้า" />

        {/* Status / Accuracy Info Banner */}
        <div className="border-t border-hairline px-3 py-2 text-xs">
          {isConfirmed ? (
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold">ยืนยันตำแหน่งเรียบร้อยแล้ว:</span>
              <span className="font-mono text-[11px] text-slate-600">
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </span>
            </div>
          ) : isApproximate ? (
            <div className="flex items-start gap-1.5 text-amber-800 bg-amber-50/70 p-2 rounded-lg">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <span className="font-semibold">
                  {approximateSource === 'IP' ? 'พิกัดนี้ได้จาก IP โดยประมาณ' : 'พิกัดนี้เป็นศูนย์กลางจังหวัดที่เลือก'}:
                </span>
                <span className="ml-1 text-ink-muted">
                  กรุณาแตะบนแผนที่ หรือลากหมุดเพื่อระบุตำแหน่งจริงของร้านค้าก่อนส่งฟอร์ม
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-ink-muted">
              <span>พิกัดปัจจุบัน:</span>
              <span className="font-mono text-[11px]">{latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
            </div>
          )}

          {/* Fallback Engine Notice if no Google Maps API key provided */}
          {mapEngine === 'LEAFLET' && (
            <p className="mt-1.5 text-[10px] text-ink-muted">
              {googleLoadError
                ? 'ระบบสลับมาใช้ OpenStreetMap เนื่องจาก Google Maps โหลดไม่สำเร็จ'
                : !apiKey
                ? 'ระบบใช้งาน OpenStreetMap เป็นแผนที่สำรอง'
                : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Export as both MerchantLocationPicker and LocationPicker for backward compatibility
export const LocationPicker = MerchantLocationPicker;
