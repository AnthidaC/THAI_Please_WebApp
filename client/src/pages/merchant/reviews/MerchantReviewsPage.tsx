import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  MessageSquare,
  QrCode,
  RefreshCw,
  AlertTriangle,
  Store,
  ShieldCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Lock,
  User,
} from 'lucide-react';
import { reviewApi, MerchantReviewsData, MerchantReviewItem } from '../../../services/reviewApi';
import { getMerchantHistory } from '../../../services/paymentApi';
import { geocodingService } from '../../../services/geocodingService';
import { APP_ROUTES } from '../../../constants/routes';
import { useAuthStore } from '../../../stores/authStore';

export const MerchantReviewsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [page, setPage] = useState<number>(1);
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | 'ALL'>('ALL');

  // 1. ดึงข้อมูลตัวตนและสถิติของร้านค้าจาก Backend ที่ผ่านการตรวจสอบสิทธิ์ (Trusted Context)
  const {
    data: merchantSummary,
    isLoading: isLoadingMerchant,
    isError: isMerchantError,
    error: merchantError,
    refetch: refetchMerchant,
  } = useQuery({
    queryKey: ['merchant-profile'],
    queryFn: () => getMerchantHistory(),
    enabled: isAuthenticated,
    staleTime: 30000,
  });

  const trustedMerchantId = merchantSummary?.merchant?.merchantId;
  const merchantLat = merchantSummary?.merchant?.latitude;
  const merchantLng = merchantSummary?.merchant?.longitude;

  // ดึงชื่อที่อยู่ภาษาไทยจากพิกัด GPS ของร้านค้าผ่าน geocodingService
  const {
    data: readableAddress,
    isLoading: isLoadingAddress,
    isError: isAddressError,
  } = useQuery({
    queryKey: ['merchant-address', merchantLat, merchantLng],
    queryFn: () => geocodingService.getReadableThaiAddress(merchantLat!, merchantLng!),
    enabled: typeof merchantLat === 'number' && typeof merchantLng === 'number',
    staleTime: 1000 * 60 * 30, // แคช 30 นาที
  });

  // 2. ดึงข้อมูลรีวิวและสถิติคะแนนของร้านค้าตนเอง (Read-only) โดยใช้ trusted merchantId
  const {
    data: reviewsData,
    isLoading: isLoadingReviews,
    isError: isReviewsError,
    error: reviewsError,
    refetch: refetchReviews,
    isFetching: isFetchingReviews,
  } = useQuery<MerchantReviewsData>({
    queryKey: ['merchant-customer-reviews', trustedMerchantId, page],
    queryFn: () => reviewApi.getMerchantReviews(trustedMerchantId!, page, 10),
    enabled: Boolean(trustedMerchantId),
    staleTime: 15000,
  });

  const handleRefresh = () => {
    refetchMerchant();
    if (trustedMerchantId) {
      refetchReviews();
    }
  };

  const merchant = reviewsData?.merchant || (merchantSummary?.merchant ? {
    merchantId: merchantSummary.merchant.merchantId,
    shopName: merchantSummary.merchant.shopName,
    averageRating: merchantSummary.merchant.averageRatingStars,
    totalReviews: 0,
  } : null);

  const ratingBreakdown = reviewsData?.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const allReviews = reviewsData?.reviews || [];

  // กรองรีวิวตามดาวที่เลือกดู (Client-side display filter)
  const filteredReviews = allReviews.filter((r) => {
    if (selectedRatingFilter === 'ALL') return true;
    return r.ratingStars === selectedRatingFilter;
  });

  const totalReviewsCount = merchant?.totalReviews ?? allReviews.length;
  const avgRating = merchant?.averageRating ?? 0;

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* ================= 1. PAGE TITLE & ACTION BAR ================= */}
      <div className="mx-auto max-w-6xl px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-2">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <button type="button" onClick={() => navigate(APP_ROUTES.MERCHANT_HOME)} className="flex items-center space-x-1.5 rounded-pill px-2.5 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline shrink-0" title="หน้าแรก"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">หน้าแรก</span></button>
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue shadow-xs">
              <Star className="h-4 w-4 sm:h-5 sm:w-5 fill-brand-blue" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-ink truncate">
                รีวิวและความคิดเห็นจากลูกค้า
              </h1>
              <p className="text-[11px] sm:text-xs text-ink-muted truncate">
                สรุปคะแนนความพึงพอใจและข้อเสนอแนะจากผู้ซื้อสิทธิ์ร่วมจ่าย Co-pay 60/40
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.MERCHANT_POS_QR)}
              className="inline-flex items-center space-x-1.5 rounded-pill bg-brand-blue px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-hover transition active:scale-95"
            >
              <QrCode className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xs:inline">สร้าง QR รับเงิน</span>
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center space-x-1.5 rounded-pill bg-surface-soft border border-hairline px-2.5 sm:px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-gray-200 hover:text-ink transition"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-brand-blue ${isFetchingReviews ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-3.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        {/* ================= 2. UNAUTHORIZED STATE ================= */}
        {!isAuthenticated && (
          <div className="rounded-card border border-amber-200 bg-white p-8 text-center space-y-3.5 shadow-xs">
            <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="text-base font-bold text-ink">เฉพาะบัญชีร้านค้าเท่านั้น</h2>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              กรุณาเข้าสู่ระบบด้วยบัญชีร้านค้าเพื่อดูสรุปคะแนนและรีวิวของร้านท่าน
            </p>
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.LOGIN)}
              className="px-5 py-2.5 rounded-full bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-semibold shadow-xs transition"
            >
              เข้าสู่ระบบร้านค้า
            </button>
          </div>
        )}

        {/* ================= 3. MERCHANT IDENTITY BANNER ================= */}
        {isAuthenticated && merchant && (
          <section
            aria-labelledby="merchant-info-heading"
            className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue shadow-xs">
                <Store className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 id="merchant-info-heading" className="text-sm sm:text-base font-bold text-ink truncate">
                    {merchant.shopName}
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-status-success px-2 py-0.5 rounded-pill border border-emerald-200">
                    <ShieldCheck className="h-3 w-3" />
                    <span>ร้านค้าทางการ THAI Please</span>
                  </span>
                </div>
              </div>
            </div>

            {merchantSummary?.merchant && (
              <div
                className="text-[11px] sm:text-xs text-ink-muted flex items-center space-x-1.5 bg-surface-soft px-3 py-1.5 rounded-pill border border-hairline self-start sm:self-auto shrink-0 max-w-full"
                title={readableAddress || (merchantLat && merchantLng ? `พิกัด ${merchantLat.toFixed(4)}, ${merchantLng.toFixed(4)}` : undefined)}
              >
                <MapPin className="h-3.5 w-3.5 text-brand-blue shrink-0" />
                {isLoadingAddress ? (
                  <span className="text-ink-muted animate-pulse">กำลังระบุที่อยู่ร้านค้า...</span>
                ) : isAddressError ? (
                  <span className="text-ink-muted font-mono">
                    {merchantLat && merchantLng ? `พิกัด ${merchantLat.toFixed(4)}, ${merchantLng.toFixed(4)}` : 'ไม่พบข้อมูลที่ตั้ง'}
                  </span>
                ) : readableAddress ? (
                  <span className="font-medium text-ink truncate max-w-[240px] sm:max-w-xs md:max-w-md">
                    {readableAddress}
                  </span>
                ) : (
                  <span className="text-ink-muted font-mono">
                    {merchantLat && merchantLng ? `พิกัด ${merchantLat.toFixed(4)}, ${merchantLng.toFixed(4)}` : 'ไม่พบข้อมูลที่ตั้ง'}
                  </span>
                )}
              </div>
            )}
          </section>
        )}

        {/* ================= 4. RATINGS OVERVIEW & DISTRIBUTION BARS ================= */}
        {isAuthenticated && (isLoadingMerchant || (isLoadingReviews && !reviewsData)) ? (
          /* Loading Skeleton */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5 rounded-card border border-hairline bg-white p-6 animate-pulse space-y-4">
              <div className="h-6 bg-slate-200 rounded-pill w-1/2 mx-auto"></div>
              <div className="h-14 bg-slate-200 rounded-2xl w-1/3 mx-auto"></div>
              <div className="h-4 bg-slate-200 rounded-pill w-2/3 mx-auto"></div>
            </div>
            <div className="md:col-span-7 rounded-card border border-hairline bg-white p-6 animate-pulse space-y-3">
              {[5, 4, 3, 2, 1].map((s) => (
                <div key={s} className="h-4 bg-slate-200 rounded-pill w-full"></div>
              ))}
            </div>
          </div>
        ) : isAuthenticated && (isMerchantError || isReviewsError) ? (
          /* Error State */
          <div className="rounded-card border border-red-200 bg-white p-8 text-center space-y-3 shadow-xs">
            <div className="h-12 w-12 rounded-full bg-red-50 text-status-error flex items-center justify-center mx-auto border border-red-200">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-ink">ไม่สามารถโหลดข้อมูลรีวิวได้</h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              {(reviewsError as any)?.response?.data?.message ||
                (merchantError as any)?.response?.data?.message ||
                'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง'}
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>ลองใหม่อีกครั้ง</span>
            </button>
          </div>
        ) : isAuthenticated ? (
          /* Ratings Summary Cards */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-stretch">
            {/* 4.1 Average Score Card (Col-span 5) */}
            <div className="md:col-span-5 rounded-card border border-hairline bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between text-center space-y-4">
              <div>
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider block">
                  คะแนนประเมินเฉลี่ย
                </span>
                <div className="mt-2 flex items-baseline justify-center space-x-1 font-mono">
                  <span className="text-4xl sm:text-5xl font-black text-ink tracking-tight font-numeric">
                    {avgRating.toFixed(1)}
                  </span>
                  <span className="text-lg text-ink-muted font-normal">/ 5.0</span>
                </div>

                {/* Stars visual */}
                <div className="flex justify-center items-center space-x-1.5 mt-2.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= Math.round(avgRating)
                          ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                          : 'fill-slate-100 text-slate-200'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-hairline">
                <p className="text-xs text-ink-muted">
                  คำนวณจากรีวิวผู้ซื้อสิทธิ์จริงทั้งหมด{' '}
                  <strong className="text-ink font-semibold">{totalReviewsCount}</strong> รายการ
                </p>
              </div>
            </div>

            {/* 4.2 Rating Distribution Progress Bars (Col-span 7) */}
            <div className="md:col-span-7 rounded-card border border-hairline bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                <span className="text-xs font-bold text-ink">การกระจายคะแนนดาว (5 ถึง 1 ดาว)</span>
                <span className="text-[11px] text-ink-muted">คลิกแท่งคะแนนเพื่อกรองรีวิว</span>
              </div>

              <div className="space-y-2.5">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = ratingBreakdown[stars] || 0;
                  const percentage = totalReviewsCount > 0 ? Math.round((count / totalReviewsCount) * 100) : 0;
                  const isSelected = selectedRatingFilter === stars;

                  return (
                    <button
                      key={stars}
                      type="button"
                      onClick={() => setSelectedRatingFilter(isSelected ? 'ALL' : stars)}
                      className={`w-full flex items-center space-x-3 text-xs p-1.5 rounded-xl transition text-left ${
                        isSelected ? 'bg-blue-50/80 ring-1 ring-brand-blue' : 'hover:bg-surface-soft'
                      }`}
                    >
                      <div className="flex items-center space-x-1 w-14 shrink-0 font-medium text-ink">
                        <span>{stars}</span>
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      </div>

                      {/* Progress Bar Container */}
                      <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            stars >= 4
                              ? 'bg-amber-400'
                              : stars === 3
                              ? 'bg-blue-400'
                              : 'bg-slate-400'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>

                      <div className="w-16 shrink-0 text-right font-mono text-[11px] text-ink-muted">
                        <span>{count}</span>
                        <span className="text-[10px] text-slate-400 ml-1">({percentage}%)</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedRatingFilter !== 'ALL' && (
                <div className="pt-2 border-t border-hairline flex items-center justify-between text-xs">
                  <span className="text-brand-blue font-medium">
                    กำลังกรองเฉพาะ {selectedRatingFilter} ดาว
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedRatingFilter('ALL')}
                    className="text-xs text-ink-muted hover:text-ink underline"
                  >
                    ล้างตัวกรอง
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* ================= 5. CUSTOMER REVIEWS LIST ================= */}
        {isAuthenticated && (
          <section aria-labelledby="customer-reviews-heading" className="space-y-3.5">
            <div className="flex items-center justify-between gap-2 border-b border-hairline pb-2.5">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 text-brand-blue" />
                <h2 id="customer-reviews-heading" className="text-sm sm:text-base font-bold text-ink">
                  ความคิดเห็นและข้อเสนอแนะจากลูกค้า
                </h2>
                {reviewsData && (
                  <span className="px-2 py-0.5 rounded-pill bg-surface-soft border border-hairline text-ink-muted text-xs font-mono">
                    {filteredReviews.length} รายการ
                  </span>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {(['ALL', 5, 4, 3, 2, 1] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSelectedRatingFilter(opt)}
                    className={`px-2.5 py-1 rounded-pill font-medium transition shrink-0 ${
                      selectedRatingFilter === opt
                        ? 'bg-brand-blue text-white shadow-xs'
                        : 'bg-white border border-hairline text-ink-muted hover:bg-surface-soft'
                    }`}
                  >
                    {opt === 'ALL' ? 'ทั้งหมด' : `${opt} ดาว`}
                  </button>
                ))}
              </div>
            </div>

            {/* Empty State: No Reviews */}
            {!isLoadingReviews && filteredReviews.length === 0 && (
              <div className="rounded-card border border-hairline bg-white p-8 sm:p-12 text-center space-y-3 shadow-xs">
                <div className="h-12 w-12 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center mx-auto border border-blue-200">
                  <Star className="h-6 w-6 text-brand-blue" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-ink">
                    {selectedRatingFilter === 'ALL'
                      ? 'ยังไม่มีรีวิวจากลูกค้า'
                      : `ยังไม่มีรีวิวระดับ ${selectedRatingFilter} ดาว`}
                  </h3>
                  <p className="text-xs text-ink-muted max-w-sm mx-auto leading-relaxed">
                    เมื่อผู้ใช้สิทธิ์ Co-pay สแกนชำระเงินและส่งผลประเมินความพึงพอใจ ข้อมูลรีวิวและคะแนนดาวจะปรากฏที่นี่โดยอัตโนมัติ
                  </p>
                </div>
                {selectedRatingFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setSelectedRatingFilter('ALL')}
                    className="px-4 py-2 rounded-full bg-surface-soft hover:bg-slate-200 text-xs font-semibold text-ink transition border border-hairline"
                  >
                    ดูรีวิวทั้งหมด
                  </button>
                )}
              </div>
            )}

            {/* Reviews Cards */}
            {filteredReviews.length > 0 && (
              <div className="space-y-3">
                {filteredReviews.map((rev: MerchantReviewItem) => {
                  const formattedDate = new Date(rev.createdAt).toLocaleString('th-TH', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  const isAnonymous = rev.reviewerName === 'ผู้ใช้งานไม่ประสงค์ออกนาม';

                  return (
                    <article
                      key={rev.reviewId}
                      className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-xs space-y-3 transition hover:border-blue-200"
                    >
                      {/* Review Header: User & Rating */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div
                            className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isAnonymous
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-brand-blue-light text-brand-blue'
                            }`}
                          >
                            <User className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-ink truncate">
                                {rev.reviewerName}
                              </span>
                              {isAnonymous ? (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-pill border border-slate-200 font-medium">
                                  ไม่ประสงค์ออกนาม
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-status-success px-2 py-0.5 rounded-pill border border-emerald-200 font-medium">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  <span>ผู้ซื้อจริง (Verified)</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-ink-muted block font-mono mt-0.5">
                              ประเมินเมื่อ {formattedDate} น.
                            </span>
                          </div>
                        </div>

                        {/* Stars Pill */}
                        <div className="flex items-center space-x-1 shrink-0 bg-surface-soft px-2.5 py-1 rounded-pill border border-hairline">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3.5 w-3.5 ${
                                star <= rev.ratingStars
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-200 fill-slate-100'
                              }`}
                            />
                          ))}
                          <span className="text-xs font-bold text-ink ml-1 font-mono">
                            {rev.ratingStars}/5
                          </span>
                        </div>
                      </div>

                      {/* Review Comment Text */}
                      {rev.reviewText ? (
                        <div className="rounded-xl bg-surface-soft/80 p-3.5 border border-hairline/80">
                          <p className="text-xs text-ink-body italic leading-relaxed">
                            "{rev.reviewText}"
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-ink-muted italic py-0.5">
                          (ผู้ใช้งานไม่ได้ระบุข้อความความคิดเห็นเพิ่มเติม)
                        </p>
                      )}

                      {/* Footer Note */}
                      <div className="pt-2 border-t border-hairline/70 flex items-center justify-between text-[11px] text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-status-success" />
                          <span>ทำรายการสำเร็จผ่านระบบ THAI Please Co-pay</span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          ID: {rev.reviewId.slice(0, 8)}...
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {reviewsData?.pagination && reviewsData.pagination.totalPages > 1 && (
              <div className="pt-3 flex items-center justify-between text-xs border-t border-hairline">
                <span className="text-ink-muted font-mono">
                  หน้า {reviewsData.pagination.page} จาก {reviewsData.pagination.totalPages}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={reviewsData.pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-hairline bg-white hover:bg-surface-soft transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>ก่อนหน้า</span>
                  </button>

                  <button
                    type="button"
                    disabled={reviewsData.pagination.page >= reviewsData.pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(reviewsData.pagination.totalPages, p + 1))}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-hairline bg-white hover:bg-surface-soft transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span>ถัดไป</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default MerchantReviewsPage;
