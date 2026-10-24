import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { APP_ROUTES } from '../../../constants/routes';
import {
  MapPin,
  Sparkles,
  Star,
  Search,
  Navigation,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  MapPinOff,
  Store,
  CheckCircle2,
  WifiOff,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import {
  recommendationApi,
  RecommendedMerchantItem,
} from '../../../services/recommendationApi';
import { geocodingService } from '../../../services/geocodingService';
import { useAuthStore } from '../../../stores/authStore';

/**
 * ข้อมูลร้านค้าแนะนำสำหรับแสดงผลในการ์ด (UI Card Model)
 */
export interface RecommendedMerchant {
  id: string;
  name: string;
  category: string;
  distanceKm: number;
  formattedDistance: string;
  ratingStars: number;
  reviewCount: number;
  transactions24h: number;
  aiScore: number;
  aiReason: string;
  isAiEnhanced: boolean;
  address: string;
  openStatus: string;
  priceLevel: string;
  recommendationId?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * โครงสร้างข้อมูลพิกัด GPS จริงของผู้ใช้งาน
 */
export interface RealCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * สถานะการขอสิทธิ์และตรวจจับสัญญาณดาวเทียม GPS
 */
export type GeoStatus =
  | 'prompting' // เริ่มต้นขอสิทธิ์จากเบราว์เซอร์
  | 'locating' // กำลังค้นหาสัญญาณพิกัด GPS จริง
  | 'granted' // ได้รับพิกัดจริงเรียบร้อย
  | 'denied' // ผู้ใช้ปฏิเสธการให้สิทธิ์ (PERMISSION_DENIED)
  | 'unavailable' // สัญญาณพิกัดขัดข้อง (POSITION_UNAVAILABLE)
  | 'timeout' // หมดเวลาค้นหาพิกัด (TIMEOUT)
  | 'unsupported'; // เบราว์เซอร์ไม่รองรับ Geolocation



const CATEGORIES = [
  'ทั้งหมด',
  'สตรีทฟู้ด',
  'อาหารจานด่วน',
  'เครื่องดื่ม & กาแฟ',
  'อาหารตามสั่ง',
  'ขนมหวาน & เบเกอรี่',
];

const RADIUS_OPTIONS = [
  { label: '1 กม.', value: 1 },
  { label: '3 กม.', value: 3 },
  { label: '5 กม.', value: 5 },
  { label: '10 กม.', value: 10 },
  { label: '20 กม.', value: 20 },
];

/**
 * ฟังก์ชันแปลงผลลัพธ์จาก Real Backend API เป็นรูปแบบการ์ด UI
 */
const mapApiItemToCard = (item: RecommendedMerchantItem): RecommendedMerchant => ({
  id: item.merchantId,
  name: item.shopName,
  category: 'ร้านอาหาร & บริการ Co-pay',
  distanceKm: item.distanceKm,
  formattedDistance: item.formattedDistance || `${item.distanceKm.toFixed(1)} กม.`,
  ratingStars: Number(item.averageRating) || 0,
  reviewCount: Math.max(1, Math.round((item.transactionCount24h || 1) * 1.5)),
  transactions24h: item.transactionCount24h || 0,
  aiScore: item.finalScore || item.baseScore || 0,
  aiReason:
    item.recommendationReason ||
    'ร้านค้ายอดนิยมในรัศมีใกล้คุณ รองรับสิทธิ์ Co-pay 60/40 รัฐสมทบสูงสุด 150 บาท/วัน',
  isAiEnhanced: !!item.isAiEnhanced,
  address: 'ร้านค้าที่ได้รับการอนุมัติในโครงการ Co-pay',
  openStatus: 'เปิดให้บริการ',
  priceLevel: 'โครงการ Co-pay 60/40',
  recommendationId: item.recommendationId,
  latitude: Number(item.latitude),
  longitude: Number(item.longitude),
});

export const CitizenNearMePage: React.FC = () => {
  // 1. สถานะค้นหาและฟิลเตอร์
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [selectedRadius, setSelectedRadius] = useState<number>(10);
  const [sortBy, setSortBy] = useState<'ai' | 'distance' | 'rating' | 'popular'>('ai');

  // 2. สถานะพิกัด GPS จริง (ห้าม Hardcode พิกัดเริ่มต้น)
  const [userCoords, setUserCoords] = useState<RealCoordinates | null>(null);
  const [readableAddress, setReadableAddress] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('prompting');

  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuthStore();

  // แปลงพิกัด GPS เป็นชื่อที่อยู่ภาษาไทยที่อ่านเข้าใจง่าย
  useEffect(() => {
    let isMounted = true;
    if (userCoords) {
      geocodingService.getReadableThaiAddress(userCoords.latitude, userCoords.longitude).then((addr) => {
        if (isMounted) {
          setReadableAddress(addr || 'ตำแหน่งปัจจุบันของคุณ');
        }
      });
    } else {
      setReadableAddress(null);
    }
    return () => {
      isMounted = false;
    };
  }, [userCoords]);

  // ฟังก์ชันขอพิกัด GPS จริงจากเบราว์เซอร์
  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unsupported');
      setUserCoords(null);
      return;
    }

    setGeoStatus('locating');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setGeoStatus('granted');
      },
      (error) => {
        setUserCoords(null);
        if (error.code === 1) {
          // PERMISSION_DENIED
          setGeoStatus('denied');
        } else if (error.code === 2) {
          // POSITION_UNAVAILABLE
          setGeoStatus('unavailable');
        } else if (error.code === 3) {
          // TIMEOUT
          setGeoStatus('timeout');
        } else {
          setGeoStatus('unavailable');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // ขอสิทธิ์พิกัดอัตโนมัติเมื่อเข้าสู่หน้า Near-Me
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // TanStack Query: ยิงคำขอไปยัง Real Backend API เฉพาะเมื่อได้พิกัดจริงแล้วเท่านั้น
  const {
    data: apiResult,
    isLoading: isApiLoading,
    isError: isApiError,
    error: apiError,
    refetch: refetchRecommendations,
    isFetching,
  } = useQuery({
    queryKey: [
      'recommendations',
      'near-me',
      userCoords?.latitude,
      userCoords?.longitude,
      selectedRadius,
    ],
    queryFn: () => {
      if (!userCoords) throw new Error('พิกัดตำแหน่งจริงยังไม่พร้อมใช้งาน');
      return recommendationApi.getNearMe({
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        radiusKm: selectedRadius,
        limit: 10,
      });
    },
    enabled: userCoords !== null,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // TanStack Mutation: บันทึกสถิติการคลิกคำแนะนำ (Recommendation Click Tracking)
  const clickMutation = useMutation({
    mutationFn: (recommendationId: string) => recommendationApi.recordClick(recommendationId),
    onError: (err) => {
      console.warn('[ClickTelemetry] Failed to record click:', err);
    },
  });

  // จัดเตรียมรายการร้านค้าจาก Real Backend API
  const rawMerchants: RecommendedMerchant[] = useMemo(() => {
    if (apiResult?.recommendations && apiResult.recommendations.length > 0) {
      return apiResult.recommendations.map(mapApiItemToCard);
    }

    return [];
  }, [apiResult]);

  // กรองและเรียงลำดับร้านค้า
  const filteredMerchants = useMemo(() => {
    let list = [...rawMerchants];

    // กรองตามหมวดหมู่
    if (selectedCategory !== 'ทั้งหมด') {
      list = list.filter((m) => m.category === selectedCategory);
    }

    // กรองตามคำค้นหา
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.address.toLowerCase().includes(q)
      );
    }

    // เรียงลำดับ
    list.sort((a, b) => {
      if (sortBy === 'ai') return b.aiScore - a.aiScore;
      if (sortBy === 'distance') return a.distanceKm - b.distanceKm;
      if (sortBy === 'rating') return b.ratingStars - a.ratingStars;
      if (sortBy === 'popular') return b.transactions24h - a.transactions24h;
      return 0;
    });

    return list;
  }, [rawMerchants, selectedCategory, searchQuery, sortBy]);

  // จัดการเมื่อคลิกการ์ดร้านค้า (Silent Background Tracking & Non-blocking Navigation)
  const handleCardClick = (merchant: RecommendedMerchant) => {
    // 1. บันทึกสถิติการคลิกในเบื้องหลังเฉพาะเมื่อมี Token (ป้องกัน 401 ลบเซสชัน)
    if (merchant.recommendationId && isAuthenticated && token) {
      try {
        clickMutation.mutate(merchant.recommendationId);
      } catch (err) {
        console.warn('[ClickTelemetry] Mutation trigger error:', err);
      }
    }

    // 2. ดำเนินการนำทางไปยังหน้ารายละเอียดร้านค้า (URL: /citizen/merchant-detail ไม่เปิดเผย ID ใน URL)
    navigate(APP_ROUTES.CITIZEN_MERCHANT_DETAIL, {
      state: {
        merchantId: merchant.id,
        shopName: merchant.name,
        latitude: merchant.latitude,
        longitude: merchant.longitude,
        category: merchant.category,
        distanceKm: merchant.distanceKm,
        ratingStars: merchant.ratingStars,
      },
    });
  };

  // ปุ่มรีเฟรช GPS: ขอพิกัดใหม่และ refetch API
  const handleRefreshGps = () => {
    requestLocation();
    if (userCoords) {
      refetchRecommendations();
    }
  };

  const isDetectingGps =
    (geoStatus === 'prompting' || geoStatus === 'locating') && !userCoords;

  const isGpsDenied = geoStatus === 'denied' && !userCoords;
  const isGpsError =
    (geoStatus === 'unavailable' || geoStatus === 'timeout' || geoStatus === 'unsupported') &&
    !userCoords;

  const isQueryLoading =
    userCoords !== null && (isApiLoading || isFetching);

  const isBackendFailed =
    userCoords !== null && isApiError && !isQueryLoading;

  const isNoMerchantsFound =
    userCoords !== null &&
    !isQueryLoading &&
    !isBackendFailed &&
    rawMerchants.length === 0;

  const isSuccessReal =
    userCoords !== null &&
    !isQueryLoading &&
    !isBackendFailed &&
    filteredMerchants.length > 0;

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-14 font-sans text-ink">
      {/* 1. TOP HEADER & HERO SECTION (Coinbase Minimalist Style) */}
      <section className="bg-white border-b border-hairline px-4 sm:px-6 lg:px-8 pt-5 pb-5 shadow-2xs">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-brand-blue-light border border-blue-200 text-brand-blue text-xs font-semibold">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Discovery 2.0</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-emerald-50 border border-emerald-200 text-status-success text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>สิทธิ์รัฐ 60%</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                ร้านค้าแนะนำใกล้ฉัน
              </h1>
              <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
                ค้นหาร้านอาหารและบริการร่วมโครงการ Co-pay 60/40 ด้วยระบบปัญญาประดิษฐ์จากตำแหน่งจริงของคุณ
              </p>
            </div>

            {/* แสดงพิกัด GPS จริง หรือสถานะค้นหา พร้อมปุ่มรีเฟรช */}
            <div className="flex items-center gap-2 self-start sm:self-auto bg-surface-soft border border-hairline px-3 py-1.5 rounded-pill">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    geoStatus === 'granted'
                      ? 'bg-status-success'
                      : geoStatus === 'locating' || geoStatus === 'prompting'
                      ? 'bg-amber-400'
                      : 'bg-status-error'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    geoStatus === 'granted'
                      ? 'bg-status-success'
                      : geoStatus === 'locating' || geoStatus === 'prompting'
                      ? 'bg-amber-400'
                      : 'bg-status-error'
                  }`}
                ></span>
              </span>
              <span
                className="text-xs text-ink-body font-medium truncate max-w-[220px] sm:max-w-xs"
                title={readableAddress || undefined}
              >
                {userCoords
                  ? readableAddress || 'กำลังระบุที่อยู่...'
                  : geoStatus === 'locating' || geoStatus === 'prompting'
                  ? 'กำลังขอสิทธิ์ GPS...'
                  : geoStatus === 'denied'
                  ? 'ปฏิเสธสิทธิ์ตำแหน่ง'
                  : 'ไม่พบพิกัด GPS'}
              </span>
              <button
                onClick={handleRefreshGps}
                disabled={geoStatus === 'locating'}
                className="p-1 hover:bg-white rounded-full transition text-ink-muted hover:text-ink disabled:opacity-50"
                title="รีเฟรชพิกัด GPS และดึงข้อมูลใหม่"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    geoStatus === 'locating' || isFetching ? 'animate-spin' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* แถบค้นหาหลัก (Coinbase Large Pill Search Bar) */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อร้านค้า เมนู หรือทำเลใกล้เคียง..."
              className="w-full bg-surface-soft border border-hairline rounded-pill pl-11 pr-4 py-2.5 text-xs sm:text-sm text-ink placeholder:text-ink-muted focus:bg-white focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink bg-white px-2 py-0.5 rounded-pill border border-hairline"
              >
                ล้าง
              </button>
            )}
          </div>

          {/* ชิปเลือกรัศมีและหมวดหมู่ */}
          <div className="space-y-2.5 pt-1">
            {/* เลือกรัศมีค้นหา */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span className="text-ink-muted font-medium shrink-0 flex items-center gap-1">
                <Navigation className="h-3 w-3" /> รัศมี:
              </span>
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedRadius(opt.value)}
                  className={`px-3 py-1 rounded-pill shrink-0 font-medium transition ${
                    selectedRadius === opt.value
                      ? 'bg-ink text-white font-semibold shadow-xs'
                      : 'bg-surface-soft text-ink-body hover:bg-gray-200 border border-hairline'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* เลือกหมวดหมู่อาหาร */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span className="text-ink-muted font-medium shrink-0 flex items-center gap-1">
                <Store className="h-3 w-3" /> หมวดหมู่:
              </span>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-pill shrink-0 font-medium transition ${
                    selectedCategory === cat
                      ? 'bg-brand-blue text-white font-semibold shadow-xs'
                      : 'bg-surface-soft text-ink-body hover:bg-gray-200 border border-hairline'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. SUB-BAR: CONTROLS */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* จำนวนผลลัพธ์และการจัดเรียง */}
        <div className="flex items-center gap-2 text-ink-muted">
          <span>
            พบ <strong className="font-mono text-ink font-semibold">{filteredMerchants.length}</strong> ร้านค้า
          </span>
          <span>•</span>
          <div className="flex items-center gap-1">
            <span>เรียงตาม:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white border border-hairline rounded-pill px-2.5 py-1 text-xs text-ink font-medium focus:outline-none focus:border-brand-blue cursor-pointer"
            >
              <option value="ai">✨ คะแนนแนะนำ AI</option>
              <option value="distance">📍 ระยะทางใกล้สุด</option>
              <option value="rating">⭐ ดาวเฉลี่ยสูงสุด</option>
              <option value="popular">🔥 ยอดนิยมวันนี้</option>
            </select>
          </div>
        </div>
      </section>

      {/* 3. MAIN CONTENT AREA (Distinct State Handlers) */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ============================================================== */}
        {/* STATE 1: กำลังขอสิทธิ์และค้นหาพิกัด GPS จริง (Detecting GPS) */}
        {/* ============================================================== */}
        {isDetectingGps && (
          <div className="bg-white border border-hairline rounded-card p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm my-6 space-y-4">
            <div className="h-14 w-14 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center mx-auto border border-blue-200 animate-pulse">
              <Compass className="h-7 w-7 animate-spin" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink">
                กำลังระบุตำแหน่งพิกัด GPS จริงของคุณ...
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
                กรุณาอนุญาตสิทธิ์ Location ในเบราว์เซอร์ เพื่อให้ระบบ AI สามารถค้นหาร้านค้าที่อยู่ใกล้เคียงได้ถูกต้องแม่นยำ
              </p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STATE 2: ผู้ใช้ปฏิเสธสิทธิ์ตำแหน่ง (Location Permission Denied) */}
        {/* ============================================================== */}
        {isGpsDenied && (
          <div className="bg-white border border-hairline rounded-card p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm my-6 space-y-4">
            <div className="h-14 w-14 rounded-full bg-red-50 text-status-error flex items-center justify-center mx-auto border border-red-200">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink">
                คุณปฏิเสธการเข้าถึงตำแหน่งที่ตั้ง (Location Permission Denied)
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted mt-1.5 leading-relaxed">
                ระบบแนะนำร้านค้าจำเป็นต้องใช้พิกัดจริงของคุณเพื่อค้นหาร้านใกล้เคียง กรุณาเปิดการอนุญาตในไอคอนแม่กุญแจบนแถบ Address Bar ของเบราว์เซอร์
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={handleRefreshGps}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-pill bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>ลองขอสิทธิ์ใหม่อีกครั้ง</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STATE 3: สัญญาณ GPS ขัดข้อง หรือหมดเวลา (GPS Unavailable / Timeout) */}
        {/* ============================================================== */}
        {isGpsError && (
          <div className="bg-white border border-hairline rounded-card p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm my-6 space-y-4">
            <div className="h-14 w-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink">
                ไม่สามารถระบุตำแหน่งพิกัด GPS ได้ในขณะนี้
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted mt-1.5 leading-relaxed">
                {geoStatus === 'timeout'
                  ? 'หมดเวลาในการค้นหาสัญญาณดาวเทียม GPS (Timeout) กรุณากดลองค้นหาใหม่อีกครั้ง'
                  : 'สัญญาณ GPS ของอุปกรณ์ขัดข้อง หรือไม่สามารถเข้าถึงตำแหน่งจริงได้ กรุณาตรวจสอบการเปิดใช้งาน Location Service'}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={handleRefreshGps}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-pill bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>ลองค้นหาพิกัดใหม่</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STATE 4: กำลังโหลดข้อมูลจาก API (Loading Shimmer Skeleton) */}
        {/* ============================================================== */}
        {isQueryLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="bg-white border border-hairline rounded-card p-5 space-y-4 animate-pulse shadow-xs"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 rounded-pill w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded-pill w-1/2"></div>
                  </div>
                  <div className="h-6 w-16 bg-gray-200 rounded-pill shrink-0"></div>
                </div>
                <div className="h-14 bg-gray-100 rounded-2xl"></div>
                <div className="flex justify-between items-center pt-2 border-t border-hairline/60">
                  <div className="h-4 bg-gray-200 rounded-pill w-1/3"></div>
                  <div className="h-8 bg-gray-200 rounded-pill w-24"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ============================================================== */}
        {/* STATE 5: เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว (Backend Connection Failed) */}
        {/* ============================================================== */}
        {isBackendFailed && (
          <div className="bg-white border border-hairline rounded-card p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm my-6 space-y-4">
            <div className="h-14 w-14 rounded-full bg-red-50 text-status-error flex items-center justify-center mx-auto border border-red-200">
              <WifiOff className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink">
                ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์แนะนำร้านค้าได้
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
                {(apiError as any)?.response?.data?.message ||
                  (apiError as Error)?.message ||
                  'เกิดข้อผิดพลาดในการติดต่อกับเซิร์ฟเวอร์ กรุณาตรวจสอบว่าเซิร์ฟเวอร์ Backend (พอร์ต 5000) กำลังทำงานอยู่'}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => refetchRecommendations()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>ลองเชื่อมต่อใหม่</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STATE 6: ไม่พบร้านค้าในรัศมีที่เลือก (Genuine Empty State) */}
        {/* ============================================================== */}
        {isNoMerchantsFound && (
          <div className="bg-white border border-hairline rounded-card p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm my-6 space-y-4">
            <div className="h-14 w-14 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center mx-auto border border-blue-200">
              <MapPinOff className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink">
                ไม่พบร้านค้าใกล้ตำแหน่งของคุณในรัศมีที่กำหนด
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted mt-1.5 leading-relaxed">
                ไม่พบร้านค้าที่เข้าร่วมโครงการ Co-pay 60/40 ในรัศมี {selectedRadius} กม. รอบพิกัดของคุณ ลองขยายรัศมีการค้นหาเป็น 20 กม. หรือสลับหมวดหมู่ร้านค้า
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              {selectedRadius < 20 && (
                <button
                  onClick={() => setSelectedRadius(20)}
                  className="px-4 py-2 rounded-pill bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition shadow-sm"
                >
                  ขยายรัศมีเป็น 20 กม.
                </button>
              )}
              <button
                onClick={handleRefreshGps}
                className="px-4 py-2 rounded-pill bg-surface-soft text-ink-body border border-hairline text-xs font-semibold hover:bg-gray-200 transition"
              >
                รีเฟรชพิกัด GPS
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STATE 7: แสดงการ์ดร้านค้าจริงจาก Real API */}
        {/* ============================================================== */}
        {isSuccessReal && filteredMerchants.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMerchants.map((merchant) => (
              <article
                key={merchant.id}
                onClick={() => handleCardClick(merchant)}
                className="bg-white border border-hairline hover:border-blue-300 rounded-card p-4 sm:p-5 transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col justify-between group space-y-3.5 relative overflow-hidden"
              >
                {/* แถบด้านบน: ชื่อร้านค้า + หมวดหมู่ + ป้าย Co-pay */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-brand-blue bg-brand-blue-light px-2 py-0.5 rounded-pill border border-blue-200">
                        {merchant.category}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-status-success bg-emerald-50 px-2 py-0.5 rounded-pill border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Co-pay 60/40</span>
                      </span>
                    </div>

                    <h2 className="text-sm sm:text-base font-bold text-ink group-hover:text-brand-blue transition truncate">
                      {merchant.name}
                    </h2>

                    <p className="text-xs text-ink-muted truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-ink-muted shrink-0" />
                      <span>{merchant.address}</span>
                    </p>
                  </div>

                  {/* ป้ายแสดงระยะทาง (JetBrains Mono) */}
                  <div className="text-right shrink-0">
                    <div className="inline-flex items-center gap-1 bg-surface-soft border border-hairline px-2.5 py-1 rounded-pill font-mono font-numeric text-xs font-bold text-ink">
                      <Navigation className="h-3 w-3 text-brand-blue" />
                      <span>{merchant.formattedDistance}</span>
                    </div>
                  </div>
                </div>

                {/* กล่องไฮไลต์เหตุผล AI Explainability (Coinbase AI Callout Box) */}
                <div className="bg-brand-blue-light/60 border border-blue-200/80 rounded-2xl p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-brand-blue text-xs font-bold">
                    <Sparkles className="h-3.5 w-3.5 fill-brand-blue text-brand-blue shrink-0" />
                    <span>เหตุผลที่ AI แนะนำ:</span>
                  </div>
                  <p className="text-xs text-ink-body leading-relaxed">
                    {merchant.aiReason}
                  </p>
                </div>

                {/* แถบล่าง: สถิติดาว + ยอดนิยม + ปุ่มกด Action */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-hairline/60 text-xs">
                  {/* ดาวและยอดขาย 24 ชม. */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 font-mono font-numeric font-semibold text-ink">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span>{merchant.ratingStars.toFixed(1)}</span>
                      <span className="text-[11px] text-ink-muted font-normal">
                        ({merchant.reviewCount})
                      </span>
                    </div>

                    <div className="hidden xs:flex items-center gap-1 text-[11px] text-ink-muted">
                      <TrendingUp className="h-3 w-3 text-status-success" />
                      <span className="font-mono font-numeric">{merchant.transactions24h}</span> บิลวันนี้
                    </div>
                  </div>

                  {/* ปุ่ม CTA ไปร้านค้า / สแกนจ่าย */}
                  <div className="flex items-center gap-1 text-xs font-semibold text-brand-blue group-hover:translate-x-0.5 transition">
                    <span>ดูรายละเอียด</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

      </main>
    </div>
  );
};

export default CitizenNearMePage;
