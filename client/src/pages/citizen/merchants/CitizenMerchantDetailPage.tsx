import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Store,
  MapPin,
  Navigation,
  Star,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import { APP_ROUTES } from '../../../constants/routes';
import { reviewApi, MerchantReviewsData } from '../../../services/reviewApi';

/**
 * คำนวณระยะทางระหว่าง 2 พิกัดด้วยสูตร Haversine Formula (กิโลเมตร)
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // รัศมีโลกเฉลี่ยในหน่วยกิโลเมตร
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * จัดรูปแบบระยะทางสำหรับแสดงผลในภาษาไทย
 */
function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} ม.`;
  }
  return `${distanceKm.toFixed(1)} กม.`;
}

interface RouterState {
  merchantId?: string;
  shopName?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  distanceKm?: number;
  ratingStars?: number;
}

export const CitizenMerchantDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as RouterState) || {};

  // ดึง merchantId จาก Router State หรือกู้คืนจาก sessionStorage เมื่อผู้ใช้รีเฟรชหน้าจอ
  const merchantId = useMemo(() => {
    if (navState.merchantId) {
      sessionStorage.setItem('selected_merchant_id', navState.merchantId);
      if (navState.shopName) sessionStorage.setItem('selected_shop_name', navState.shopName);
      if (typeof navState.latitude === 'number') sessionStorage.setItem('selected_lat', String(navState.latitude));
      if (typeof navState.longitude === 'number') sessionStorage.setItem('selected_lng', String(navState.longitude));
      if (navState.category) sessionStorage.setItem('selected_cat', navState.category);
      return navState.merchantId;
    }
    return sessionStorage.getItem('selected_merchant_id');
  }, [navState.merchantId, navState.shopName, navState.latitude, navState.longitude, navState.category]);

  // พิกัด GPS จริงของผู้ใช้จาก Browser Geolocation API
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [geoLoading, setGeoLoading] = useState<boolean>(true);
  const [geoError, setGeoError] = useState<string | null>(null);

  // ขอพิกัด GPS จริงของผู้ใช้งานสำหรับคำนวณระยะทาง
  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('อุปกรณ์ของคุณไม่รองรับการระบุพิกัด Geolocation');
      setGeoLoading(false);
      return;
    }

    setGeoLoading(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === 1) {
          setGeoError('ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง GPS');
        } else if (err.code === 2) {
          setGeoError('ไม่สามารถตรวจจับตำแหน่ง GPS ได้');
        } else if (err.code === 3) {
          setGeoError('หมดเวลาค้นหาตำแหน่ง GPS');
        } else {
          setGeoError('เกิดข้อผิดพลาดในการขอตำแหน่ง');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    requestUserLocation();
  }, [requestUserLocation]);

  // TanStack Query: ดึงข้อมูลรีวิวและสถิติร้านค้าจริงจาก Real API
  const {
    data: reviewData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<MerchantReviewsData>({
    queryKey: ['merchant-reviews', merchantId],
    queryFn: () => {
      if (!merchantId) throw new Error('ไม่พบรหัสร้านค้า (merchantId)');
      return reviewApi.getMerchantReviews(merchantId, 1, 20);
    },
    enabled: !!merchantId,
    retry: 1,
  });

  // ข้อมูลพิกัดและหมวดหมู่ของร้านค้า
  const merchantLat =
    navState.latitude ??
    (sessionStorage.getItem('selected_lat') ? Number(sessionStorage.getItem('selected_lat')) : undefined);
  const merchantLng =
    navState.longitude ??
    (sessionStorage.getItem('selected_lng') ? Number(sessionStorage.getItem('selected_lng')) : undefined);
  const category =
    navState.category || sessionStorage.getItem('selected_cat') || 'ร้านค้าสมาชิก Co-pay';

  const hasCoordinates =
    typeof merchantLat === 'number' &&
    typeof merchantLng === 'number' &&
    !isNaN(merchantLat) &&
    !isNaN(merchantLng);

  // คำนวณระยะทางแบบ Real-time หากมีทั้งพิกัดผู้ใช้และพิกัดร้านค้า
  const realDistanceKm = useMemo(() => {
    if (userLocation && hasCoordinates) {
      return calculateHaversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        merchantLat,
        merchantLng
      );
    }
    return navState.distanceKm || null;
  }, [userLocation, hasCoordinates, merchantLat, merchantLng, navState.distanceKm]);

  // ลิงก์สำหรับเปิดแผนที่ Google Maps Directions
  const googleMapsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${merchantLat},${merchantLng}`
    : null;

  // ตรวจสอบกรณีเป็น 404 (ไม่พบร้านค้า)
  const isNotFound = isError && (error as any)?.response?.status === 404;

  // ชื่อร้านค้าจาก API หรือจากแคช State
  const shopName =
    reviewData?.merchant?.shopName ||
    navState.shopName ||
    sessionStorage.getItem('selected_shop_name') ||
    'ร้านค้าสมาชิก Co-pay';
  const averageRating = reviewData?.merchant?.averageRating ?? navState.ratingStars ?? 0;
  const totalReviews = reviewData?.merchant?.totalReviews ?? 0;

  // ปุ่มย้อนกลับ: ใช้ browser history back เพื่อรักษา State และเซสชัน
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(APP_ROUTES.CITIZEN_NEAR_ME);
    }
  };

  // กรณีเข้า URL โดยตรงโดยไม่มีการเลือกร้านค้าใดๆ มาก่อน (Direct access without merchantId)
  if (!merchantId) {
    return (
      <div className="min-h-screen bg-surface-soft pb-24 font-sans text-ink">
        <nav className="bg-white border-b border-hairline px-4 sm:px-6 py-3.5 sticky top-0 z-20 shadow-2xs">
          <button
            onClick={() => navigate(APP_ROUTES.CITIZEN_NEAR_ME)}
            className="inline-flex items-center gap-1.5 text-ink hover:text-brand-blue font-semibold transition py-1 pr-2 text-xs sm:text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>กลับหน้าร้านค้าใกล้ฉัน</span>
          </button>
        </nav>
        <main className="max-w-md mx-auto px-4 pt-16 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center mx-auto border border-blue-200">
            <Store className="h-8 w-8" />
          </div>
          <h1 className="text-lg font-bold text-ink">ยังไม่ได้เลือกร้านค้า</h1>
          <p className="text-xs text-ink-muted leading-relaxed">
            กรุณาเลือกร้านค้าที่คุณสนใจจากหน้าร้านค้าใกล้ฉัน (AI Near-Me) เพื่อดูข้อมูลและรีวิว
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate(APP_ROUTES.CITIZEN_NEAR_ME)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-pill bg-brand-blue text-white text-xs sm:text-sm font-semibold hover:bg-brand-blue-hover transition shadow-sm"
            >
              <Store className="h-4 w-4" />
              <span>ค้นหาร้านค้าใกล้ฉัน</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-16 font-sans text-ink">
      {/* 1. TOP NAVIGATION & BREADCRUMB BAR */}
      <nav className="bg-white border-b border-hairline px-4 sm:px-6 lg:px-8 py-3.5 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-ink-muted">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-ink hover:text-brand-blue font-semibold transition py-1 pr-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>ร้านค้าใกล้ฉัน</span>
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            <span className="truncate max-w-[180px] sm:max-w-xs text-ink-body font-medium">
              {shopName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-emerald-50 border border-emerald-200 text-status-success text-xs font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Co-pay 60/40</span>
            </span>
          </div>
        </div>
      </nav>

      {/* 2. MAIN CONTENT CONTAINER */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* ============================================================== */}
        {/* CASE 1: กำลังโหลดข้อมูล (Loading State) */}
        {/* ============================================================== */}
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="bg-white border border-hairline rounded-card p-6 sm:p-8 space-y-4">
              <div className="h-5 bg-gray-200 rounded-pill w-1/4"></div>
              <div className="h-8 bg-gray-200 rounded-lg w-2/3"></div>
              <div className="h-4 bg-gray-200 rounded-pill w-1/3"></div>
            </div>
            <div className="bg-white border border-hairline rounded-card p-6 space-y-3">
              <div className="h-6 bg-gray-200 rounded-pill w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded-lg w-full"></div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* CASE 2: ไม่พบร้านค้าในระบบ (404 Not Found) */}
        {/* ============================================================== */}
        {!isLoading && isNotFound && (
          <div className="bg-white border border-hairline rounded-card p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm my-8 space-y-4">
            <div className="h-16 w-16 rounded-full bg-rose-50 text-status-error flex items-center justify-center mx-auto border border-rose-200">
              <Store className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg sm:text-xl font-bold text-ink">
                ไม่พบข้อมูลร้านค้าในระบบ
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                ไม่พบข้อมูลร้านค้านี้ในระบบ Co-pay ร้านค้าอาจยังไม่ได้รับการอนุมัติ หรือรหัสไม่ถูกต้อง
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => navigate(APP_ROUTES.CITIZEN_NEAR_ME)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-pill bg-brand-blue text-white text-xs sm:text-sm font-semibold hover:bg-brand-blue-hover transition shadow-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>กลับหน้าร้านค้าใกล้ฉัน</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* CASE 3: เกิดข้อผิดพลาดในการโหลด API ทั่วไป (Error State) */}
        {/* ============================================================== */}
        {!isLoading && isError && !isNotFound && (
          <div className="bg-white border border-red-200 rounded-card p-6 sm:p-8 text-center max-w-lg mx-auto shadow-sm my-6 space-y-4">
            <div className="h-12 w-12 rounded-full bg-red-50 text-status-error flex items-center justify-center mx-auto border border-red-200">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink">
                ไม่สามารถดึงข้อมูลร้านค้าได้
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
                {(error as any)?.response?.data?.message ||
                  (error as Error)?.message ||
                  'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์'}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>ลองใหม่อีกครั้ง</span>
              </button>
              <button
                onClick={() => navigate(APP_ROUTES.CITIZEN_NEAR_ME)}
                className="px-4 py-2 rounded-pill bg-surface-soft text-ink-body border border-hairline text-xs font-semibold hover:bg-gray-200 transition"
              >
                กลับหน้าร้านค้าใกล้ฉัน
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* CASE 4: แสดงข้อมูลร้านค้าสำเร็จ (Success Detail State) */}
        {/* ============================================================== */}
        {!isLoading && !isError && (
          <div className="space-y-6">
            {/* HERO SECTION: ข้อมูลหลักของร้านค้า */}
            <div className="bg-white border border-hairline rounded-card p-6 sm:p-8 shadow-sm space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue bg-brand-blue-light px-2.5 py-0.5 rounded-pill border border-blue-200">
                    <Store className="h-3 w-3" />
                    <span>{category}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-status-success bg-emerald-50 px-2.5 py-0.5 rounded-pill border border-emerald-200">
                    <ShieldCheck className="h-3 w-3" />
                    <span>ร้านค้าเข้าร่วมโครงการ</span>
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                  {shopName}
                </h1>

                {/* สรุปคะแนนดาว */}
                <div className="flex items-center gap-2 text-xs sm:text-sm text-ink-body pt-0.5">
                  <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-pill text-amber-800 font-mono font-numeric font-bold">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    <span>{averageRating > 0 ? averageRating.toFixed(1) : 'ใหม่'}</span>
                  </div>
                  <span className="text-ink-muted">
                    ({totalReviews.toLocaleString()} รีวิว)
                  </span>
                </div>
              </div>
            </div>

            {/* LOCATION & DIRECTIONS SECTION */}
            <div className="bg-white border border-hairline rounded-card p-6 sm:p-8 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-hairline pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-pill bg-brand-blue-light text-brand-blue">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm sm:text-base font-bold text-ink">
                    การเดินทางและแผนที่นำทาง
                  </h2>
                </div>
              </div>

              {/* กรณีมีพิกัดร้านค้าครบถ้วน */}
              {hasCoordinates ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-full bg-surface-soft border border-hairline shrink-0 text-brand-blue">
                      <Navigation className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs text-ink-muted font-medium">
                        ระยะห่างจากตำแหน่งปัจจุบันของคุณ
                      </div>
                      <div className="text-base sm:text-lg font-bold font-mono font-numeric text-ink">
                        {realDistanceKm !== null
                          ? formatDistance(realDistanceKm)
                          : geoLoading
                          ? 'กำลังตรวจจับ GPS...'
                          : 'ไม่พบพิกัดของคุณ'}
                      </div>
                      {geoError && (
                        <div className="text-[11px] text-status-error flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>{geoError}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ปุ่มเปิด Google Maps Directions */}
                  {googleMapsUrl && (
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-pill bg-brand-blue hover:bg-brand-blue-hover text-white text-xs sm:text-sm font-semibold transition shadow-sm"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>เปิดแผนที่นำทาง (Google Maps)</span>
                    </a>
                  )}
                </div>
              ) : (
                /* กรณีกดเข้าลิงก์ตรงและยังไม่มีพิกัดร้านค้า */
                <div className="bg-surface-soft border border-hairline rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <Sparkles className="h-3.5 w-3.5 text-brand-blue" />
                      <span>ต้องการดูระยะทางและแผนที่นำทาง?</span>
                    </div>
                    <p className="text-xs text-ink-muted">
                      ค้นหาร้านค้าผ่านหน้าร้านค้าใกล้ฉันเพื่อคำนวณระยะทางจากตำแหน่งของคุณแบบ Real-time
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(APP_ROUTES.CITIZEN_NEAR_ME)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition"
                  >
                    <span>ค้นหาร้านใกล้ฉัน</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* REVIEWS & RATINGS SECTION */}
            <div className="bg-white border border-hairline rounded-card p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-hairline pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-pill bg-amber-50 text-amber-600">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm sm:text-base font-bold text-ink">
                    รีวิวและความคิดเห็นจากผู้ใช้สิทธิ
                  </h2>
                </div>
                <span className="text-xs text-ink-muted font-numeric">
                  {totalReviews} รายการ
                </span>
              </div>

              {/* RATING BREAKDOWN */}
              {totalReviews > 0 && reviewData?.ratingBreakdown && (
                <div className="bg-surface-soft border border-hairline rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                  <div className="text-center sm:text-left sm:border-r border-hairline sm:pr-4">
                    <div className="text-3xl sm:text-4xl font-bold font-mono font-numeric text-ink">
                      {averageRating.toFixed(1)}
                    </div>
                    <div className="flex justify-center sm:justify-start gap-1 text-amber-500 my-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= Math.round(averageRating)
                              ? 'fill-amber-400 text-amber-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-xs text-ink-muted">
                      จากทั้งหมด {totalReviews} การประเมิน
                    </div>
                  </div>

                  {/* สรุปแท่งคะแนน 5 ดาว ถึง 1 ดาว */}
                  <div className="sm:col-span-2 space-y-1.5 text-xs">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = reviewData.ratingBreakdown[star] || 0;
                      const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="w-10 text-right text-ink-muted font-numeric font-mono">
                            {star} ดาว
                          </span>
                          <div className="flex-1 h-2 bg-gray-200 rounded-pill overflow-hidden">
                            <div
                              className="h-full bg-amber-400 rounded-pill transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="w-8 text-right text-ink-muted font-numeric font-mono text-[11px]">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LIST OF REVIEWS */}
              {reviewData?.reviews && reviewData.reviews.length > 0 ? (
                <div className="space-y-3.5 divide-y divide-hairline">
                  {reviewData.reviews.map((rev) => (
                    <div key={rev.reviewId} className="pt-3.5 first:pt-0 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink">
                            {rev.reviewerName}
                          </span>
                          {rev.isVerifiedPurchase && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-status-success bg-emerald-50 px-2 py-0.5 rounded-pill border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>ผู้ซื้อจริง</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-ink-muted font-mono">
                          {new Date(rev.createdAt).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-amber-500">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3.5 w-3.5 ${
                              star <= rev.ratingStars
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>

                      {rev.reviewText && (
                        <p className="text-xs sm:text-sm text-ink-body leading-relaxed">
                          {rev.reviewText}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-ink-muted space-y-2">
                  <div className="p-3 rounded-full bg-surface-soft inline-block border border-hairline">
                    <MessageSquare className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-ink-body">
                    ยังไม่มีรีวิวสำหรับร้านค้านี้
                  </p>
                  <p className="text-xs text-ink-muted">
                    คุณสามารถร่วมประเมินรีวิวได้หลังทำรายการสแกนจ่าย Co-pay สำเร็จ
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CitizenMerchantDetailPage;
