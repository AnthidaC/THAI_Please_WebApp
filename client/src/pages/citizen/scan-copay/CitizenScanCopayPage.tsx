import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Lock,
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
  generateDynamicQr,
  validateDiscountCode,
  CopayPreviewData,
  DiscountValidationResult,
} from '../../../services/paymentApi';
import { APP_ROUTES } from '../../../constants/routes';
import { QrCameraScanner } from '../../../components/payment/QrCameraScanner';

export const CitizenScanCopayPage: React.FC = () => {
  const navigate = useNavigate();

  // พิกัด GPS ผู้ใช้ — ดึงเงียบ ๆ เบื้องหลังเพื่อส่งให้ระบบตรวจสอบ (ไม่แสดงให้ผู้ใช้เห็น)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number }>({
    lat: 13.7563,
    lon: 100.5018,
  });

  // ข้อมูล QR และการเลือกสแกน
  const [qrReference, setQrReference] = useState<string>('');
  const [scannedData, setScannedData] = useState<CopayPreviewData | null>(null);
  const [pin, setPin] = useState<string>('123456');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [showCoupon, setShowCoupon] = useState<boolean>(false);

  // ข้อมูลคูปองส่วนลดและโค้ดคำชวนของเพื่อน (Friend Referral / Duo Coupon)
  const [discountCodeInput, setDiscountCodeInput] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountValidationResult | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);

  // ดึงข้อมูลกระเป๋าเงินเพื่อตรวจสอบยอดเงินและโควตา
  const { data: wallet } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: getWalletBalance,
  });

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

  // ตรวจสอบเวลานับถอยหลังของ QR ขณะอยู่ที่หน้าพรีวิว Co-pay (อายุ 3 นาที)
  const [previewSecondsRemaining, setPreviewSecondsRemaining] = useState<number>(180);

  useEffect(() => {
    if (!scannedData?.qrData?.expiresAt) return;

    const checkExpiry = () => {
      const expiryTime = new Date(scannedData.qrData.expiresAt).getTime();
      const diffSec = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setPreviewSecondsRemaining(diffSec);

      if (diffSec <= 0) {
        // หากหมดอายุ ให้เด้งกลับหน้าสแกนใหม่ทันที พร้อมแจ้งเตือนตามที่กำหนด
        setScannedData(null);
        setQrReference('');
        setCheckoutError('QR หมดอายุ กรุณาทำรายการใหม่');
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
    mutationFn: () =>
      checkoutCopay({
        qrReference,
        userLatitude: userLocation.lat,
        userLongitude: userLocation.lon,
        merchantId: scannedData?.qrData.merchantId,
        pin,
        discountCode: appliedDiscount?.code,
      }),
    onSuccess: (data) => {
      // ชำระเงินสำเร็จ นำทางไปยังหน้า e-Slip
      navigate(`/citizen/slip/${data.transactionId}`);
    },
    onError: (err: any) => {
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

  // ฟังก์ชันจำลองการสแกน QR ร้านค้าตัวอย่างด่วน (สำหรับทดสอบ)
  const handleQuickDemoScan = async (amount: number, shopName: string, distanceKm: number) => {
    try {
      setCheckoutError(null);
      setAppliedDiscount(null);
      setDiscountCodeInput('');
      setDiscountError(null);

      // คำนวณพิกัดร้านค้าตามระยะทางที่ต้องการทดสอบ
      const offsetLat = (distanceKm / 111);
      const merchantLat = userLocation.lat + offsetLat;
      const merchantLon = userLocation.lon;

      const demoQr = await generateDynamicQr({
        amount,
        latitude: merchantLat,
        longitude: merchantLon,
        shopName,
      });

      setQrReference(demoQr.qrReference);
      previewMutation.mutate({ ref: demoQr.qrReference });
    } catch (e: any) {
      setCheckoutError('ไม่สามารถสร้าง QR ตัวอย่างได้: ' + (e.message || ''));
    }
  };

  // เมื่อกล้องอ่าน QR ได้ → ตรวจสอบรายการทันที (ไม่ต้องกดปุ่มเพิ่ม)
  const handleDetected = (text: string) => {
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
      <div className="bg-white border-b border-hairline px-4 md:px-8 py-2.5 md:py-3.5 mb-3 md:mb-4 shadow-2xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <button
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="flex items-center space-x-1.5 rounded-pill px-2.5 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline shrink-0"
              title="กลับกระเป๋าเงิน"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">กลับกระเป๋าเงิน</span>
            </button>
            <div className="border-l border-hairline pl-3 min-w-0">
              <h1 className="text-base md:text-lg font-bold text-ink truncate">สแกนชำระเงินร่วม</h1>
              <p className="hidden sm:block text-xs text-brand-blue font-medium">สแกน Dynamic QR ร้านค้าเพื่อรับสิทธิรัฐช่วยจ่าย</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-xs font-mono shrink-0">
            <span className="text-ink-muted hidden sm:inline">กระเป๋าส่วนตัว:</span>
            <span className="font-bold text-ink">฿{(wallet?.balance ?? 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 space-y-3 md:space-y-4">
        {/* กล่องแจ้งเตือนข้อผิดพลาด (ถ้ามี) - แสดงด้านบนสุด เด่นชัดทั้งบนมือถือและคอม */}
        {checkoutError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-status-error flex items-start space-x-2.5 shadow-xs animate-in fade-in">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1">
              <p className="font-bold text-sm text-red-700">แจ้งเตือนระบบ</p>
              <p className="mt-0.5 text-red-800 font-medium">{checkoutError}</p>
            </div>
            <button
              onClick={() => setCheckoutError(null)}
              className="text-red-400 hover:text-red-700 p-0.5"
              title="ปิดข้อความแจ้งเตือน"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* ส่วนจำลองสแกน QR และเลือกตัวอย่างทดสอบ (Responsive 2-Column บน Desktop) */}
        {!scannedData ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-start animate-in fade-in duration-200">
            {/* Left Column: กล้องสแกน QR สด (md:col-span-6) */}
            <div className="md:col-span-6 space-y-3">
              <section className="rounded-card border border-hairline bg-white p-3 shadow-sm">
                <div className="relative">
                  <QrCameraScanner
                    active={!scannedData && !previewMutation.isPending}
                    onDetected={handleDetected}
                    className="w-full aspect-square max-h-[58vh] mx-auto"
                  />
                  {previewMutation.isPending && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-black/60 text-white text-sm font-medium">
                      <RefreshCw className="h-6 w-6 animate-spin mb-2" />
                      กำลังตรวจสอบรายการ...
                    </div>
                  )}
                </div>

                {/* กรอกรหัส QR ด้วยตนเอง (สำรองกรณีกล้องใช้ไม่ได้) */}
                <button
                  type="button"
                  onClick={() => setShowManualInput((v) => !v)}
                  className="mt-2.5 w-full flex items-center justify-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"
                >
                  <span>กรอกรหัส QR ด้วยตนเอง</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition ${showManualInput ? 'rotate-180' : ''}`} />
                </button>
                {showManualInput && (
                  <div className="mt-2 flex space-x-2">
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
                      className="rounded-pill bg-brand-blue px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-blue-hover disabled:opacity-40 flex-shrink-0"
                    >
                      {previewMutation.isPending ? 'ตรวจ...' : 'ตรวจสอบ'}
                    </button>
                  </div>
                )}
              </section>
            </div>

            {/* Right Column: Demo Merchants & Co-pay Info (md:col-span-6 space-y-4) */}
            <div className="md:col-span-6 space-y-4">
              <div className="rounded-card border border-hairline bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-brand-blue" />
                  <h3 className="text-sm font-semibold text-ink">ทดสอบสแกนร้านค้าจำลองทันที</h3>
                </div>
                <p className="text-xs text-ink-muted">
                  สำหรับทดสอบระบบ (ใช้เมื่อไม่มี QR จริง):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoScan(120, 'ร้านข้าวมันไก่ป้าณี (หน้าร้าน 40ม.)', 0.04)}
                    className="rounded-2xl border border-hairline bg-surface-soft p-3 text-left transition hover:border-brand-blue hover:bg-blue-50/40"
                  >
                    <div className="flex items-center space-x-2 font-medium text-xs text-ink">
                      <Store className="h-4 w-4 text-brand-blue flex-shrink-0" />
                      <span className="font-bold">ร้านข้าวมันไก่ป้าณี</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-ink-muted">
                      <span>ยอด ฿120</span>
                      <span className="text-status-success font-semibold">ยอดปกติ</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDemoScan(250, 'ร้านก๋วยเตี๋ยวเรืออยุธยา (หน้าร้าน 80ม.)', 0.08)}
                    className="rounded-2xl border border-hairline bg-surface-soft p-3 text-left transition hover:border-brand-blue hover:bg-blue-50/40"
                  >
                    <div className="flex items-center space-x-2 font-medium text-xs text-ink">
                      <Store className="h-4 w-4 text-brand-blue flex-shrink-0" />
                      <span className="font-bold">ก๋วยเตี๋ยวเรืออยุธยา</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-ink-muted">
                      <span>ยอด ฿250 (ยอดเกินโควตา 150)</span>
                      <span className="text-brand-blue font-semibold">ทดสอบ Co-pay เพดาน</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* ข้อแนะนำโครงการ Co-pay */}
              <div className="rounded-card border border-blue-100 bg-blue-50/50 p-4 space-y-2 text-xs">
                <span className="font-semibold text-brand-blue block">💡 หลักการสแกนชำระ Co-pay 60/40:</span>
                <ul className="space-y-1.5 text-ink-muted list-disc list-inside">
                  <li>รัฐบาลออกให้ 60% สูงสุด ฿150 ต่อวัน</li>
                  <li>ประชาชนจ่าย 40% จากยอดเงินในกระเป๋าดิจิทัล</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* ส่วนแสดงรายละเอียดและยืนยันชำระเงินร่วม (Co-pay 60/40 Breakdown บน Desktop 2 คอลัมน์) */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start animate-in fade-in duration-200">
            {/* Left Column: Shop Info, Coupon, Breakdown (md:col-span-7 space-y-4) */}
            <div className="md:col-span-7 space-y-4">
              {/* ข้อมูลร้านค้าที่สแกน */}
              <div className="rounded-card border border-hairline bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue shadow-xs">
                      <Store className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-ink">{scannedData.qrData.shopName}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="font-mono text-xs text-ink-muted">
                          Ref: {scannedData.qrData.qrReference}
                        </span>
                        <span className="inline-flex items-center space-x-1 rounded-pill bg-blue-50 px-2 py-0.5 text-[10px] font-mono font-bold text-brand-blue border border-blue-200">
                          <Clock className="h-3 w-3" />
                          <span>อายุ QR: {formattedPreviewTimer} น.</span>
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
                    className="rounded-pill bg-gray-100 px-3 py-1.5 text-xs text-brand-blue font-medium hover:bg-gray-200 transition"
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
                    className="w-full flex items-center justify-between"
                  >
                    <span className="text-xs font-semibold text-ink flex items-center space-x-1.5">
                      <Gift className="h-3.5 w-3.5 text-brand-blue" />
                      <span>มีคูปองส่วนลด / โค้ดเพื่อน?</span>
                    </span>
                    {appliedDiscount ? (
                      <span className="rounded-pill bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-status-success border border-emerald-200 flex items-center space-x-1">
                        <Check className="h-3 w-3" />
                        <span>ใช้โค้ดแล้ว</span>
                      </span>
                    ) : (
                      <ChevronDown className={`h-4 w-4 text-ink-muted transition ${showCoupon ? 'rotate-180' : ''}`} />
                    )}
                  </button>

                  {(showCoupon || appliedDiscount) && (
                  <div className="mt-2">
                  {!appliedDiscount ? (
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <div className="relative flex-1">
                          <Tag className="absolute left-3 top-2.5 h-3.5 w-3.5 text-ink-muted" />
                          <input
                            id="input-discount-code"
                            type="text"
                            placeholder="กรอกโค้ด เช่น FRIEND30, DUO50"
                            value={discountCodeInput}
                            onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleApplyDiscount(discountCodeInput);
                              }
                            }}
                            className="w-full rounded-pill border border-hairline pl-8 pr-3 py-2 text-xs font-mono text-ink placeholder:font-sans focus:border-brand-blue focus:outline-none uppercase"
                          />
                        </div>
                        <button
                          id="btn-apply-discount"
                          type="button"
                          disabled={!discountCodeInput.trim() || discountMutation.isPending}
                          onClick={() => handleApplyDiscount(discountCodeInput)}
                          className="rounded-pill bg-brand-blue px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-blue-hover disabled:opacity-40"
                        >
                          {discountMutation.isPending ? 'ตรวจ...' : 'ใช้โค้ด'}
                        </button>
                      </div>

                      {discountError && (
                        <p className="text-[11px] text-status-error flex items-center space-x-1">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          <span>{discountError}</span>
                        </p>
                      )}

                      {/* Quick pills สำหรับแนะนำโค้ดคำชวนเพื่อนและคูปองทดสอบ */}
                      <div className="pt-1">
                        <span className="text-[10px] text-ink-muted block mb-1">
                          ⚡ โค้ดทดสอบด่วน:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setDiscountCodeInput('FRIEND30');
                              handleApplyDiscount('FRIEND30');
                            }}
                            className="rounded-pill border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[10px] font-medium text-emerald-800 transition hover:bg-emerald-100 flex items-center space-x-1"
                          >
                            <Users className="h-3 w-3 text-emerald-600" />
                            <span>FRIEND30 (ลด ฿30 เพื่อนสมชาย)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDiscountCodeInput('DUO50');
                              handleApplyDiscount('DUO50');
                            }}
                            className="rounded-pill border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-[10px] font-medium text-brand-blue transition hover:bg-blue-100 flex items-center space-x-1"
                          >
                            <Tag className="h-3 w-3 text-brand-blue" />
                            <span>DUO50 (ลด ฿50 Duo Special)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDiscountCodeInput('WELCOME20');
                              handleApplyDiscount('WELCOME20');
                            }}
                            className="rounded-pill border border-hairline bg-surface-soft px-2.5 py-1 text-[10px] font-medium text-ink transition hover:bg-gray-100 flex items-center space-x-1"
                          >
                            <Gift className="h-3 w-3 text-ink-muted" />
                            <span>WELCOME20 (ลด ฿20)</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-900">
                          <Tag className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="font-mono">{appliedDiscount.code}</span>
                          <span className="rounded-pill bg-emerald-200/80 px-2 py-0.2 text-[10px] text-emerald-800">
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
                        className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 transition"
                        title="ยกเลิกการใช้โค้ดนี้"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  </div>
                  )}
                </div>

                {/* รายละเอียดการคำนวณ Co-pay 60/40 */}
                <div className="mt-3 rounded-2xl border border-hairline bg-surface-soft p-3.5 space-y-2">
                  {/* ยอดรวมสินค้าเดิม */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-ink-muted">ยอดรวมสินค้า (100%)</span>
                    <span className={`font-mono ${scannedData.copaySplit?.discountAmount ? 'line-through text-ink-muted text-xs' : 'font-bold text-ink'}`}>
                      ฿{(scannedData.copaySplit?.originalTotalAmount ?? scannedData.qrData.totalAmount).toFixed(2)}
                    </span>
                  </div>

                  {/* แถวแสดงส่วนลดคูปอง/โค้ดเพื่อน */}
                  {scannedData.copaySplit?.discountAmount && scannedData.copaySplit.discountAmount > 0 ? (
                    <>
                      <div className="flex justify-between items-center text-sm text-emerald-700 font-medium">
                        <span className="flex items-center space-x-1">
                          <Gift className="h-3.5 w-3.5 text-emerald-600" />
                          <span>ส่วนลดคูปอง / โค้ดชวนเพื่อน ({scannedData.copaySplit.discountCode})</span>
                        </span>
                        <span className="font-mono font-bold">
                          - ฿{scannedData.copaySplit.discountAmount.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs text-ink-muted border-b border-hairline pb-2">
                        <span>ยอดสุทธิก่อนแบ่ง Co-pay 60/40</span>
                        <span className="font-mono font-semibold text-ink">
                          ฿{scannedData.copaySplit.netTotalAmount?.toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : null}

                  {/* รัฐบาลช่วยจ่าย 60% */}
                  <div className="flex justify-between items-center text-sm text-brand-blue">
                    <span className="flex items-center space-x-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>รัฐบาลช่วยจ่าย 60%</span>
                    </span>
                    <span className="font-mono font-bold">
                      - ฿{(scannedData.copaySplit?.governmentCopayAmount ?? scannedData.qrData.estimatedGovCopay).toFixed(2)}
                    </span>
                  </div>

                  {/* ประชาชนจ่ายจริง 40% */}
                  <div className="border-t border-hairline pt-2.5 flex justify-between items-center text-sm font-semibold">
                    <span className="text-ink">ประชาชนจ่ายจริง (40%)</span>
                    <span className="font-mono text-2xl font-bold text-status-error">
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

            {/* Right Column: PIN & Confirm Checkout (md:col-span-5) */}
            <div className="md:col-span-5 space-y-4">
              {/* ยอดเงินคงเหลือ + PIN + ปุ่มยืนยัน รวมไว้การ์ดเดียว */}
              <div className="rounded-card border border-hairline bg-white p-4 md:p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-muted font-medium">ยอดเงินในกระเป๋า</span>
                  <span className="font-mono text-sm font-bold text-ink">
                    ฿{(wallet?.balance ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {wallet && wallet.balance < (scannedData.copaySplit?.citizenPaidAmount ?? scannedData.qrData.estimatedCitizenPay) && (
                  <p className="text-xs text-status-error font-medium">
                    ⚠️ ยอดเงินในกระเป๋าไม่เพียงพอ กรุณาเติมเงินก่อนทำรายการ
                  </p>
                )}

                <label className="block text-xs font-semibold text-ink flex items-center space-x-1.5 pt-1 border-t border-hairline">
                  <Lock className="h-4 w-4 text-brand-blue mt-2" />
                  <span className="mt-2">รหัส PIN (6 หลัก)</span>
                </label>
                <input
                  id="input-copay-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="******"
                  className="w-full text-center tracking-[0.5em] font-mono text-2xl rounded-pill border border-hairline py-2.5 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                />

                {/* ปุ่มยืนยันชำระเงิน */}
                <button
                  id="btn-confirm-checkout"
                  disabled={checkoutMutation.isPending || (wallet ? wallet.balance < (scannedData.copaySplit?.citizenPaidAmount ?? scannedData.qrData.estimatedCitizenPay) : false)}
                  onClick={() => checkoutMutation.mutate()}
                  className="w-full flex items-center justify-center space-x-2 rounded-card bg-brand-blue py-3.5 text-white text-base font-semibold shadow-lg shadow-blue-500/20 transition hover:bg-brand-blue-hover active:scale-98 disabled:opacity-50"
                >
                  {checkoutMutation.isPending ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span>กำลังทำรายการ...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
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

        {/* แถบแจ้งความปลอดภัย (ข้อความทั่วไป ไม่เปิดเผยรายละเอียดการตรวจสอบภายใน) */}
        <div className="pt-1 text-center text-[11px] text-ink-muted flex items-center justify-center space-x-1.5 pb-4">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>ทำรายการอย่างปลอดภัย</span>
        </div>
      </main>
    </div>
  );
};
