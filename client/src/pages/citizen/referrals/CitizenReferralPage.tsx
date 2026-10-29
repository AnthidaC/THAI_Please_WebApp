import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Gift,
  Copy,
  Check,
  Share2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Search,
  Info,
  Tag,
  Store,
  Ticket,
} from 'lucide-react';
import {
  referralApi,
  EligibleMerchant,
  MyReferralCode,
  ReferralValidationState,
} from '../../../services/referralApi';
import { APP_ROUTES } from '../../../constants/routes';

export const CitizenReferralPage: React.FC = () => {
  const navigate = useNavigate();

  // 1. Merchant Selection State
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>('');

  // 2. Filter & UI Interaction State
  const [friendFilter, setFriendFilter] = useState<'all' | 'redeemed' | 'pending'>('all');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // 3. Validation Tool State
  const [inputCode, setInputCode] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ReferralValidationState | null>(null);

  // 4. API Queries
  // 4.1 Eligible Merchants Query
  const {
    data: eligibleMerchants = [],
    isLoading: isMerchantsLoading,
    isError: isMerchantsError,
    error: merchantsError,
    refetch: refetchMerchants,
  } = useQuery<EligibleMerchant[]>({
    queryKey: ['referrals', 'eligible-merchants'],
    queryFn: referralApi.getEligibleMerchants,
  });

  // Auto-select first eligible merchant when data arrives if none selected
  const activeMerchantId = selectedMerchantId || (eligibleMerchants.length > 0 ? eligibleMerchants[0].merchantId : '');
  const activeMerchant = useMemo(
    () => eligibleMerchants.find((m) => m.merchantId === activeMerchantId),
    [eligibleMerchants, activeMerchantId]
  );

  // 4.2 My Referral Code Query (เฉพาะร้านที่ยังไม่สำเร็จสิทธิ์)
  const {
    data: referralCodeData,
    isLoading: isCodeLoading,
    isError: isCodeError,
    error: codeError,
    refetch: refetchCode,
  } = useQuery<MyReferralCode>({
    queryKey: ['referrals', 'my-code', activeMerchantId],
    queryFn: () => referralApi.getMyReferralCode(activeMerchantId),
    enabled: Boolean(activeMerchantId && !activeMerchant?.isCredited),
    retry: false,
  });

  // 4.3 Referral Stats & Milestones Query
  const {
    data: statsData,
    isLoading: isStatsLoading,
    isError: isStatsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['referrals', 'stats', activeMerchantId],
    queryFn: () => referralApi.getReferralStats(activeMerchantId),
    enabled: !!activeMerchantId,
  });

  const isCurrentMerchantCredited = Boolean(
    activeMerchant?.isCredited || statsData?.isMerchantCredited
  );

  const isLoading = isMerchantsLoading || (!!activeMerchantId && (isCodeLoading || isStatsLoading));
  const hasNoEligibleMerchants = !isMerchantsLoading && eligibleMerchants.length === 0;

  const summary = statsData?.summary || {
    totalInvited: 0,
    totalRedeemed: 0,
    totalPending: 0,
    milestonesCompleted: 0,
    currentMilestoneProgress: 0,
    milestoneTarget: 5,
    friendsNeededForNextMilestone: 5,
    totalMilestoneCouponsEarned: 0,
  };

  const friendsList = statsData?.invitedFriends || [];
  const earnedCoupons = statsData?.earnedCoupons || [];

  // Filter friends list
  const filteredFriends = useMemo(() => {
    if (friendFilter === 'all') return friendsList;
    return friendsList.filter((f) => f.status === friendFilter);
  }, [friendsList, friendFilter]);

  // Handle Copy Code
  const handleCopyCode = async (code: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2200);
    } catch (err) {
      console.warn('Copy to clipboard failed:', err);
    }
  };

  // Handle Share Code
  const handleShareCode = async () => {
    if (!referralCodeData) return;

    const shareData = {
      title: `โครงการไทยช่วยไทยพลีส - สิทธิ์ชวนเพื่อนร้าน ${referralCodeData.shopName}`,
      text: `ใช้รหัสแนะนำ ${referralCodeData.referralCode} สำหรับการชำระเงินที่ร้าน ${referralCodeData.shopName}`,
      url: referralCodeData.shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShareFeedback('แชร์ลิงก์คำชวนสำเร็จแล้ว');
        setTimeout(() => setShareFeedback(null), 3000);
      } catch (err) {
        // User cancelled share
      }
    } else {
      handleCopyCode(referralCodeData.shareUrl);
      setShareFeedback('คัดลอกลิงก์คำชวนสำหรับส่งให้เพื่อนแล้ว');
      setTimeout(() => setShareFeedback(null), 3000);
    }
  };

  // Handle Real Referral Code Validation
  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (!clean) return;

    setIsValidating(true);
    setValidationResult(null);

    try {
      const res = await referralApi.validateReferralCode(clean, activeMerchantId || undefined);
      setValidationResult({
        code: clean,
        isValid: true,
        referrerName: res.referrerName,
        discountAmount: res.discountAmount,
        shopName: res.shopName,
        sourceDescription: res.sourceDescription,
      });
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'ไม่พบรหัสแนะนำเพื่อนนี้ในระบบ หรือรหัสนี้ถูกใช้งานไปแล้ว';
      setValidationResult({
        code: clean,
        isValid: false,
        errorMessage: msg,
      });
    } finally {
      setIsValidating(false);
    }
  };

  // Calculate milestone progress percentage (0 - 100%)
  const milestonePercent = Math.min(
    100,
    Math.round((summary.currentMilestoneProgress / summary.milestoneTarget) * 100)
  );

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-14 font-sans text-ink">
      {/* 1. TOP HEADER & HERO SECTION */}
      <section className="bg-white border-b border-hairline px-4 sm:px-6 lg:px-8 pt-5 pb-5 shadow-2xs">
        <div className="max-w-4xl mx-auto space-y-3">
          <nav className="flex items-center space-x-1.5 text-xs text-ink-muted">
            <Link to={APP_ROUTES.CITIZEN_HOME} className="transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2">
              หน้าหลัก
            </Link>
            <ChevronRight className="h-3 w-3 text-ink-muted" />
            <Link to={APP_ROUTES.PROFILE} className="transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2">
              โปรไฟล์ &amp; การตั้งค่า
            </Link>
            <ChevronRight className="h-3 w-3 text-ink-muted" />
            <span className="text-brand-blue font-semibold">ระบบชวนเพื่อน (Referral)</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-brand-blue-light border border-blue-200 text-brand-blue text-xs font-semibold">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>UC 2.4.3 Merchant Referral</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-emerald-50 border border-emerald-200 text-status-success text-xs font-semibold">
                  <Gift className="h-3.5 w-3.5" />
                  <span>คูปอง ฿40 ทุก 5 ร้านค้า</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                ระบบชวนเพื่อนสนับสนุนร้านค้าชุมชน (Merchant Referral)
              </h1>
              <p className="text-xs sm:text-sm text-ink-muted mt-0.5 leading-relaxed">
                แนะนำร้านโปรดที่คุณเคยชำระเงินให้เพื่อนใหม่ เมื่อเพื่อนใช้สิทธิ์สำเร็จครบทุก 5 ร้านค้าที่ไม่ซ้ำกัน รับคูปองส่วนลด ฿40 ทันที (อายุ 14 วันหลังได้รับ)
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                refetchMerchants();
                if (activeMerchantId) {
                  refetchCode();
                  refetchStats();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-hairline bg-surface-soft hover:bg-white text-xs font-medium text-ink transition self-start sm:self-auto"
            >
              <RefreshCw className="h-3.5 w-3.5 text-ink-muted" />
              <span>รีเฟรชข้อมูล</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. MAIN CONTENT AREA */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* ============================================================== */}
        {/* STATE: LOADING SKELETON */}
        {/* ============================================================== */}
        {isLoading && (
          <div className="space-y-6 animate-pulse">
            <div className="rounded-card border border-hairline bg-white p-6 space-y-4">
              <div className="h-6 bg-gray-200 rounded-pill w-1/3"></div>
              <div className="h-16 bg-gray-100 rounded-2xl"></div>
              <div className="flex gap-3">
                <div className="h-10 bg-gray-200 rounded-pill w-32"></div>
                <div className="h-10 bg-gray-200 rounded-pill w-32"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-card border border-hairline bg-white p-5 space-y-3">
                  <div className="h-4 bg-gray-200 rounded-pill w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded-pill w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STATE: ERROR STATE */}
        {/* ============================================================== */}
        {!isLoading && (isMerchantsError || isCodeError || isStatsError) && (
          <div className="bg-white border border-hairline rounded-card p-8 sm:p-10 text-center max-w-lg mx-auto shadow-sm space-y-4">
            <div className="h-14 w-14 rounded-full bg-red-50 text-status-error flex items-center justify-center mx-auto border border-red-200">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink">
                ไม่สามารถเชื่อมต่อระบบชวนเพื่อนได้
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
                {(codeError as any)?.response?.data?.message ||
                  (merchantsError as any)?.response?.data?.message ||
                  'การเชื่อมต่อไปยังบริการ Referral ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  refetchMerchants();
                  if (activeMerchantId) {
                    refetchCode();
                    refetchStats();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-pill bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>ลองโหลดใหม่อีกครั้ง</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STATE: EMPTY - USER HAS NO COMPLETED PAYMENTS AT ANY MERCHANT */}
        {/* ============================================================== */}
        {!isLoading && !isMerchantsError && hasNoEligibleMerchants && (
          <div className="bg-white border border-hairline rounded-card p-8 sm:p-12 text-center max-w-xl mx-auto shadow-sm space-y-5">
            <div className="h-16 w-16 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center mx-auto border border-blue-200">
              <Store className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base sm:text-lg font-bold text-ink">
                ยังไม่มีร้านค้าที่คุณเคยชำระเงินสำเร็จ
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed max-w-md mx-auto">
                ตามกฎของโครงการ THAI Please คุณต้องเคยชำระเงินสำเร็จที่ร้านค้าในโครงการอย่างน้อย 1 ครั้ง
                จึงจะสามารถสร้างรหัสคำชวนเพื่อนสำหรับร้านค้านั้นเพื่อรับคูปอง ฿40 ได้
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate(APP_ROUTES.CITIZEN_NEAR_ME)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-pill bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition shadow-xs"
              >
                <Store className="h-4 w-4" />
                <span>ค้นหาร้านค้าใกล้คุณ (Near Me)</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(APP_ROUTES.CITIZEN_SCAN_COPAY)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-pill border border-hairline bg-surface-soft hover:bg-gray-200 text-xs font-semibold text-ink transition"
              >
                <span>สแกนจ่าย Co-pay หน้าร้าน</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MAIN DASHBOARD: USER HAS ELIGIBLE MERCHANTS */}
        {/* ============================================================== */}
        {!isLoading && !isMerchantsError && !hasNoEligibleMerchants && (
          <>
            {/* 2.1 MERCHANT SELECTOR BAR */}
            <div className="bg-white rounded-card border border-hairline p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center border border-blue-200">
                    <Store className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-ink">
                      เลือกร้านค้าที่คุณต้องการแนะนำเพื่อน (Eligible Merchants)
                    </h3>
                    <p className="text-[11px] text-ink-muted">
                      คุณสามารถชวนเพื่อนได้เฉพาะร้านที่คุณเคยชำระเงินสำเร็จแล้วเท่านั้น ({eligibleMerchants.length} ร้าน)
                    </p>
                  </div>
                </div>
              </div>

              {/* Horizontal Pill Selector */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
                {eligibleMerchants.map((merchant) => {
                  const isSelected = merchant.merchantId === activeMerchantId;
                  return (
                    <button
                      key={merchant.merchantId}
                      type="button"
                      onClick={() => setSelectedMerchantId(merchant.merchantId)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition shrink-0 ${
                        isSelected
                          ? 'bg-brand-blue text-white border-brand-blue shadow-xs'
                          : merchant.isCredited
                          ? 'bg-emerald-50 text-status-success border-emerald-200 hover:bg-emerald-100/60'
                          : 'bg-surface-soft text-ink-body border-hairline hover:bg-gray-200'
                      }`}
                    >
                      <span>{merchant.shopName}</span>
                      {merchant.isCredited ? (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-pill font-semibold inline-flex items-center gap-1 ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-emerald-100 text-status-success border border-emerald-200'
                          }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>สำเร็จแล้ว</span>
                        </span>
                      ) : merchant.categoryNameTh ? (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-pill font-normal ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-white text-ink-muted border border-hairline'
                          }`}
                        >
                          {merchant.categoryNameTh}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notification Banner when user already received invitation for this merchant */}
            {statsData?.isUserReferredAtThisMerchant && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-900 animate-fade-in shadow-2xs">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold text-amber-950">สถานะคำเชิญของคุณ: </span>
                  <span>คุณได้รับคำเชิญสำหรับร้านนี้แล้ว</span>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    ตามเงื่อนไขโครงการ ผู้ใช้ 1 คนสามารถรับคำเชิญได้เพียง 1 ครั้งต่อร้านค้า
                  </p>
                </div>
              </div>
            )}

            {/* 2.2 SECTION: ACTIVE REFERRAL CODE CARD */}
            <div className={`rounded-card border p-6 sm:p-7 shadow-sm space-y-5 ${
              isCurrentMerchantCredited
                ? 'bg-emerald-50/40 border-emerald-200'
                : 'bg-white border-hairline'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">
                      รหัสคำชวนเพื่อนสำหรับร้าน: {activeMerchant?.shopName || 'ร้านค้า'}
                    </span>
                    {isCurrentMerchantCredited ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-emerald-100 border border-emerald-300 text-status-success font-mono text-[10px] font-semibold">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>สำเร็จครบสิทธิ์แล้ว (1/1 ร้าน)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-emerald-50 border border-emerald-200 text-status-success font-mono text-[10px] font-semibold">
                        สะสมรับ ฿40
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-ink">
                    {isCurrentMerchantCredited
                      ? 'แนะนำเพื่อนสำหรับร้านนี้สำเร็จเรียบร้อยแล้ว'
                      : 'ชวนเพื่อนใหม่มาใช้บริการที่ร้าน และสะสมไมล์สโตนรับคูปอง ฿40'}
                  </h2>
                  <p className="text-xs text-ink-muted leading-relaxed max-w-xl">
                    {isCurrentMerchantCredited ? (
                      <span>
                        มีเพื่อนนำรหัสคำชวนไปใช้ชำระเงินที่ร้าน <strong>{activeMerchant?.shopName}</strong> สำเร็จแล้ว
                        ระบบได้นับสะสมร้านค้านี้ในไมล์สโตนของคุณเรียบร้อยแล้ว (จำกัด 1 สิทธิ์สำเร็จต่อ 1 ร้านค้าตลอดโครงการ)
                      </span>
                    ) : (
                      <span>
                        เมื่อเพื่อนใหม่นำรหัสไปใช้ชำระเงินที่ร้าน <strong>{activeMerchant?.shopName}</strong> สำเร็จบิลแรก
                        ระบบจะนับสะสมร้านค้านี้ให้คุณ เมื่อสะสมครบทุก 5 ร้านค้าที่ไม่ซ้ำกัน รับคูปองส่วนลด ฿40.00 ทันที (อายุ 14 วัน)
                      </span>
                    )}
                  </p>
                </div>

                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-2xs ${
                  isCurrentMerchantCredited
                    ? 'bg-emerald-100 text-status-success border-emerald-300'
                    : 'bg-brand-blue-light text-brand-blue border-blue-200'
                }`}>
                  {isCurrentMerchantCredited ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Gift className="h-6 w-6" />
                  )}
                </div>
              </div>

              {/* Code Box Display */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <div className={`flex-1 border rounded-2xl px-5 py-3.5 flex items-center justify-between ${
                  isCurrentMerchantCredited
                    ? 'bg-white border-emerald-200 text-ink-muted'
                    : 'bg-surface-soft border-hairline'
                }`}>
                  <div>
                    <span className="text-[11px] text-ink-muted font-medium block">
                      {isCurrentMerchantCredited ? 'สถานะคำชวนร้านนี้' : 'รหัสพร้อมแชร์'}
                    </span>
                    <span className={`font-mono font-numeric text-2xl font-extrabold tracking-wider ${
                      isCurrentMerchantCredited ? 'text-status-success' : 'text-ink'
                    }`}>
                      {isCurrentMerchantCredited
                        ? 'แนะนำสำเร็จแล้ว'
                        : referralCodeData?.referralCode || 'กำลังสร้างรหัส...'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-pill border font-semibold block ${
                      isCurrentMerchantCredited
                        ? 'text-gray-500 bg-gray-100 border-gray-300'
                        : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    }`}>
                      {isCurrentMerchantCredited ? 'สถานะ: ปิดรับสิทธิ์ (สำเร็จแล้ว)' : 'สถานะ: พร้อมใช้งาน'}
                    </span>
                    <span className="text-[10px] text-ink-muted mt-0.5 block">
                      ร้าน: {activeMerchant?.shopName || '-'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons: Copy & Share */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => referralCodeData && !isCurrentMerchantCredited && handleCopyCode(referralCodeData.referralCode)}
                    disabled={isCurrentMerchantCredited || !referralCodeData}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-pill text-xs font-semibold transition shadow-xs ${
                      isCurrentMerchantCredited
                        ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                        : isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-brand-blue text-white hover:bg-brand-blue-hover active:scale-95'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>คัดลอกแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>คัดลอกรหัส</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={isCurrentMerchantCredited ? undefined : handleShareCode}
                    disabled={isCurrentMerchantCredited || !referralCodeData}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-pill border text-xs font-semibold transition shadow-xs ${
                      isCurrentMerchantCredited
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-ink border-hairline hover:bg-surface-soft active:scale-95'
                    }`}
                  >
                    <Share2 className={`h-4 w-4 ${isCurrentMerchantCredited ? 'text-gray-400' : 'text-brand-blue'}`} />
                    <span>แชร์ให้เพื่อน</span>
                  </button>
                </div>
              </div>

              {shareFeedback && (
                <div className="bg-blue-50 border border-blue-200 rounded-pill px-4 py-2 text-xs text-brand-blue font-medium flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="h-4 w-4 text-brand-blue shrink-0" />
                  <span>{shareFeedback}</span>
                </div>
              )}

              {/* Rules Explanation */}
              <div className="pt-3 border-t border-hairline/60 flex items-start gap-2 text-xs text-ink-muted leading-relaxed">
                <Info className="h-4 w-4 text-brand-blue shrink-0 mt-0.5" />
                <span>
                  <strong>กติการางวัลไมล์สโตน (UC 2.4.3):</strong> เพื่อนต้องเป็นลูกค้าใหม่ที่ไม่เคยชำระเงินที่ร้านค้านี้มาก่อน
                  เมื่อเพื่อนชำระเงินสำเร็จบิลแรก คุณจะสะสมร้านค้านั้น 1 ร้านค้าทันที (จำกัด 1 สิทธิ์สำเร็จต่อ 1 ร้านค้าตลอดโครงการ)
                  เมื่อสะสมครบทุก 5 ร้านค้าที่ไม่ซ้ำกัน รับคูปองส่วนลด ฿40.00 ทันที (อายุ 14 วันหลังได้รับ)
                </span>
              </div>
            </div>

            {/* 2.3 SECTION: MILESTONE TRACKER CARD (4/5, 5/5, 10/5 Progress) */}
            <div className="bg-gradient-to-br from-indigo-900 via-brand-blue to-blue-700 text-white rounded-3xl p-5 sm:p-6 shadow-md relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-white/15 backdrop-blur-md text-amber-300 border border-white/20 text-xs font-bold">
                      <Gift className="h-3.5 w-3.5 text-amber-300" />
                      <span>ไมล์สโตนรางวัลผู้แนะนำ (Referrer Milestone)</span>
                    </div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>สะสมร้านค้าที่ชวนเพื่อนสำเร็จ (5 ร้านค้า = คูปอง ฿40)</span>
                    </h3>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-2 text-right">
                    <span className="text-[11px] text-blue-100 block">คูปอง ฿40 ที่ปลดล็อกแล้ว</span>
                    <span className="font-mono font-numeric text-2xl font-extrabold text-amber-300">
                      {summary.milestonesCompleted} ใบ
                    </span>
                  </div>
                </div>

                {/* Progress Bar Display */}
                <div className="bg-black/20 rounded-2xl p-4 border border-white/15 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-100 flex items-center gap-1.5">
                      <span>ความคืบหน้าสะสมร้านค้า:</span>
                      <strong className="font-mono text-white text-sm">
                        {summary.currentMilestoneProgress} / {summary.milestoneTarget} ร้านค้า
                      </strong>
                    </span>
                    <span className="font-mono text-amber-300 font-bold">{milestonePercent}%</span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="h-3.5 w-full bg-white/20 rounded-full overflow-hidden p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-300 rounded-full transition-[width] duration-500 shadow-sm"
                      style={{ width: `${milestonePercent}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-blue-100 pt-0.5">
                    {summary.currentMilestoneProgress === 0 && (summary.totalSuccessfulMerchants ?? summary.totalRedeemed) > 0 ? (
                      <span>🎉 คุณได้รับคูปอง ฿40.00 จากไมล์สโตนล่าสุดเรียบร้อยแล้ว! ชวนเพื่อนไปร้านค้าใหม่เพื่อรับใบถัดไป</span>
                    ) : (
                      <span>
                        ต้องการร้านค้าที่เพื่อนชำระเงินสำเร็จใหม่อีก{' '}
                        <strong className="text-white font-mono font-bold">
                          {summary.merchantsNeededForNextMilestone ?? summary.friendsNeededForNextMilestone} ร้านค้า
                        </strong>{' '}
                        เพื่อรับคูปอง ฿40.00 ใบถัดไป
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* 2.4 SECTION: REFERRAL STATISTICS CARDS (3 Metric Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="rounded-card border border-hairline bg-white p-5 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted font-medium">เพื่อนที่ชวนทั้งหมด</span>
                  <div className="h-8 w-8 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center border border-blue-200">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono font-numeric text-2xl font-bold text-ink">
                    {summary.totalInvited}
                  </span>
                  <span className="text-xs text-ink-muted">คน</span>
                </div>
                <p className="text-[11px] text-ink-muted">คำชวนที่สร้างสำหรับร้านนี้</p>
              </div>

              <div className="rounded-card border border-hairline bg-white p-5 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted font-medium">ร้านค้าที่ชวนสำเร็จ</span>
                  <div className="h-8 w-8 rounded-xl bg-emerald-50 text-status-success flex items-center justify-center border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono font-numeric text-2xl font-bold text-status-success">
                    {summary.totalSuccessfulMerchants ?? summary.totalRedeemed}
                  </span>
                  <span className="text-xs text-ink-muted">ร้านค้า</span>
                </div>
                <p className="text-[11px] text-ink-muted">ร้านค้าไม่ซ้ำกันที่เพื่อนใช้สิทธิ์สำเร็จ</p>
              </div>

              <div className="rounded-card border border-hairline bg-white p-5 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted font-medium">รอเพื่อนไปใช้สิทธิ์</span>
                  <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono font-numeric text-2xl font-bold text-amber-600">
                    {summary.totalPending}
                  </span>
                  <span className="text-xs text-ink-muted">คำชวน</span>
                </div>
                <p className="text-[11px] text-ink-muted">รอเพื่อนนำรหัสไปใช้ที่ร้าน</p>
              </div>
            </div>

            {/* 2.5 SECTION: EARNED COUPONS LIST (My Coupons from Referrals) */}
            {earnedCoupons.length > 0 && (
              <div className="bg-white rounded-card border border-hairline p-5 sm:p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-brand-blue" />
                    <h3 className="text-sm font-bold text-ink">
                      คูปองส่วนลดที่ได้รับจากระบบชวนเพื่อน ({earnedCoupons.length} ใบ)
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {earnedCoupons.map((coupon) => {
                    const isMilestone = coupon.rewardType === 'REFERRER_MILESTONE_40';
                    const isUsed = coupon.status === 'used';
                    const isExpired =
                      !isUsed &&
                      Boolean(
                        coupon.status === 'expired' ||
                          (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now())
                      );

                    const expiryDateFormatted = coupon.expiresAt
                      ? new Date(coupon.expiresAt).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : null;

                    let remainingDaysText = null;
                    if (coupon.expiresAt && !isUsed && !isExpired) {
                      const diffMs = new Date(coupon.expiresAt).getTime() - Date.now();
                      if (diffMs > 0) {
                        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                        remainingDaysText = diffDays === 1 ? 'เหลืออีก 1 วัน' : `เหลืออีก ${diffDays} วัน`;
                      }
                    }

                    return (
                      <div
                        key={coupon.userRewardId}
                        className={`border rounded-2xl p-3.5 flex items-center justify-between gap-3 ${
                          isExpired
                            ? 'border-gray-200 bg-gray-50/80 opacity-80'
                            : isUsed
                            ? 'border-hairline bg-surface-soft/40 opacity-75'
                            : 'border-hairline bg-surface-soft/60'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-pill font-semibold ${
                                isMilestone
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {isMilestone ? 'ไมล์สโตน ฿40' : 'คูปองรางวัล'}
                            </span>
                            <span className="font-mono text-xs font-bold text-ink truncate">
                              {coupon.rewardCode}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-muted truncate">{coupon.rewardName}</p>
                          {expiryDateFormatted && (
                            <p className="text-[10px] text-ink-muted flex items-center gap-1.5 pt-0.5">
                              <span>หมดอายุ: {expiryDateFormatted}</span>
                              {remainingDaysText && (
                                <span className="font-semibold text-amber-700">({remainingDaysText})</span>
                              )}
                              {isExpired && (
                                <span className="font-semibold text-status-danger">(หมดอายุแล้ว)</span>
                              )}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-mono text-base font-bold ${
                              isExpired || isUsed ? 'text-ink-muted' : 'text-status-success'
                            }`}
                          >
                            ฿{coupon.discountValue.toFixed(2)}
                          </span>
                          <span
                            className={`block text-[10px] ${
                              isUsed
                                ? 'text-ink-muted font-medium'
                                : isExpired
                                ? 'text-status-danger font-semibold'
                                : 'text-emerald-700 font-semibold'
                            }`}
                          >
                            {isUsed ? 'ใช้งานแล้ว' : isExpired ? 'หมดอายุ' : 'พร้อมใช้งาน'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2.6 SECTION: REFERRAL CODE VALIDATION TOOL */}
            <div className="rounded-card border border-hairline bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-brand-blue" />
                    <span>ตรวจสอบรหัสคำชวนจากเพื่อน (Validation Tool)</span>
                  </h3>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    กรอกรหัสแนะนำเพื่อนเพื่อตรวจสอบเงื่อนไขร้านค้า สิทธิประโยชน์ และชื่อผู้แนะนำ
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-pill bg-surface-soft border border-hairline text-ink-body font-mono text-[11px] font-semibold shrink-0">
                  Real API Validation
                </span>
              </div>

              <form onSubmit={handleValidateCode} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="กรอกรหัสแนะนำเพื่อน เช่น TP-8F3K9A"
                    maxLength={30}
                    className="w-full bg-surface-soft border border-hairline rounded-pill pl-10 pr-4 py-2.5 text-xs sm:text-sm font-mono text-ink placeholder:font-sans placeholder:text-ink-muted focus:bg-white focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition uppercase"
                  />
                  {inputCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setInputCode('');
                        setValidationResult(null);
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink bg-white px-2 py-0.5 rounded-pill border border-hairline"
                    >
                      ล้าง
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isValidating || !inputCode.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-pill bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover disabled:opacity-50 transition shadow-xs shrink-0"
                >
                  {isValidating ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>กำลังตรวจสอบ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>ตรวจสอบรหัส</span>
                    </>
                  )}
                </button>
              </form>

              {/* Dynamic Validation Feedback */}
              {validationResult && (
                <div
                  className={`p-4 rounded-2xl border text-xs space-y-2 animate-fade-in ${
                    validationResult.isValid
                      ? 'bg-emerald-50 border-emerald-200 text-status-success'
                      : 'bg-red-50 border-red-200 text-status-error'
                  }`}
                >
                  {validationResult.isValid ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
                        <span>รหัสคำชวนถูกต้องและพร้อมใช้งาน!</span>
                      </div>
                      <div className="text-emerald-900 leading-relaxed pl-5.5 space-y-0.5">
                        <p>
                          • ผู้แนะนำ: <strong>{validationResult.referrerName}</strong>
                        </p>
                        <p>
                          • ร้านค้าที่ใช้สิทธิ์ได้: <strong>{validationResult.shopName}</strong>
                        </p>
                        <p>
                          • สิทธิประโยชน์: <strong>คูปองส่วนลด ฿{validationResult.discountAmount?.toFixed(2)}</strong>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-red-800">
                      <AlertCircle className="h-4 w-4 text-status-error shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">
                          {validationResult.errorMessage?.includes('คุณได้รับคำเชิญสำหรับร้านนี้แล้ว')
                            ? 'คำเชิญซ้ำ: '
                            : 'ตรวจสอบไม่ผ่าน: '}
                        </span>
                        <span>{validationResult.errorMessage}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2.7 SECTION: REFERRED FRIENDS LIST */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-brand-blue" />
                    <span>ประวัติคำชวนและรายชื่อเพื่อนที่แนะนำสำหรับร้านนี้</span>
                  </h3>
                  <p className="text-xs text-ink-muted">
                    แสดงสถานะการใช้สิทธิ์ของเพื่อนตามลำดับเวลาล่าสุด
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-white border border-hairline p-1 rounded-pill self-start sm:self-auto text-xs">
                  <button
                    type="button"
                    onClick={() => setFriendFilter('all')}
                    className={`px-3 py-1 rounded-pill transition ${
                      friendFilter === 'all'
                        ? 'bg-ink text-white font-semibold shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    ทั้งหมด ({friendsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFriendFilter('redeemed')}
                    className={`px-3 py-1 rounded-pill transition ${
                      friendFilter === 'redeemed'
                        ? 'bg-status-success text-white font-semibold shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    สำเร็จ ({summary.totalRedeemed})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFriendFilter('pending')}
                    className={`px-3 py-1 rounded-pill transition ${
                      friendFilter === 'pending'
                        ? 'bg-amber-500 text-white font-semibold shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    รอใช้สิทธิ์ ({summary.totalPending})
                  </button>
                </div>
              </div>

              {filteredFriends.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredFriends.map((friend) => (
                    <article
                      key={friend.referralId}
                      className="bg-white border border-hairline rounded-card p-4 shadow-2xs hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                            friend.status === 'redeemed'
                              ? 'bg-emerald-50 text-status-success border-emerald-200'
                              : 'bg-amber-50 text-amber-600 border-amber-200'
                          }`}
                        >
                          {friend.status === 'redeemed' ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Clock className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-bold text-ink truncate">
                              {friend.friendName}
                            </h4>
                            <span className="font-mono font-numeric text-[11px] text-ink-muted bg-surface-soft px-2 py-0.5 rounded-pill border border-hairline">
                              {friend.referralCode}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-muted truncate">
                            {friend.status === 'redeemed' && friend.redeemedAt
                              ? `ชำระเงินสำเร็จเมื่อ: ${new Date(friend.redeemedAt).toLocaleDateString('th-TH', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}`
                              : `สร้างคำชวนเมื่อ: ${new Date(friend.invitedAt).toLocaleDateString('th-TH', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-hairline/60">
                        <div className="text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-pill text-[11px] font-semibold border ${
                              friend.status === 'redeemed'
                                ? 'bg-emerald-50 text-status-success border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {friend.status === 'redeemed' ? 'สำเร็จแล้ว' : 'รอเพื่อนใช้สิทธิ์'}
                          </span>
                          <span className="block text-[10px] text-ink-muted mt-0.5 font-mono">
                            คูปองเพื่อน ฿{friend.discountAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-hairline rounded-card p-8 sm:p-10 text-center shadow-xs space-y-3">
                  <div className="h-12 w-12 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center mx-auto border border-blue-200">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-ink">
                      ยังไม่มีรายการเพื่อนในตัวกรองนี้
                    </h4>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed max-w-sm mx-auto">
                      แชร์รหัสคำชวนร้านนี้ให้เพื่อนเพื่อเริ่มต้นสะสมร้านค้าความคืบหน้ารับคูปอง ฿40
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CitizenReferralPage;
