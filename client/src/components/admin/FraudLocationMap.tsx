import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Compass } from 'lucide-react';



interface FraudLocationMapProps {
  userLat: number;
  userLon: number;
  merchantLat: number;
  merchantLon: number;
  customerName: string;
  shopName: string;
  distanceMeters: number;
  className?: string;
}

export const FraudLocationMap: React.FC<FraudLocationMapProps> = ({
  userLat,
  userLon,
  merchantLat,
  merchantLon,
  customerName,
  shopName,
  distanceMeters,
  className = 'h-72 w-full',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const isWithin2Km = distanceMeters <= 2000;
  const formattedDistance =
    distanceMeters > 1000
      ? `${(distanceMeters / 1000).toFixed(2)} กม.`
      : `${Math.round(distanceMeters)} ม.`;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // เคลียร์ instance แผนที่เดิมหากมีอยู่ เพื่อป้องกัน "Map container is already initialized"
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // สร้าง Leaflet Map เชื่อมโยงกับ OpenStreetMap (OSM) ฟรี 100% ไม่มีค่าใช้จ่าย
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    // ใช้ OpenStreetMap Standard Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // ไอคอน SVG แบบคมชัดสำหรับร้านค้า (Merchant Marker - สีเขียวมรกต)
    const merchantIcon = L.divIcon({
      className: 'custom-merchant-pin',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -100%);">
          <div style="background:#10b981;color:white;padding:4px 8px;border-radius:12px;font-size:10px;font-weight:bold;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;display:flex;align-items:center;gap:4px;">
            <span>🏪</span>
            <span>${shopName}</span>
          </div>
          <div style="width:14px;height:14px;background:#10b981;border:3px solid white;border-radius:50%;margin-top:-3px;box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    // ไอคอน SVG แบบคมชัดสำหรับผู้ซื้อ (Citizen Marker - สีน้ำเงิน)
    const citizenIcon = L.divIcon({
      className: 'custom-citizen-pin',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -100%);">
          <div style="background:#2563eb;color:white;padding:4px 8px;border-radius:12px;font-size:10px;font-weight:bold;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;display:flex;align-items:center;gap:4px;">
            <span>👤</span>
            <span>${customerName}</span>
          </div>
          <div style="width:14px;height:14px;background:#2563eb;border:3px solid white;border-radius:50%;margin-top:-3px;box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    // 1. ปักหมุดร้านค้า
    const merchantMarker = L.marker([merchantLat, merchantLon], {
      icon: merchantIcon,
      title: `ร้านค้า: ${shopName}`,
    }).addTo(map);

    merchantMarker.bindPopup(`
      <div style="font-family:sans-serif;font-size:12px;line-height:1.4;">
        <strong style="color:#059669;">🏪 จุดร้านค้า: ${shopName}</strong><br/>
        พิกัด: ${merchantLat.toFixed(6)}, ${merchantLon.toFixed(6)}
      </div>
    `);

    // 2. วาดวงกลมรัศมี Geofence 2 กิโลเมตร (2,000 เมตร) รอบร้านค้า
    const geofenceCircle = L.circle([merchantLat, merchantLon], {
      radius: 2000,
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.1,
      weight: 2,
      dashArray: '5, 5',
    }).addTo(map);

    geofenceCircle.bindTooltip('ขอบเขตรัศมีที่อนุญาต (2 กิโลเมตร)', {
      sticky: true,
      direction: 'top',
    });

    // 3. ปักหมุดผู้ซื้อ
    const citizenMarker = L.marker([userLat, userLon], {
      icon: citizenIcon,
      title: `ผู้ซื้อ: ${customerName}`,
    }).addTo(map);

    citizenMarker.bindPopup(`
      <div style="font-family:sans-serif;font-size:12px;line-height:1.4;">
        <strong style="color:#2563eb;">👤 จุดผู้ซื้อ: ${customerName}</strong><br/>
        พิกัด: ${userLat.toFixed(6)}, ${userLon.toFixed(6)}<br/>
        ระยะห่าง: <strong>${formattedDistance}</strong>
      </div>
    `);

    // 4. ลากเส้นเชื่อมโยงระยะทางระหว่างผู้ซื้อและร้านค้า (Polyline)
    const polylineColor = isWithin2Km ? '#f59e0b' : '#ef4444';
    const distanceLine = L.polyline(
      [
        [userLat, userLon],
        [merchantLat, merchantLon],
      ],
      {
        color: polylineColor,
        weight: 3,
        dashArray: '6, 6',
        opacity: 0.9,
      }
    ).addTo(map);

    distanceLine.bindTooltip(`ระยะทางห่างกัน ${formattedDistance}`, {
      permanent: true,
      direction: 'center',
      className: 'bg-slate-900 text-white font-mono text-[10px] px-2 py-0.5 rounded shadow',
    });

    // 5. ปรับมุมมองอัตโนมัติให้ครอบคลุมทั้ง 2 จุดและรัศมี 2 กม.
    const group = L.featureGroup([merchantMarker, citizenMarker, geofenceCircle]);
    map.fitBounds(group.getBounds().pad(0.15));

    // Cleanup เมื่อ Component ถูก Unmount
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [userLat, userLon, merchantLat, merchantLon, customerName, shopName, distanceMeters]);

  const handleResetView = () => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const bounds = L.latLngBounds([
      [userLat, userLon],
      [merchantLat, merchantLon],
    ]).pad(0.3);
    map.fitBounds(bounds);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-hairline shadow-inner bg-slate-100">
      {/* คอนเทนเนอร์แสดงแผนที่ OpenStreetMap จริง */}
      <div ref={mapContainerRef} className={className} style={{ minHeight: '280px' }} />

      {/* แถบหัวข้อมูลสถานะระยะทางลอยตัวเหนือแผนที่ (Floating Info Pill) */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div
          className={`pointer-events-auto inline-flex items-center space-x-1.5 rounded-pill px-3 py-1 text-xs font-semibold shadow-md backdrop-blur-md border ${
            isWithin2Km
              ? 'bg-amber-500/90 text-white border-amber-400/50'
              : 'bg-red-600/90 text-white border-red-500/50'
          }`}
        >
          <Navigation className="h-3.5 w-3.5 shrink-0" />
          <span>ห่าง {formattedDistance}</span>
          <span className="text-[10px] opacity-80">
            ({isWithin2Km ? 'ในเกณฑ์ 2 กม.' : 'เกินเกณฑ์ 2 กม.'})
          </span>
        </div>

        <button
          type="button"
          onClick={handleResetView}
          className="pointer-events-auto inline-flex items-center space-x-1 rounded-pill bg-white/90 hover:bg-white text-ink px-2.5 py-1 text-[11px] font-medium shadow-md border border-hairline transition"
          title="จัดมุมมองให้พอดีกับทั้งสองพิกัด"
        >
          <Compass className="h-3 w-3 text-brand-blue" />
          <span>จัดกึ่งกลาง</span>
        </button>
      </div>

      {/* แถบคำอธิบายสัญลักษณ์ด้านล่างของแผนที่ (Map Legend) */}
      <div className="absolute bottom-2 left-2 z-[1000] pointer-events-auto bg-white/95 backdrop-blur-sm rounded-xl border border-hairline px-2.5 py-1.5 shadow-sm text-[10px] text-ink-muted flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span className="text-ink font-medium">ร้านค้า</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600"></span>
          <span className="text-ink font-medium">ผู้ซื้อ</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full border border-dashed border-emerald-500 bg-emerald-100/60"></span>
          <span>รัศมี 2 กม.</span>
        </div>
      </div>
    </div>
  );
};
