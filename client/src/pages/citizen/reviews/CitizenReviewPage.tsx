import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Star,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Store,
  AlertTriangle,
  Send,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  reviewApi,
  CreateReviewPayload,
  ReviewSubmissionResult,
  UserReviewHistoryItem,
} from '../../../services/reviewApi';
import { APP_ROUTES } from '../../../constants/routes';

/**
 * ข้อมูลการทำรายการที่ส่งต่อผ่าน React Router Navigation State
 */
export interface ReviewNavigationState {
  transactionId: string;
  shopName?: string;
  totalAmount?: number;
  citizenPaidAmount?: number;
  timestamp?: string;
}

const QUICK_FEEDBACK_TAGS = [
  'อาหารอร่อย',
  'บริการเป็นกันเอง',
  'สะอาดถูกสุขอนามัย',
  'คุ้มค่าคุ้มราคา',
  'สินค้าคุณภาพดี',
  'รวดเร็วทันใจ',
];

const RATING_DESCRIPTIONS: Record<number, { label: string; color: string }> = {
  1: { label: 'ควรปรับปรุง', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  2: { label: 'พอใช้', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  3: { label: 'ปานกลาง', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  4: { label: 'ดีมาก', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  5: { label: 'ยอดเยี่ยม ประทับใจมาก', color: 'text-emerald-800 bg-emerald-100/70 border-emerald-300' },
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export const CitizenReviewPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 1. รับข้อมูลธุรกรรมผ่าน Navigation State หรือ Query Parameter
  const navState = location.state as ReviewNavigationState | null;
  const transactionId = navState?.transactionId || searchParams.get('tx') || '';
  const shopName = navState?.shopName || 'ร้านค้าสมาชิกโครงการ THAI Please';
  const totalAmount = navState?.totalAmount;
  const citizenPaidAmount = navState?.citizenPaidAmount;
  const transactionTimestamp = navState?.timestamp;

  // ฟอร์มสถานะ
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>('');
  const [submissionSuccessData, setSubmissionSuccessData] = useState<ReviewSubmissionResult | null>(null);

  // สถานะข้อผิดพลาดเฉพาะกรณี (Error flags)
  const [isDuplicateError, setIsDuplicateError] = useState(false);
  const [isExpiredError, setIsExpiredError] = useState(false);
  const [isUnauthorizedError, setIsUnauthorizedError] = useState(false);
  const [isForbiddenError, setIsForbiddenError] = useState(false);
  const [generalErrorMessage, setGeneralErrorMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // 1. ตรวจสอบสถานะการประเมินรีวิวเดิมจาก Backend (Existing Review Check)
  const {
    data: checkReviewData,
    isLoading: isCheckingReview,
    isError: isCheckError,
    error: checkError,
  } = useQuery({
    queryKey: ['transaction-review-check', transactionId],
    queryFn: () => reviewApi.getReviewByTransaction(transactionId),
    enabled: Boolean(transactionId),
    retry: false,
  });

  const existingReview = checkReviewData?.review;
  const isAlreadyReviewed = Boolean(checkReviewData?.reviewed && existingReview);

  // 1.1 ดึงประวัติการประเมินรีวิวทั้งหมดของผู้ใช้งาน (User Review History) เฉพาะเมื่อไม่มี transactionId
  const {
    data: myReviews,
    isLoading: isLoadingMyReviews,
    isError: isMyReviewsError,
    error: myReviewsError,
    refetch: refetchMyReviews,
    isFetching: isFetchingMyReviews,
  } = useQuery<UserReviewHistoryItem[]>({
    queryKey: ['my-reviews'],
    queryFn: () => reviewApi.getMyReviews(),
    enabled: !transactionId,
    retry: 1,
  });

  useEffect(() => {
    if (!isCheckError || !checkError) return;
    const err = checkError as any;
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message;
    if (status === 401) {
      setIsUnauthorizedError(true);
    } else if (status === 403) {
      setIsForbiddenError(true);
    } else if (status !== 404) {
      setGeneralErrorMessage(message || 'ไม่สามารถตรวจสอบข้อมูลรีวิวได้');
    }
  }, [isCheckError, checkError]);

  // 2. คำนวณเวลานับถอยหลัง 24 ชั่วโมงจาก timestamp ของธุรกรรม
  const [remainingTimeText, setRemainingTimeText] = useState<string>('');
  const [isClientSideExpired, setIsClientSideExpired] = useState<boolean>(false);

  useEffect(() => {
    if (!transactionTimestamp) return;

    const calculateRemaining = () => {
      const createdAtMs = new Date(transactionTimestamp).getTime();
      const expiresAtMs = createdAtMs + TWENTY_FOUR_HOURS_MS;
      const diffMs = expiresAtMs - Date.now();

      if (diffMs <= 0) {
        setIsClientSideExpired(true);
        setRemainingTimeText('หมดเวลาประเมินรีวิวแล้ว');
        return;
      }

      setIsClientSideExpired(false);
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setRemainingTimeText(`เหลือเวลาประเมินอีก ${hours} ชม. ${minutes} นาที`);
    };

    calculateRemaining();
    const timer = setInterval(calculateRemaining, 60000);
    return () => clearInterval(timer);
  }, [transactionTimestamp]);

  // 3. Mutation ส่งรีวิวไปยัง Backend (POST /api/reviews)
  const reviewMutation = useMutation({
    mutationFn: (payload: CreateReviewPayload) => reviewApi.submitReview(payload),
    onSuccess: (data) => {
      setSubmissionSuccessData(data);
      setGeneralErrorMessage(null);
      setIsDuplicateError(false);
      setIsExpiredError(false);
      queryClient.invalidateQueries({ queryKey: ['transaction-review-check', transactionId] });
    },
    onError: (err: any) => {
      const status = err.response?.status;
      const message = err.response?.data?.message || err.message || 'ไม่สามารถบันทึกรีวิวได้';

      if (status === 409 || message.includes('ได้รับการประเมินรีวิวไปแล้ว')) {
        setIsDuplicateError(true);
      } else if (status === 400 && message.includes('หมดอายุแล้ว')) {
        setIsExpiredError(true);
      } else if (status === 401) {
        setIsUnauthorizedError(true);
      } else if (status === 403) {
        setIsForbiddenError(true);
      } else {
        setGeneralErrorMessage(message);
      }
    },
  });

  // จัดการการส่งฟอร์มรีวิว
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionId) return;

    // ตรวจสอบความถูกต้องเบื้องต้นก่อนส่ง (Validation)
    if (ratingStars < 1 || ratingStars > 5) {
      setGeneralErrorMessage('กรุณาระบุคะแนนดาวระหว่าง 1 ถึง 5 ดาว');
      return;
    }

    if (reviewText.length > 1000) {
      setGeneralErrorMessage('ข้อความรีวิวต้องไม่เกิน 1,000 ตัวอักษร');
      return;
    }

    setGeneralErrorMessage(null);
    setIsDuplicateError(false);
    setIsExpiredError(false);

    const payload: CreateReviewPayload = {
      transactionId,
      ratingStars,
      reviewText: reviewText.trim() ? reviewText.trim() : null,
    };

    reviewMutation.mutate(payload);
  };

  const handleAddQuickTag = (tag: string) => {
    setReviewText((prev) => {
      if (!prev) return tag;
      if (prev.includes(tag)) return prev;
      return `${prev} ${tag}`;
    });
  };

  const currentDisplayRating = hoverRating || ratingStars;
  const ratingMeta = RATING_DESCRIPTIONS[currentDisplayRating] || RATING_DESCRIPTIONS[5];

  // =========================================================================
  // VIEW: 1. กรณีไม่มีข้อมูล transactionId ใน State -> แสดงหน้าประวัติการประเมินร้านค้า (Review History Page)
  // =========================================================================
  if (!transactionId) {
    const isUnauthorized = (myReviewsError as any)?.response?.status === 401;

    return (
      <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
        {/* Top Header Bar */}
        <div className="bg-white border-b border-hairline px-4 sm:px-6 py-3.5 mb-5 shadow-2xs">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="inline-flex items-center space-x-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink bg-surface-soft hover:bg-slate-200 transition shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>กลับกระเป๋าเงิน</span>
            </button>
            <h1 className="text-sm sm:text-base font-bold text-ink text-center flex-1">
              ประวัติการประเมินร้านค้า
            </h1>
            <button
              type="button"
              onClick={() => refetchMyReviews()}
              className="p-1.5 text-ink-muted hover:text-ink rounded-full bg-surface-soft hover:bg-slate-200 transition shrink-0"
              title="รีเฟรชประวัติรีวิว"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetchingMyReviews ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <main className="mx-auto w-full max-w-2xl px-4 sm:px-6 space-y-4">
          {/* Subheader banner */}
          <div className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-brand-blue-light border border-blue-200 text-brand-blue text-xs font-semibold">
                  <Star className="h-3 w-3 fill-brand-blue" />
                  <span>Verified Purchase</span>
                </span>
                <span className="text-xs text-ink-muted">
                  เฉพาะรายการที่เคยรีวิวแล้ว
                </span>
              </div>
              <h2 className="text-base font-bold text-ink">
                ร้านค้าที่คุณเคยให้คะแนนและความคิดเห็น
              </h2>
            </div>
            {myReviews && (
              <span className="self-start sm:self-auto px-3 py-1 rounded-pill bg-emerald-50 border border-emerald-200 text-status-success font-mono font-numeric text-xs font-bold shrink-0">
                ประเมินแล้ว {myReviews.length} รายการ
              </span>
            )}
          </div>

          {/* 1. Unauthorized State (401) */}
          {isUnauthorized && (
            <div className="rounded-card border border-amber-200 bg-white p-8 text-center space-y-3.5 shadow-xs">
              <div className="h-12 w-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-ink">กรุณาเข้าสู่ระบบ</h3>
              <p className="text-xs text-ink-muted max-w-sm mx-auto">
                เซสชันของคุณหมดอายุหรือยังไม่ได้เข้าสู่ระบบ กรุณาเข้าสู่ระบบเพื่อดูประวัติการประเมินร้านค้า
              </p>
              <button
                onClick={() => navigate(APP_ROUTES.LOGIN)}
                className="px-5 py-2.5 rounded-full bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-semibold shadow-xs transition"
              >
                เข้าสู่ระบบ
              </button>
            </div>
          )}

          {/* 2. Loading State */}
          {isLoadingMyReviews && !isUnauthorized && (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="rounded-card border border-hairline bg-white p-5 space-y-3 animate-pulse shadow-xs"
                >
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-gray-200 rounded-pill w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded-pill w-20"></div>
                  </div>
                  <div className="h-12 bg-gray-100 rounded-xl"></div>
                  <div className="flex justify-between items-center pt-2">
                    <div className="h-3 bg-gray-200 rounded-pill w-1/4"></div>
                    <div className="h-3 bg-gray-200 rounded-pill w-24"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. Error State */}
          {isMyReviewsError && !isUnauthorized && (
            <div className="rounded-card border border-red-200 bg-white p-8 text-center space-y-3.5 shadow-xs">
              <div className="h-12 w-12 rounded-full bg-red-50 text-status-error flex items-center justify-center mx-auto border border-red-200">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-ink">ไม่สามารถโหลดประวัติการประเมินได้</h3>
              <p className="text-xs text-ink-muted max-w-sm mx-auto">
                {(myReviewsError as any)?.response?.data?.message ||
                  (myReviewsError as Error)?.message ||
                  'เกิดข้อผิดพลาดในการติดต่อกับเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง'}
              </p>
              <button
                onClick={() => refetchMyReviews()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>ลองใหม่อีกครั้ง</span>
              </button>
            </div>
          )}

          {/* 4. Empty State (No Reviews Found) */}
          {!isLoadingMyReviews && !isMyReviewsError && myReviews && myReviews.length === 0 && (
            <div className="rounded-card border border-hairline bg-white p-8 sm:p-12 text-center space-y-4 shadow-xs">
              <div className="h-14 w-14 rounded-full bg-blue-50 text-brand-blue border border-blue-200 flex items-center justify-center mx-auto shadow-xs">
                <Star className="h-7 w-7 text-brand-blue" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-ink">
                  ยังไม่มีประวัติการประเมินร้านค้า
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted max-w-md mx-auto leading-relaxed">
                  คุณสามารถร่วมประเมินและให้คะแนนร้านค้าได้หลังทำรายการชำระเงิน Co-pay สำเร็จ โดยกดปุ่ม "ประเมินร้านค้า" ในหน้าสลิปการทำรายการภายใน 24 ชั่วโมง
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5 justify-center">
                <button
                  onClick={() => navigate(APP_ROUTES.CITIZEN_TRANSACTIONS)}
                  className="rounded-full bg-brand-blue hover:bg-brand-blue-hover text-white px-5 py-2.5 text-xs font-semibold shadow-xs transition"
                >
                  ดูประวัติการทำธุรกรรม
                </button>
                <button
                  onClick={() => navigate(APP_ROUTES.CITIZEN_NEAR_ME)}
                  className="rounded-full border border-hairline bg-surface-soft hover:bg-gray-200 text-ink px-4 py-2.5 text-xs font-medium transition"
                >
                  ค้นหาร้านค้าใกล้ฉัน
                </button>
              </div>
            </div>
          )}

          {/* 5. Success State: List of Real Reviewed Transactions Only */}
          {!isLoadingMyReviews && !isMyReviewsError && myReviews && myReviews.length > 0 && (
            <div className="space-y-3.5">
              {myReviews.map((rev: UserReviewHistoryItem) => {
                const formattedDate = new Date(rev.createdAt).toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <article
                    key={rev.reviewId}
                    className="rounded-card border border-hairline hover:border-blue-200 bg-white p-4 sm:p-5 shadow-xs space-y-3 transition"
                  >
                    {/* ส่วนหัว: ชื่อร้านค้า + ดาวที่ให้ */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-brand-blue-light text-brand-blue flex items-center justify-center shrink-0">
                          <Store className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-base font-bold text-ink truncate">
                            {rev.merchantName}
                          </h3>
                          <span className="text-[11px] text-ink-muted block font-mono">
                            ประเมินเมื่อ {formattedDate} น.
                          </span>
                        </div>
                      </div>

                      {/* ดาวคะแนน (1–5) */}
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

                    {/* ข้อความความคิดเห็น */}
                    {rev.reviewText ? (
                      <div className="rounded-xl bg-surface-soft p-3 border border-hairline/80">
                        <p className="text-xs text-ink-body italic leading-relaxed">
                          "{rev.reviewText}"
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-ink-muted italic py-0.5">
                        (ไม่ได้ระบุข้อความความคิดเห็นเพิ่มเติม)
                      </p>
                    )}

                    {/* แถบด้านล่าง: ยอดชำระ Co-pay + ป้าย Verified */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-hairline/70 text-[11px] text-ink-muted">
                      <span className="inline-flex items-center gap-1 text-status-success font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>รีวิวโดยผู้ซื้อจริง (Verified Purchase)</span>
                      </span>

                      {rev.citizenPaidAmount !== undefined && (
                        <span className="font-mono text-ink">
                          ยอดชำระ Co-pay: <strong className="text-brand-blue font-bold">฿{rev.citizenPaidAmount.toFixed(2)}</strong>
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  // =========================================================================
  // VIEW: 2. สถานะกำลังตรวจสอบข้อมูลรีวิวเดิมจาก Backend (Loading Verification)
  // =========================================================================
  if (isCheckingReview) {
    return (
      <div className="min-h-[80vh] bg-surface-soft py-10 px-4 flex items-center justify-center font-sans text-ink">
        <div className="w-full max-w-md rounded-card border border-hairline bg-white p-8 shadow-sm text-center space-y-4 animate-fadeIn">
          <Loader2 className="h-10 w-10 text-brand-blue animate-spin mx-auto" />
          <h2 className="text-base font-bold text-ink">กำลังตรวจสอบข้อมูลการประเมิน...</h2>
          <p className="text-xs text-ink-muted leading-relaxed">
            กรุณารอสักครู่ ระบบกำลังตรวจสอบสิทธิ์และประวัติการประเมินรีวิวของธุรกรรม
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: 3. กรณีเคยประเมินรีวิวรายการนี้ไปแล้ว (Already Reviewed View)
  // =========================================================================
  if (isAlreadyReviewed && existingReview) {
    const formattedReviewedDate = new Date(existingReview.createdAt).toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
        {/* Top Header Bar */}
        <div className="bg-white border-b border-hairline px-4 sm:px-6 py-3.5 mb-5 shadow-2xs">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center space-x-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink bg-surface-soft hover:bg-slate-200 transition shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>ย้อนกลับ</span>
            </button>
            <h1 className="text-sm sm:text-base font-bold text-ink text-center flex-1">
              ประเมินความพึงพอใจร้านค้า
            </h1>
            <div className="w-10 sm:w-16 shrink-0" />
          </div>
        </div>

        <main className="mx-auto w-full max-w-lg px-4 sm:px-6 space-y-4">
          {/* ข้อมูลร้านค้า */}
          <div className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-start sm:items-center space-x-3 min-w-0">
              <div className="h-11 w-11 rounded-2xl bg-brand-blue-light text-brand-blue flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-bold text-ink leading-snug break-words">
                  {existingReview.merchantName || shopName}
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  รายการธุรกรรมชำระเงิน Co-pay
                </p>
              </div>
            </div>

            {(totalAmount !== undefined || citizenPaidAmount !== undefined) && (
              <div className="pt-2.5 border-t border-hairline flex flex-wrap items-center justify-between gap-1.5 text-xs text-ink-muted">
                <span>ยอดชำระร่วม Co-pay:</span>
                <span className="font-mono font-medium text-ink">
                  {citizenPaidAmount !== undefined ? `฿${citizenPaidAmount.toFixed(2)}` : ''}{' '}
                  {totalAmount !== undefined ? `(ยอดรวม ฿${totalAmount.toFixed(2)})` : ''}
                </span>
              </div>
            )}
          </div>

          {/* การ์ดสถานะเคยประเมินแล้ว */}
          <div className="rounded-card border border-emerald-200 bg-white p-6 sm:p-7 shadow-sm text-center space-y-4 animate-fadeIn">
            <div className="h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <span className="inline-flex items-center space-x-1.5 rounded-pill bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold border border-emerald-200 mb-2">
                <span>บันทึกการประเมินแล้ว</span>
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-ink">
                คุณประเมินรายการนี้แล้ว
              </h2>
              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                ตามข้อกำหนดระบบ 1 รายการชำระเงินสามารถส่งการประเมินได้ 1 ครั้ง เพื่อรักษามาตรฐานความถูกต้องของคะแนนร้านค้า
              </p>
            </div>

            {/* กล่องแสดงผลรีวิวเดิม */}
            <div className="rounded-2xl bg-surface-soft p-4 border border-hairline text-left space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2.5">
                <div>
                  <span className="text-[11px] text-ink-muted block">คะแนนที่คุณให้ไว้</span>
                  <div className="flex items-center space-x-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4.5 w-4.5 ${
                          star <= existingReview.ratingStars
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-200 fill-slate-100'
                        }`}
                      />
                    ))}
                    <span className="text-xs font-bold text-ink ml-1.5">
                      {existingReview.ratingStars} / 5
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] text-ink-muted block">วันที่ประเมิน</span>
                  <span className="text-xs text-ink-body font-mono mt-1 block">
                    {formattedReviewedDate} น.
                  </span>
                </div>
              </div>

              {existingReview.reviewText ? (
                <div>
                  <span className="text-[11px] text-ink-muted block mb-1">ความคิดเห็นของคุณ:</span>
                  <p className="text-xs text-ink bg-white p-3 rounded-xl border border-hairline italic leading-relaxed">
                    "{existingReview.reviewText}"
                  </p>
                </div>
              ) : (
                <p className="text-xs text-ink-muted italic text-center py-1">
                  (ไม่มีข้อความความคิดเห็นเพิ่มเติม)
                </p>
              )}
            </div>

            {/* ปุ่มนำทาง (ซ่อนฟอร์ม ไม่เปิดให้ส่งซ้ำ) */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => navigate(APP_ROUTES.CITIZEN_TRANSACTIONS)}
                className="w-full rounded-full bg-brand-blue hover:bg-brand-blue-hover text-white py-3 text-xs font-semibold shadow-xs transition active:scale-98"
              >
                ดูประวัติการทำรายการ
              </button>
              <button
                type="button"
                onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
                className="w-full rounded-full border border-hairline bg-white hover:bg-surface-soft text-ink py-2.5 text-xs font-medium transition"
              >
                กลับสู่หน้าหลักกระเป๋าเงิน
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // VIEW: 2. กรณีส่งรีวิวสำเร็จเรียบร้อย (Success State)
  // =========================================================================
  if (submissionSuccessData) {
    return (
      <div className="min-h-[85vh] bg-surface-soft py-8 px-4 font-sans text-ink">
        <div className="max-w-lg mx-auto space-y-5 animate-fadeIn">
          <div className="rounded-card border border-emerald-200 bg-white p-6 sm:p-8 shadow-sm text-center space-y-5">
            <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-ink mt-1">
                ขอบคุณสำหรับการประเมินร้านค้า
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                รีวิวของคุณช่วยสนับสนุนร้านค้าชุมชนและเป็นประโยชน์ต่อผู้ใช้งานท่านอื่น
              </p>
            </div>

            {/* การ์ดสรุปผลรีวิวที่บันทึก */}
            <div className="rounded-2xl bg-surface-soft p-4 border border-hairline text-left space-y-3">
              <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                <div>
                  <span className="text-[11px] text-ink-muted block">ร้านค้า</span>
                  <span className="text-sm font-bold text-ink">
                    {submissionSuccessData.merchantName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-ink-muted block">คะแนนที่คุณให้</span>
                  <div className="flex items-center space-x-1 justify-end">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= submissionSuccessData.ratingStars
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {submissionSuccessData.reviewText && (
                <div>
                  <span className="text-[11px] text-ink-muted block mb-1">ความคิดเห็น:</span>
                  <p className="text-xs text-ink bg-white p-3 rounded-xl border border-hairline italic">
                    "{submissionSuccessData.reviewText}"
                  </p>
                </div>
              )}

              <div className="pt-1 flex items-center justify-between text-xs">
                <span className="text-ink-muted">คะแนนเฉลี่ยใหม่ของร้าน:</span>
                <span className="font-bold text-brand-blue flex items-center space-x-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span>{submissionSuccessData.newMerchantAverageRating.toFixed(1)} / 5.0</span>
                  <span className="text-[11px] text-ink-muted font-normal">
                    ({submissionSuccessData.totalMerchantReviews} รีวิว)
                  </span>
                </span>
              </div>
            </div>

            {/* ปุ่มนำทาง */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
                className="w-full rounded-full bg-brand-blue hover:bg-brand-blue-hover text-white py-3 text-xs font-semibold shadow-xs transition active:scale-98"
              >
                กลับสู่หน้าหลักกระเป๋าเงิน
              </button>
              <button
                onClick={() => navigate(APP_ROUTES.CITIZEN_TRANSACTIONS)}
                className="w-full rounded-full border border-hairline bg-white hover:bg-surface-soft text-ink py-2.5 text-xs font-medium transition"
              >
                ดูประวัติการทำรายการ
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: 3. กรณีรีวิวซ้ำ หรือ สิทธิ์หมดอายุ (Special Error States)
  // =========================================================================
  if (isDuplicateError || isExpiredError || isForbiddenError) {
    return (
      <div className="min-h-[85vh] bg-surface-soft py-10 px-4 font-sans text-ink flex items-center justify-center">
        <div className="w-full max-w-md rounded-card border border-hairline bg-white p-6 sm:p-8 shadow-sm text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            {isExpiredError ? <Clock className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
          </div>

          <h2 className="text-lg font-bold text-ink">
            {isDuplicateError && 'รายการนี้ได้รับการประเมินรีวิวไปแล้ว'}
            {isExpiredError && 'สิทธิ์การประเมินรีวิวหมดอายุแล้ว'}
            {isForbiddenError && 'ไม่มีสิทธิ์ประเมินรีวิวสำหรับรายการนี้'}
          </h2>

          <p className="text-xs text-ink-muted leading-relaxed">
            {isDuplicateError &&
              'ตามข้อกำหนดระบบ 1 ธุรกรรมที่ชำระเงินสำเร็จสามารถประเมินรีวิวได้ 1 ครั้ง เพื่อรักษาความน่าเชื่อถือของคะแนนร้านค้า'}
            {isExpiredError &&
              'การประเมินรีวิวแบบ Verified Purchase สามารถทำได้ภายใน 24 ชั่วโมงหลังชำระเงินสำเร็จเท่านั้น'}
            {isForbiddenError &&
              'ท่านสามารถประเมินรีวิวได้เฉพาะธุรกรรมที่ทำรายการผ่านบัญชีของท่านเท่านั้น'}
          </p>

          <div className="pt-3 flex flex-col gap-2">
            <button
              onClick={() => navigate(APP_ROUTES.CITIZEN_TRANSACTIONS)}
              className="w-full rounded-full bg-brand-blue hover:bg-brand-blue-hover text-white py-2.5 text-xs font-semibold shadow-xs transition"
            >
              ดูประวัติการทำรายการ
            </button>
            <button
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="w-full rounded-full border border-hairline bg-white hover:bg-surface-soft text-ink-muted py-2 text-xs font-medium transition"
            >
              กลับกระเป๋าเงิน
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: 4. ฟอร์มประเมินรีวิวปกติ (Normal Form View)
  // =========================================================================
  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-hairline px-4 sm:px-6 py-3.5 mb-5 shadow-2xs">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center space-x-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink-muted hover:text-ink bg-surface-soft hover:bg-slate-200 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>ย้อนกลับ</span>
          </button>
          <h1 className="text-sm sm:text-base font-bold text-ink">
            ประเมินความพึงพอใจร้านค้า
          </h1>
          <div className="w-16" /> {/* spacer */}
        </div>
      </div>

      <main className="mx-auto w-full max-w-lg px-4 sm:px-6 space-y-4">
        {/* Banner แจ้งเตือนข้อผิดพลาดทั่วไป */}
        {generalErrorMessage && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 flex items-start space-x-2.5 animate-fadeIn">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">ไม่สามารถส่งผลประเมินได้</span>
              <span>{generalErrorMessage}</span>
            </div>
          </div>
        )}

        {/* Banner กรณีผู้ใช้ยังไม่ได้ล็อกอิน */}
        {isUnauthorizedError && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-800 flex items-center justify-between">
            <span>กรุณาเข้าสู่ระบบก่อนส่งรีวิวร้านค้า</span>
            <button
              onClick={() => navigate(APP_ROUTES.LOGIN)}
              className="rounded-full bg-brand-blue text-white px-3 py-1.5 font-semibold text-xs hover:bg-brand-blue-hover"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        )}

        {/* การ์ดข้อมูลร้านค้าและเวลานับถอยหลัง 24 ชม. */}
        <div className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* ข้อมูลร้านค้า */}
            <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
              <div className="h-11 w-11 rounded-2xl bg-brand-blue-light text-brand-blue flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-bold text-ink leading-snug break-words">
                  {shopName}
                </h2>
                <p className="text-xs text-ink-muted mt-0.5 leading-normal">
                  ประเมินความพึงพอใจการใช้บริการ
                </p>
              </div>
            </div>

            {/* ป้ายเตือนเวลา 24 ชม. */}
            {remainingTimeText && (
              <div className="flex items-center self-start sm:self-auto shrink-0 pt-0.5 sm:pt-0">
                <span
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-pill text-xs font-medium border whitespace-nowrap ${
                    isClientSideExpired
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>{remainingTimeText}</span>
                </span>
              </div>
            )}
          </div>

          {/* รายละเอียดธุรกรรมอ้างอิง */}
          {(totalAmount !== undefined || citizenPaidAmount !== undefined) && (
            <div className="pt-2.5 border-t border-hairline flex flex-wrap items-center justify-between gap-1.5 text-xs text-ink-muted">
              <span>ยอดชำระร่วม Co-pay:</span>
              <span className="font-mono font-medium text-ink">
                {citizenPaidAmount !== undefined ? `฿${citizenPaidAmount.toFixed(2)}` : ''}{' '}
                {totalAmount !== undefined ? `(ยอดรวม ฿${totalAmount.toFixed(2)})` : ''}
              </span>
            </div>
          )}
        </div>

        {/* ฟอร์มประเมินรีวิว */}
        <form onSubmit={handleSubmit} className="rounded-card border border-hairline bg-white p-5 sm:p-6 shadow-sm space-y-5">
          {/* ส่วนที่ 1: การให้คะแนนดาว (Interactive Star Rating) */}
          <div className="text-center space-y-2.5">
            <label className="text-xs font-semibold text-ink-muted block uppercase tracking-wider">
              ระดับความพึงพอใจโดยรวม <span className="text-rose-500">*</span>
            </label>

            <div className="flex justify-center items-center space-x-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={reviewMutation.isPending || isClientSideExpired}
                  onClick={() => setRatingStars(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1.5 transition-transform hover:scale-115 active:scale-95 disabled:cursor-not-allowed focus:outline-hidden"
                  title={`${star} ดาว`}
                >
                  <Star
                    className={`h-9 w-9 sm:h-10 sm:w-10 transition-colors ${
                      star <= currentDisplayRating
                        ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                        : 'fill-slate-100 text-slate-200'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* ป้ายคำอธิบายคะแนนดาว */}
            <div className="inline-block">
              <span
                className={`inline-block px-3 py-1 rounded-pill text-xs font-bold border transition ${ratingMeta.color}`}
              >
                {currentDisplayRating} ดาว — {ratingMeta.label}
              </span>
            </div>
          </div>

          {/* เส้นคั่น */}
          <div className="border-t border-hairline" />

          {/* ส่วนที่ 2: แท็กด่วนช่วยพิมพ์ (Quick Tags) */}
          <div className="space-y-2">
            <span className="text-xs text-ink-muted font-medium flex items-center space-x-1">
              <Sparkles className="h-3.5 w-3.5 text-brand-blue" />
              <span>ความประทับใจที่คุณอยากบอกต่อ (คลิกเพื่อเพิ่มข้อความ):</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_FEEDBACK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  disabled={reviewMutation.isPending || isClientSideExpired}
                  onClick={() => handleAddQuickTag(tag)}
                  className="rounded-full border border-hairline bg-surface-soft hover:bg-slate-200 text-ink-body px-2.5 py-1 text-xs transition disabled:opacity-50"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* ส่วนที่ 3: กล่องข้อความรีวิว (Optional Review Text) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="review-textarea" className="font-semibold text-ink">
                ความคิดเห็นเพิ่มเติม <span className="font-normal text-ink-muted">(ไม่บังคับ)</span>
              </label>
              <span
                className={`font-mono text-[11px] ${
                  reviewText.length > 900 ? 'text-amber-600 font-bold' : 'text-ink-muted'
                }`}
              >
                {reviewText.length} / 1000
              </span>
            </div>

            <textarea
              id="review-textarea"
              rows={4}
              maxLength={1000}
              disabled={reviewMutation.isPending || isClientSideExpired}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="บอกเล่าประสบการณ์ ความสะอาด รสชาติอาหาร หรือการบริการ เพื่อเป็นข้อมูลอันมีค่าให้ร้านค้าและเพื่อนผู้ใช้สิทธิ์ Co-pay..."
              className="w-full rounded-2xl border border-hairline bg-surface-soft/40 p-3.5 text-xs text-ink focus:bg-white focus:border-brand-blue focus:outline-hidden transition leading-relaxed resize-none disabled:opacity-60"
            />
          </div>

          {/* ส่วนที่ 4: ปุ่มส่งผลการประเมิน (Submit Action) */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={reviewMutation.isPending || isClientSideExpired}
              className="w-full flex items-center justify-center space-x-2 rounded-full bg-brand-blue hover:bg-brand-blue-hover text-white py-3 text-xs font-semibold shadow-xs transition active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {reviewMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>กำลังบันทึกผลการประเมิน...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>ส่งผลการประเมินร้านค้า</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-ink-muted leading-tight">
              การประเมินรีวิวได้รับการยืนยันสิทธิ์จากระบบ Co-pay 60/40 เพื่อความโปร่งใสและเป็นธรรม
            </p>
          </div>
        </form>
      </main>
    </div>
  );
};
