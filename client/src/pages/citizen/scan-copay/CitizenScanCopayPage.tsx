import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  Store,
  RefreshCw,
  CheckCircle2,
  Gift,
  Tag,
  Users,
  Check,
  X,
  Clock,
  ChevronDown,
} from 'lucide-react';
import {
  getWalletBalance,
  getQrDetails,
  checkoutCopay,
  validateDiscountCode,
  CopayPreviewData,
  DiscountValidationResult,
} from '../../../services/paymentApi';
import { APP_ROUTES } from '../../../constants/routes';
import { useAuthStore } from '../../../stores/authStore';
import { QrCameraScanner } from '../../../components/payment/QrCameraScanner';
import { usePaymentPinStatus } from '../../../hooks/usePaymentPinStatus';
import { PaymentPinConfirmation } from '../../../components/payment/PaymentPinConfirmation';
import { getMyRewards } from '../../../services/rewardApi';
import type { CitizenReward } from '../../../services/rewardApi';

export const CitizenScanCopayPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refFromUrl = searchParams.get('ref') || searchParams.get('code') || searchParams.get('referralCode');
  const { user, clearAuth } = useAuthStore();

  // พิกัด GPS ผู้ใช้ — ดึงเงียบ ๆ เบื้องหลังเพื่อส่งให้ระบบตรวจสอบ (ไม่แสดงให้ผู้ใช้เห็น)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number }>({
    lat: 13.7563,
    lon: 100.5018,
  });

  // ข้อมูล QR และการเลือกสแกน
  const [qrReference, setQrReference] = useState<string>('');
  const [scannedData, setScannedData] = useState<CopayPreviewData | null>(null);
  const [showPinConfirmation, setShowPinConfirmation] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [showCoupon, setShowCoupon] = useState<boolean>(false);

  // ข้อมูลคูปองส่วนลดและโค้ดคำชวนของเพื่อน (Friend Referral / Duo Coupon)
  const [discountCodeInput, setDiscountCodeInput] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountValidationResult | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);

  // รับโค้ดคำชวนเพื่อนจาก URL parameter (Deep Link จากระบบชวนเพื่อน)
  useEffect(() => {
    if (refFromUrl) {
      const clean = refFromUrl.trim().toUpperCase();
      setDiscountCodeInput(clean);
      setShowCoupon(true);
    }
  }, [refFromUrl]);

  // ดึงข้อมูลกระเป๋าเงินเพื่อตรวจสอบยอดเงินและโควตา
  const { data: wallet } = useQuery({
    queryKey: ['wallet-balance', user?.id],
    queryFn: getWalletBalance,
    enabled: Boolean(user?.id),
  });
  const {
    data: ownedRewards = [],
    isLoading: isRewardsLoading,
    isError: isRewardsError,
  } = useQuery({
    queryKey: ['my-rewards'],
    queryFn: getMyRewards,
    staleTime: 0,
  });
  const discountRewards = ownedRewards.filter(
    (reward): reward is CitizenReward & { discountType: string; discountValue: number } =>
      reward.discountType !== null && reward.discountValue !== null
  );
  const availableOwnedRewards = discountRewards.filter((reward) =>
    reward.status === 'available' &&
    (!reward.expiresAt || new Date(reward.expiresAt).getTime() > Date.now())
  );
  const { data: pinStatus, refetch: refetchPinStatus } = usePaymentPinStatus();

  useEffect(() => {
    if (scannedData && availableOwnedRewards.length > 0 && !appliedDiscount) {
      setShowCoupon(true);
    }
  }, [scannedData, availableOwnedRewards.length, appliedDiscount]);

  // ติดตามพิกัด GPS จริงจากเบราว์เซอร์แบบเบื้องหลัง
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => console.warn('Geolocation error or denied:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ตรวจสอบเวลานับถอยหลังของเซสชันชำระเงินหลังสแกนสำเร็จ (ขยายเป็น 15 นาทีตามมาตรฐานเป๋าตัง/ไทยช่วยไทย)
  const [previewSecondsRemaining, setPreviewSecondsRemaining] = useState<number>(900);

  useEffect(() => {
    if (!scannedData?.qrData?.expiresAt) return;

    const checkExpiry = () => {
      const expiryTime = new Date(scannedData.qrData.expiresAt).getTime();
      const diffSec = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setPreviewSecondsRemaining(diffSec);

      if (diffSec <= 0) {
        // หากหมดอายุ ให้เด้งกลับหน้าสแกนใหม่ทันที พร้อมแจ้งเตือนตามที่กำหนด
        setScannedData(null);
        setShowPinConfirmation(false);
        setQrReference('');
        setCheckoutError('เซสชันชำระเงินหมดอายุ (เกิน 15 นาที) กรุณาสแกน QR ใหม่อีกครั้ง');
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 1000);
    return () => clearInterval(interval);
  }, [scannedData]);

  const previewMinutes = Math.floor(previewSecondsRemaining / 60);
  const previewSecs = previewSecondsRemaining % 60;
  const formattedPreviewTimer = `${String(previewMinutes).padStart(2, '0')}:${String(previewSecs).padStart(2, '0')}`;

  // Mutation ตรวจสอบรหัส QR เพื่อพรีวิวยอดเงิน Co-pay (ส่งพิกัด GPS ตรวจสอบทันทีตั้งแต่ตอนสแกน)
  const previewMutation = useMutation({
    mutationFn: ({ ref, code }: { ref: string; code?: string }) =>
      getQrDetails(ref, code, userLocation),
    onSuccess: (data) => {
      setScannedData(data);
      if (data.discountInfo) {
        setAppliedDiscount(data.discountInfo);
      }
      setCheckoutError(null);
    },
    onError: (err: any) => {
      // หากหมดอายุหรือพิกัดไกลเกิน ให้เด้งอยู่หน้าสแกนใหม่ ไม่ต้องไปหน้าต่อไป
      setScannedData(null);
      setQrReference('');
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        'ไม่สามารถทำรายการได้ กรุณาสแกน QR Code ใหม่อีกครั้ง';
      setCheckoutError(errorMsg);
    },
  });

  // กู้คืนเซสชัน QR ที่สแกนค้างไว้อัตโนมัติ (เช่น หลังผู้ใช้ปลดล็อก/รีเซ็ต PIN สำเร็จแล้วกลับมาหน้าจ่ายเงิน)
  useEffect(() => {
    const savedPending = sessionStorage.getItem('thai-please:pending-checkout-qr');
    if (!savedPending) return;
    sessionStorage.removeItem('thai-please:pending-checkout-qr');
    try {
      const parsed = JSON.parse(savedPending);
      if (parsed?.ref) {
        setQrReference(parsed.ref);
        previewMutation.mutate({ ref: parsed.ref, code: parsed.code });
      }
    } catch {
      // ignore invalid storage
    }
  }, []);

  // Mutation ตรวจสอบความถูกต้องของคูปองหรือโค้ดคำชวนของเพื่อน
  const discountMutation = useMutation({
    mutationFn: (code: string) =>
      validateDiscountCode({
        code,
        totalAmount: scannedData?.qrData.totalAmount || 0,
        merchantId: scannedData?.qrData.merchantId,
      }),
    onSuccess: (discountRes) => {
      setAppliedDiscount(discountRes);
      setDiscountError(null);
      // โหลดการแบ่งจ่าย Co-pay ใหม่โดยส่ง discountCode เข้าไปด้วย
      if (qrReference) {
        previewMutation.mutate({ ref: qrReference, code: discountRes.code });
      }
    },
    onError: (err: any) => {
      setDiscountError(err.response?.data?.message || err.message || 'รหัสคูปองไม่ถูกต้อง');
    },
  });

  const handleApplyDiscount = (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setDiscountError(null);
    discountMutation.mutate(clean);
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCodeInput('');
    setDiscountError(null);
    if (qrReference) {
      previewMutation.mutate({ ref: qrReference, code: undefined });
    }
  };

  // Mutation ชำระเงินร่วม (Co-pay 60/40)
  const checkoutMutation = useMutation({
    mutationFn: (pin: string) =>
      checkoutCopay({
        qrReference,
        userLatitude: userLocation.lat,
        userLongitude: userLocation.lon,
        merchantId: scannedData?.qrData.merchantId,
        pin,
        discountCode: appliedDiscount?.code,
      }),
    onSuccess: (data) => {
      setShowPinConfirmation(false);
      // ชำระเงินสำเร็จ นำทางไปยังหน้า e-Slip พร้อมสั่งบันทึกสลิปอัตโนมัติ (Auto-Save)
      navigate(`/citizen/slip/${data.transactionId}?autosave=1`, {
        state: { autoSave: true },
      });
    },
    onError: (err: any) => {
      if (err.response?.data?.code?.startsWith('PIN_')) {
        setPinError(err.response.data.message);
        if (err.response.data.code === 'PIN_LOCKED') void refetchPinStatus();
        return;
      }
      setShowPinConfirmation(false);
      // หากไม่ผ่านหรือตำแหน่งอยู่นอกระยะ หรือหมดอายุ ให้เด้งกลับหน้าสแกนใหม่
      setScannedData(null);
      setQrReference('');
      setCheckoutError(
        err.response?.data?.message ||
          err.message ||
          'ไม่สามารถทำรายการได้ กรุณาสแกน QR Code ใหม่อีกครั้ง'
      );
    },
  });

  // เมื่อกล้องอ่าน QR ได้ → ตรวจสอบรายการทันที (ไม่ต้องกดปุ่มเพิ่ม)
  const handleDetected = (text: string) => {
    setShowPinConfirmation(false);
    setPinError(null);
    setCheckoutError(null);
    setAppliedDiscount(null);
    setDiscountCodeInput('');
    setDiscountError(null);
    setShowCoupon(false);
    setQrReference(text);
    previewMutation.mutate({ ref: text });
  };

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* Page Title & Action Bar (กระชับบนมือถือ เพื่อให้กล้องและปุ่มหลักอยู่ใน 1 จอ) */}
      <div className="bg-white border-b border-hairline px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 mb-3 sm:mb-4 shadow-2xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
            <button
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="flex items-center space-x-1.5 rounded-pill px-2.5 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline shrink-0"
              title="กลับกระเป๋าเงิน"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">กลับกระเป๋าเงิน</span>
            </button>
            <div className="border-l border-hairline pl-2.5 sm:pl-3 min-w-0">
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-ink truncate">สแกนชำระเงินร่วม</h1>
              <p className="hidden sm:block text-xs text-brand-blue font-medium truncate">
                สแกน QR ร้านค้าเพื่อรับสิทธิร่วมจ่าย
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 rounded-pill bg-surface-soft border border-hairline px-2.5 sm:px-3 py-1 text-xs font-mono shrink-0">
            <span className="text-ink-muted hidden sm:inline">กระเป๋าส่วนตัว:</span>
            <span className="font-bold text-ink">฿{(wallet?.balance ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-3.5 sm:px-6 lg:px-8 space-y-3 sm:space-y-4">
        {/* กล่องแจ้งเตือนข้อผิดพลาด (ถ้ามี) - แสดงด้านบนสุด เด่นชัดทั้งบนมือถือและคอม */}
        {checkoutError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3.5 sm:p-4 text-xs text-status-error flex items-start space-x-2.5 shadow-xs animate-in fade-in max-w-lg mx-auto lg:max-w-none">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs sm:text-sm text-red-700">แจ้งเตือนระบบ</p>
              <p className="mt-0.5 text-red-800 font-medium break-words">{checkoutError}</p>
            </div>
            <button
              onClick={() => setCheckoutError(null)}
              className="text-red-400 hover:text-red-700 p-1 shrink-0"
              title="ปิดข้อความแจ้งเตือน"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ส่วนกล้องสแกน QR สด (จัดกึ่งกลางอย่างสมดุล รองรับทุกขนาดหน้าจอ) */}
        {!scannedData ? (
          <div className="max-w-lg mx-auto space-y-3.5 animate-in fade-in duration-200">
            <section className="rounded-card border border-hairline bg-white p-3.5 sm:p-5 shadow-sm">
              <div className="relative">
                <QrCameraScanner
                  active={!scannedData && !previewMutation.isPending}
                  onDetected={handleDetected}
                  className="w-full aspect-square max-h-[55vh] sm:max-h-[60vh] mx-auto"
                />
                {previewMutation.isPending && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl bg-black/60 text-white text-xs sm:text-sm font-medium">
                    <RefreshCw className="h-6 w-6 animate-spin mb-2" />
                    กำลังตรวจสอบรายการ...
                  </div>
                )}
              </div>

              {/* กรอกรหัส QR ด้วยตนเอง (สำรองกรณีกล้องใช้ไม่ได้) */}
              <button
                type="button"
                onClick={() => setShowManualInput((v) => !v)}
                className="mt-3 w-full flex items-center justify-center gap-1 py-1 text-xs font-medium text-ink-muted hover:text-ink transition"
              >
                <span>กรอกรหัส QR ด้วยตนเอง</span>
                <ChevronDown className={`h-3.5 w-3.5 transition ${showManualInput ? 'rotate-180' : ''}`} />
              </button>
              {showManualInput && (
                <div className="mt-2 flex flex-col xs:flex-row gap-2">
                  <input
                    id="input-qr-ref"
                    type="text"
                    placeholder="กรอกหรือวางรหัส QR Reference"
                    value={qrReference}
                    onChange={(e) => setQrReference(e.target.value)}
                    className="w-full rounded-pill border border-hairline px-4 py-2.5 text-xs text-ink focus:border-brand-blue focus:outline-none"
                  />
                  <button
                    id="btn-inspect-qr"
                    disabled={!qrReference || previewMutation.isPending}
                    onClick={() => previewMutation.mutate({ ref: qrReference })}
                    className="rounded-pill bg-brand-blue px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-blue-hover disabled:opacity-40 shrink-0"
                  >
                    {previewMutation.isPending ? 'ตรวจ...' : 'ตรวจสอบ'}
                  </button>
                </div>
              )}
            </section>

            {/* โควตาสิทธิรัฐช่วยจ่ายคงเหลือวันนี้ */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-2.5 flex items-center justify-between text-xs text-brand-blue">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>โควตารัฐช่วยจ่ายคงเหลือวันนี้</span>
              </span>
              <span className="font-mono font-bold">
                {wallet?.eligibilityStatus === 'ELIGIBLE'
                  ? `฿${(wallet.dailyQuotaRemaining ?? 200).toFixed(2)}`
                  : 'ไม่มีสิทธิรับ'}
              </span>
            </div>
          </div>
        ) : (
          /* ส่วนแสดงรายละเอียดและยืนยันชำระเงินร่วม (Co-pay 60/40 Breakdown บนทุกขนาดจอ) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start animate-in fade-in duration-200">
            {/* Left Column: Shop Info, Coupon, Breakdown (lg:col-span-7 space-y-4) */}
            <div className="lg:col-span-7 space-y-4">
              {/* ข้อมูลร้านค้าที่สแกน */}
              <div className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center space-x-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue shadow-xs">
                      <Store className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm sm:text-base text-ink truncate">
                        {scannedData.qrData.shopName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                        <span className="font-mono text-[11px] sm:text-xs text-ink-muted truncate max-w-[180px] sm:max-w-xs">
                          Ref: {scannedData.qrData.qrReference}
                        </span>
                        <span className="inline-flex items-center space-x-1.5 rounded-pill bg-emerald-50 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-emerald-800 border border-emerald-200 shrink-0">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span className="inline-flex items-center gap-1">
                            <span>สแกนสำเร็จ</span>
                            <span className="text-emerald-400">•</span>
                            <Clock className="h-2.5 w-2.5 text-emerald-700 shrink-0" />
                            <span className="font-mono">{formattedPreviewTimer} น.</span>
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setScannedData(null);
                      setAppliedDiscount(null);
                      setDiscountCodeInput('');
                    }}
                    className="shrink-0 rounded-pill bg-gray-100 px-3 py-1.5 text-xs text-brand-blue font-medium hover:bg-gray-200 transition"
                  >
                    สแกนใหม่
                  </button>
                </div>

                {/* ส่วนกรอกคูปองส่วนลด / โค้ดคำชวนของเพื่อน (พับเก็บไว้ เพื่อให้ปุ่มยืนยันอยู่ใน 1 จอ) */}
                <div className="mt-3 pt-3 border-t border-hairline">
                  <button
                    type="button"
                    onClick={() => setShowCoupon((v) => !v)}
                    disabled={!!appliedDiscount}
                    aria-expanded={showCoupon || Boolean(appliedDiscount)}
                    className="w-full flex items-center justify-between gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
                  >
                    <span className="text-xs font-semibold text-ink flex items-center space-x-1.5">
                      <Gift className="h-3.5 w-3.5 text-brand-blue shrink-0" aria-hidden="true" />
                      <span>มีคูปองส่วนลด หรือโค้ดชวนเพื่อน?</span>
                    </span>
                    {appliedDiscount ? (
                      <span className="rounded-pill bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-status-success border border-emerald-200 flex items-center space-x-1 shrink-0">
                        <Check className="h-3 w-3" aria-hidden="true" />
                        <span>ใช้โค้ดแล้ว</span>
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-brand-blue font-medium">
                        <span>{showCoupon ? 'ซ่อน' : 'ใส่โค้ดที่นี่'}</span>
                        <ChevronDown className={`h-4 w-4 text-brand-blue transition shrink-0 ${showCoupon ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </div>
                    )}
                  </button>

                  {(showCoupon || appliedDiscount) && (
                    <div className="mt-2.5" aria-live="polite">
                      {!appliedDiscount ? (
                        <div className="space-y-2">
                          <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-xs font-bold text-ink">คูปองส่วนลดของคุณ</h4>
                              {availableOwnedRewards.length > 0 && (
                                <span className="shrink-0 rounded-pill bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
                                  พร้อมใช้ {availableOwnedRewards.length} ใบ
                                </span>
                              )}
                            </div>

                            {availableOwnedRewards.length > 0 ? (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {availableOwnedRewards.map((reward) => {
                                  const discountLabel = reward.discountType === 'percent'
                                    ? `${reward.discountValue.toLocaleString('th-TH', { maximumFractionDigits: 2 })}%`
                                    : `฿${reward.discountValue.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

                                  return (
                                    <button
                                      key={reward.userRewardId}
                                      type="button"
                                      disabled={discountMutation.isPending}
                                      onClick={() => {
                                        setDiscountCodeInput(reward.rewardCode);
                                        handleApplyDiscount(reward.rewardCode);
                                      }}
                                      className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-left transition hover:border-emerald-400 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                                      aria-label={`ใช้คูปอง ${reward.rewardName} ลด ${discountLabel}; ยอดซื้อขั้นต่ำ ${reward.minimumSpend.toLocaleString('th-TH')} บาท`}
                                    >
                                      <span className="min-w-0 space-y-0.5">
                                        <span className="block truncate text-xs font-semibold text-ink">{reward.rewardName}</span>
                                        <span className="block truncate font-mono text-[10px] text-ink-muted" translate="no">{reward.rewardCode}</span>
                                        <span className="block text-[10px] text-ink-muted">
                                          ยอดซื้อขั้นต่ำ {reward.minimumSpend > 0 ? `฿${reward.minimumSpend.toLocaleString('th-TH', { maximumFractionDigits: 2 })}` : 'ไม่มีขั้นต่ำ'}
                                        </span>
                                        {reward.expiresAt && (
                                          <span className="block text-[10px] text-ink-muted">
                                            ใช้ได้ถึง {new Intl.DateTimeFormat('th-TH', {
                                              year: 'numeric',
                                              month: 'short',
                                              day: 'numeric',
                                            }).format(new Date(reward.expiresAt))}
                                          </span>
                                        )}
                                      </span>
                                      <span className="shrink-0 text-right">
                                        <span className="block font-mono text-sm font-bold text-emerald-800">
                                          {discountLabel}
                                        </span>
                                        <span className="block text-[10px] font-semibold text-emerald-700">
                                          {discountMutation.isPending ? 'กำลังตรวจสอบ…' : 'ใช้คูปอง'}
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[11px] text-ink-muted">
                                {isRewardsLoading
                                  ? 'กำลังโหลดคูปองของคุณ…'
                                  : isRewardsError
                                  ? 'โหลดคูปองไม่สำเร็จ คุณยังกรอกรหัสคูปองด้านล่างได้'
                                  : discountRewards.length > 0
                                  ? 'ไม่มีคูปองที่ยังพร้อมใช้งาน'
                                  : 'ยังไม่มีคูปองส่วนลดที่ใช้กับรายการนี้ได้'}
                              </p>
                            )}
                          </section>

                          <div className="space-y-1.5 pt-1">
                            <label htmlFor="input-discount-code" className="text-xs font-semibold text-ink flex items-center space-x-1.5">
                              <Tag className="h-3.5 w-3.5 text-brand-blue" aria-hidden="true" />
                              <span>กรอกโค้ดส่วนลด หรือโค้ดชวนเพื่อน:</span>
                            </label>
                            <div className="flex space-x-2">
                              <div className="relative flex-1 min-w-0">
                                <Tag className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                                <input
                                  id="input-discount-code"
                                  name="discountCode"
                                  type="text"
                                  autoComplete="off"
                                  spellCheck={false}
                                  placeholder="กรอกโค้ด เช่น TP-XXXX หรือรหัสคูปอง…"
                                  value={discountCodeInput}
                                  onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleApplyDiscount(discountCodeInput);
                                    }
                                  }}
                                  className="w-full rounded-pill border border-hairline pl-8 pr-3 py-2 text-xs font-mono text-ink placeholder:font-sans focus:border-brand-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-1 uppercase"
                                />
                              </div>
                              <button
                                id="btn-apply-discount"
                                type="button"
                                disabled={!discountCodeInput.trim() || discountMutation.isPending}
                                onClick={() => handleApplyDiscount(discountCodeInput)}
                                className="rounded-pill bg-brand-blue px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-blue-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:opacity-40 shrink-0"
                              >
                                {discountMutation.isPending ? 'ตรวจ...' : 'ใช้โค้ด'}
                              </button>
                            </div>
                            <p className="text-[10px] text-ink-muted flex items-center gap-1">
                              <span>💡</span>
                              <span>หากมีโค้ดชวนเพื่อนจากเพื่อน (เช่น TP-XXXX) สามารถพิมพ์หรือวางในช่องนี้แล้วกด &quot;ใช้โค้ด&quot; ได้ทันที</span>
                            </p>
                          </div>

                          {discountError && (
                            <p role="alert" className="text-[11px] text-status-error flex items-center space-x-1">
                              <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                              <span>{discountError}</span>
                            </p>
                          )}

                          {/* แนะนำโค้ดสิทธิพิเศษและเพื่อนชวนเพื่อน */}
                          <div className="pt-1">
                            <span className="text-[10px] text-ink-muted block mb-1">
                              สิทธิพิเศษและโค้ดแนะนำ:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setDiscountCodeInput('FRIEND30');
                                  handleApplyDiscount('FRIEND30');
                                }}
                                className="rounded-pill border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[10px] font-medium text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 flex items-center space-x-1"
                              >
                                <Users className="h-3 w-3 text-emerald-600 shrink-0" aria-hidden="true" />
                                <span>FRIEND30 (ลด ฿30 เพื่อนชวนเพื่อน)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDiscountCodeInput('DUO50');
                                  handleApplyDiscount('DUO50');
                                }}
                                className="rounded-pill border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-[10px] font-medium text-brand-blue transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 flex items-center space-x-1"
                              >
                                <Tag className="h-3 w-3 text-brand-blue shrink-0" aria-hidden="true" />
                                <span>DUO50 (ลด ฿50 สิทธิพิเศษคู่หู)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDiscountCodeInput('WELCOME20');
                                  handleApplyDiscount('WELCOME20');
                                }}
                                className="rounded-pill border border-hairline bg-surface-soft px-2.5 py-1 text-[10px] font-medium text-ink transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 flex items-center space-x-1"
                              >
                                <Gift className="h-3 w-3 text-ink-muted shrink-0" aria-hidden="true" />
                                <span>WELCOME20 (ลด ฿20 สิทธิพิเศษต้อนรับ)</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-emerald-900">
                              <Tag className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span className="font-mono">{appliedDiscount.code}</span>
                              <span className="rounded-pill bg-emerald-200/80 px-2 py-0.5 text-[10px] text-emerald-800">
                                {appliedDiscount.discountSource === 'FRIEND_REFERRAL'
                                  ? 'โค้ดคำชวนของเพื่อน'
                                  : 'คูปองส่วนลด'}
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800">
                              {appliedDiscount.sourceDescription}
                            </p>
                            {appliedDiscount.referrerName && (
                              <p className="text-[10px] text-emerald-700">
                                เพื่อนผู้แนะนำ: คุณ {appliedDiscount.referrerName}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveDiscount}
                            aria-label="ยกเลิกคูปองที่ใช้"
                            className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 transition shrink-0"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* รายละเอียดการคำนวณ Co-pay 60/40 */}
                <div className="mt-3 rounded-2xl border border-hairline bg-surface-soft p-3.5 sm:p-4 space-y-2">
                  {/* ยอดรวมสินค้าเดิม */}
                  <div className="flex justify-between items-center gap-2 text-xs sm:text-sm">
                    <span className="text-ink-muted">ยอดรวมสินค้า (100%)</span>
                    <span className={`font-mono shrink-0 whitespace-nowrap ${scannedData.copaySplit?.discountAmount ? 'line-through text-ink-muted text-xs' : 'font-bold text-ink'}`}>
                      ฿{(scannedData.copaySplit?.originalTotalAmount ?? scannedData.qrData.totalAmount).toFixed(2)}
                    </span>
                  </div>

                  {/* แถวแสดงส่วนลดคูปอง/โค้ดเพื่อน */}
                  {scannedData.copaySplit?.discountAmount && scannedData.copaySplit.discountAmount > 0 ? (
                    <>
                      <div className="flex justify-between items-center gap-2 text-xs sm:text-sm text-emerald-700 font-medium">
                        <span className="flex items-center space-x-1 min-w-0">
                          <Gift className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">ส่วนลดคูปอง ({scannedData.copaySplit.discountCode})</span>
                        </span>
                        <span className="font-mono font-bold shrink-0 whitespace-nowrap">
                          - ฿{scannedData.copaySplit.discountAmount.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center gap-2 text-xs text-ink-muted border-b border-hairline pb-2">
                        <span>ยอดสุทธิก่อนแบ่ง Co-pay 60/40</span>
                        <span className="font-mono font-semibold text-ink shrink-0 whitespace-nowrap">
                          ฿{scannedData.copaySplit.netTotalAmount?.toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : null}

                  {/* รัฐบาลช่วยจ่าย 60% */}
                  <div className="flex justify-between items-center gap-2 text-xs sm:text-sm text-brand-blue">
                    <span className="flex items-center space-x-1">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span>รัฐบาลช่วยจ่าย 60%</span>
                    </span>
                    <span className="font-mono font-bold shrink-0 whitespace-nowrap">
                      - ฿{(scannedData.copaySplit?.governmentCopayAmount ?? scannedData.qrData.estimatedGovCopay).toFixed(2)}
                    </span>
                  </div>

                  {/* ประชาชนจ่ายจริง 40% */}
                  <div className="border-t border-hairline pt-2.5 flex justify-between items-center gap-2 text-sm font-semibold">
                    <span className="text-ink">ประชาชนจ่ายจริง (40%)</span>
                    <span className="font-mono text-xl sm:text-2xl font-bold text-status-error shrink-0 whitespace-nowrap">
                      ฿{(scannedData.copaySplit?.citizenPaidAmount ?? scannedData.qrData.estimatedCitizenPay).toFixed(2)}
                    </span>
                  </div>

                  {/* ป้ายสรุปเงินที่ประหยัดได้ทั้งหมด */}
                  <div className="mt-2 rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-center">
                    <span className="text-xs font-semibold text-brand-blue">
                      🎉 คุณประหยัดเงินรวม ฿
                      {(
                        scannedData.copaySplit?.totalSavingsAmount ??
                        ((scannedData.copaySplit?.governmentCopayAmount ?? scannedData.qrData.estimatedGovCopay) +
                          (scannedData.copaySplit?.discountAmount || 0))
                      ).toFixed(2)}
                    </span>
                    <span className="block text-[10px] text-brand-blue-hover mt-0.5">
                      (รัฐสมทบ 60% ฿
                      {(scannedData.copaySplit?.governmentCopayAmount ?? scannedData.qrData.estimatedGovCopay).toFixed(2)}
                      {scannedData.copaySplit?.discountAmount ? ` + ส่วนลดพิเศษ ฿${scannedData.copaySplit.discountAmount.toFixed(2)}` : ''})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Review the amount first; PIN authorization opens as a separate full-screen step. */}
            <div className="lg:col-span-5 space-y-4">
              {/* ยอดเงินคงเหลือและปุ่มไปขั้นตอนยืนยัน PIN */}
              <div className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted font-medium">ยอดเงินในกระเป๋าส่วนตัว</span>
                  <span className="font-mono text-sm font-bold text-ink">
                    ฿{(wallet?.balance ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {wallet && wallet.balance < (scannedData.copaySplit?.citizenPaidAmount ?? scannedData.qrData.estimatedCitizenPay) && (
                  <p className="text-xs text-status-error font-medium">
                    ⚠️ ยอดเงินในกระเป๋าไม่เพียงพอ กรุณาเติมเงินก่อนทำรายการ
                  </p>
                )}

                <p className="border-t border-hairline pt-3 text-xs leading-relaxed text-ink-muted">ตรวจสอบยอดชำระ จากนั้นกดยืนยันเพื่อกรอกรหัส PIN ในขั้นตอนถัดไป</p>

                {/* ปุ่มยืนยันชำระเงิน */}
                <button
                  id="btn-confirm-checkout"
                  disabled={
                    checkoutMutation.isPending ||
                    !pinStatus?.isSet ||
                    (wallet
                      ? wallet.balance <
                        (scannedData.copaySplit?.citizenPaidAmount ??
                          scannedData.qrData.estimatedCitizenPay)
                      : false)
                  }
                  onClick={() => { setPinError(null); setCheckoutError(null); setShowPinConfirmation(true); }}
                  className="w-full flex items-center justify-center space-x-2 rounded-card bg-brand-blue py-3.5 text-white text-sm sm:text-base font-semibold shadow-lg shadow-blue-500/20 transition hover:bg-brand-blue-hover active:scale-98 disabled:opacity-50"
                >
                  {checkoutMutation.isPending ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin shrink-0" />
                      <span>กำลังทำรายการ...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                      <span>
                        ยืนยันชำระเงิน ฿
                        {(scannedData.copaySplit?.citizenPaidAmount ?? scannedData.qrData.estimatedCitizenPay).toFixed(2)}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* แถบแจ้งความปลอดภัย */}
        <div className="pt-1 text-center text-[11px] text-ink-muted flex items-center justify-center space-x-1.5 pb-4">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>ทำรายการอย่างปลอดภัยตามมาตรฐานโครงการ</span>
        </div>
      </main>
      <PaymentPinConfirmation
        open={showPinConfirmation && Boolean(scannedData)}
        amount={scannedData?.copaySplit?.citizenPaidAmount ?? scannedData?.qrData.estimatedCitizenPay ?? 0}
        shopName={scannedData?.qrData.shopName ?? ''}
        isPending={checkoutMutation.isPending}
        error={pinError}
        lockedUntil={pinStatus?.lockedUntil}
        onConfirm={pin => checkoutMutation.mutate(pin)}
        onClose={() => { setShowPinConfirmation(false); setPinError(null); }}
        onEdit={() => setPinError(null)}
        onForgot={() => {
          if (scannedData?.qrData?.qrReference) {
            sessionStorage.setItem(
              'thai-please:pending-checkout-qr',
              JSON.stringify({
                ref: scannedData.qrData.qrReference,
                code: appliedDiscount?.code || undefined,
              })
            );
          }
          sessionStorage.setItem('thai-please:pin-reset-intent', '1');
          if (user?.id) {
            sessionStorage.setItem('thai-please:pin-reset-user-id', user.id);
          }
          sessionStorage.setItem('thai-please:pin-reset-return', APP_ROUTES.CITIZEN_SCAN_COPAY);
          clearAuth();
          navigate(APP_ROUTES.LOGIN, { replace: true, state: { from: { pathname: APP_ROUTES.CITIZEN_SCAN_COPAY } } });
        }}
      />
    </div>
  );
};
