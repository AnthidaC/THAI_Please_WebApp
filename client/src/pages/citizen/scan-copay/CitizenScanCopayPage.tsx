import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  QrCode,
  MapPin,
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

export const CitizenScanCopayPage: React.FC = () => {
  const navigate = useNavigate();

  // สถานะพิกัด GPS ผู้ใช้ (เริ่มต้นใช้พิกัดจริง หรือพิกัดใจกลางเมืองสำหรับทดสอบ)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number }>({
    lat: 13.7563,
    lon: 100.5018,
  });
  const [isGpsLoading, setIsGpsLoading] = useState<boolean>(true);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // ข้อมูล QR และการเลือกสแกน
  const [qrReference, setQrReference] = useState<string>('');
  const [scannedData, setScannedData] = useState<CopayPreviewData | null>(null);
  const [pin, setPin] = useState<string>('123456');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // ข้อมูลคูปองส่วนลดและโค้ดคำชวนของเพื่อน (Friend Referral / Duo Coupon)
  const [discountCodeInput, setDiscountCodeInput] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountValidationResult | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);

  // ดึงข้อมูลกระเป๋าเงินเพื่อตรวจสอบยอดเงินและโควตา
  const { data: wallet } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: getWalletBalance,
  });

  // ขอพิกัด GPS จริงจากเบราว์เซอร์
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
          setIsGpsLoading(false);
        },
        (err) => {
          console.warn('Geolocation error or denied:', err);
          // ใช้พิกัดกรุงเทพฯ เป็น Fallback พร้อมแจ้งเตือน
          setGpsError('ไม่สามารถดึง GPS จริงได้ ใช้พิกัดจำลองในพื้นที่ทดสอบ');
          setIsGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setGpsError('อุปกรณ์นี้ไม่รองรับ Geolocation');
      setIsGpsLoading(false);
    }
  }, []);

  // Mutation ตรวจสอบรหัส QR เพื่อพรีวิวยอดเงิน Co-pay (รองรับ discountCode)
  const previewMutation = useMutation({
    mutationFn: ({ ref, code }: { ref: string; code?: string }) => getQrDetails(ref, code),
    onSuccess: (data) => {
      setScannedData(data);
      if (data.discountInfo) {
        setAppliedDiscount(data.discountInfo);
      }
      setCheckoutError(null);
    },
    onError: (err: any) => {
      setCheckoutError(err.response?.data?.message || err.message || 'ไม่พบข้อมูล QR Code');
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
      setCheckoutError(err.response?.data?.message || err.message || 'การชำระเงินไม่สำเร็จ');
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

  return (
    <div className="min-h-screen bg-surface-soft pb-24 font-sans text-ink">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 border-b border-hairline bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button
            onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
            className="flex items-center space-x-1.5 rounded-full p-1.5 text-xs font-medium text-ink-muted hover:bg-gray-100 hover:text-ink transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>กลับกระเป๋าเงิน</span>
          </button>
          <div className="text-right">
            <span className="text-xs font-semibold text-ink">สแกนชำระเงินร่วม</span>
            <span className="block text-[10px] text-brand-blue">Co-pay (60/40)</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
        {/* แถบสถานะพิกัด GPS ผู้ใช้ */}
        <div className="rounded-card border border-hairline bg-white p-3.5 shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isGpsLoading ? 'bg-amber-100 text-amber-600 animate-pulse' : 'bg-emerald-100 text-status-success'}`}>
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-ink flex items-center space-x-1.5">
                <span>พิกัด GPS ผู้ซื้อ:</span>
                <span className="font-mono text-[11px] text-ink-muted">
                  {userLocation.lat.toFixed(4)}, {userLocation.lon.toFixed(4)}
                </span>
              </div>
              <span className="text-[10px] text-ink-muted">
                {isGpsLoading ? 'กำลังดึงพิกัดผ่านดาวเทียม...' : gpsError || 'พร้อมตรวจสอบความปลอดภัยตำแหน่งจริง'}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setIsGpsLoading(true);
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                  setIsGpsLoading(false);
                });
              }
            }}
            className="rounded-full p-1 text-ink-muted hover:bg-gray-100"
            title="รีเฟรชพิกัด GPS"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isGpsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ส่วนจำลองสแกน QR และเลือกตัวอย่างทดสอบ */}
        {!scannedData ? (
          <section className="rounded-card border border-hairline bg-white p-6 text-center shadow-sm">
            <div className="relative mx-auto flex h-48 w-48 items-center justify-center rounded-3xl border-2 border-dashed border-brand-blue bg-blue-50/50">
              <QrCode className="h-20 w-20 text-brand-blue animate-pulse" />
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_red] animate-bounce" />
            </div>

            <p className="mt-4 text-sm font-semibold text-ink">
              สแกน QR Code รับเงินของร้านค้า
            </p>
            <p className="text-xs text-ink-muted mt-1">
              รองรับ Dynamic QR โครงการไทยช่วยไทยพลีส
            </p>

            {/* ช่องกรอกหรือค้นหา QR Reference ด้วยตนเอง */}
            <div className="mt-5 space-y-2">
              <div className="flex space-x-2">
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
                  className="rounded-pill bg-brand-blue px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-brand-blue-hover disabled:opacity-40"
                >
                  {previewMutation.isPending ? 'ตรวจ...' : 'ตรวจสอบ'}
                </button>
              </div>

              {/* ปุ่มลัดสร้าง QR ตัวอย่างหน้าร้านสำหรับทดสอบความเร็วสูง */}
              <div className="pt-3 border-t border-hairline">
                <span className="text-[11px] font-medium text-ink-muted block mb-2">
                  ⚡ เลือกทดสอบร้านค้าจำลองทันที:
                </span>
                <div className="grid grid-cols-2 gap-2 text-left">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoScan(120, 'ร้านข้าวมันไก่ป้าณี (หน้าร้าน 40ม.)', 0.04)}
                    className="rounded-2xl border border-hairline bg-surface-soft p-2.5 text-left transition hover:border-brand-blue hover:bg-blue-50/40"
                  >
                    <div className="flex items-center space-x-1.5 font-medium text-xs text-ink">
                      <Store className="h-3.5 w-3.5 text-brand-blue" />
                      <span className="truncate">ข้าวมันไก่ป้าณี</span>
                    </div>
                    <span className="text-[10px] text-ink-muted block mt-0.5">ยอด ฿120 (หน้าร้านปกติ)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDemoScan(250, 'ร้านก๋วยเตี๋ยวเรืออยุธยา (หน้าร้าน 80ม.)', 0.08)}
                    className="rounded-2xl border border-hairline bg-surface-soft p-2.5 text-left transition hover:border-brand-blue hover:bg-blue-50/40"
                  >
                    <div className="flex items-center space-x-1.5 font-medium text-xs text-ink">
                      <Store className="h-3.5 w-3.5 text-brand-blue" />
                      <span className="truncate">ก๋วยเตี๋ยวเรือ</span>
                    </div>
                    <span className="text-[10px] text-ink-muted block mt-0.5">ยอด ฿250 (ยอดเกินโควตา 150)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDemoScan(500, 'ร้านของฝากชุมชน (ห่าง 6.2 กม. ทุจริต)', 6.2)}
                    className="col-span-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-2.5 text-left transition hover:border-amber-400"
                  >
                    <div className="flex items-center space-x-1.5 font-medium text-xs text-amber-900">
                      <AlertTriangle className="h-3.5 w-3.5 text-status-warning" />
                      <span>ทดสอบระบบตรวจทุจริต: ร้านอยู่ห่าง 6.2 กม. (เกินระยะ)</span>
                    </div>
                    <span className="text-[10px] text-amber-700 block mt-0.5">
                      ทดสอบระบบ Semi-AI และ GPS Flagged แจ้งเตือนทุจริต
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* ส่วนแสดงรายละเอียดและยืนยันชำระเงินร่วม (Co-pay 60/40 Breakdown) */
          <section className="space-y-4 animate-in fade-in duration-200">
            {/* ข้อมูลร้านค้าที่สแกน */}
            <div className="rounded-card border border-hairline bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue">
                    <Store className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-ink">{scannedData.qrData.shopName}</h3>
                    <p className="font-mono text-[11px] text-ink-muted">
                      Ref: {scannedData.qrData.qrReference}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setScannedData(null);
                    setAppliedDiscount(null);
                    setDiscountCodeInput('');
                  }}
                  className="rounded-full text-xs text-brand-blue hover:underline"
                >
                  สแกนใหม่
                </button>
              </div>

              {/* ส่วนกรอกคูปองส่วนลด / โค้ดคำชวนของเพื่อน */}
              <div className="mt-4 pt-3 border-t border-hairline">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-ink flex items-center space-x-1.5">
                    <Gift className="h-3.5 w-3.5 text-brand-blue" />
                    <span>คูปองส่วนลด / โค้ดคำชวนของเพื่อน</span>
                  </label>
                  {appliedDiscount && (
                    <span className="rounded-pill bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-status-success border border-emerald-200 flex items-center space-x-1">
                      <Check className="h-3 w-3" />
                      <span>ใช้โค้ดแล้ว</span>
                    </span>
                  )}
                </div>

                {!appliedDiscount ? (
                  <div className="space-y-2">
                    <div className="flex space-x-1.5">
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
                        className="rounded-pill bg-brand-blue px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-blue-hover disabled:opacity-40"
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
                          className="rounded-pill border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-medium text-emerald-800 transition hover:bg-emerald-100 flex items-center space-x-1"
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
                          className="rounded-pill border border-blue-200 bg-blue-50/80 px-2 py-0.5 text-[10px] font-medium text-brand-blue transition hover:bg-blue-100 flex items-center space-x-1"
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
                          className="rounded-pill border border-hairline bg-surface-soft px-2 py-0.5 text-[10px] font-medium text-ink transition hover:bg-gray-100 flex items-center space-x-1"
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

              {/* รายละเอียดการคำนวณ Co-pay 60/40 */}
              <div className="mt-4 rounded-2xl border border-hairline bg-surface-soft p-4 space-y-2.5">
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

              {/* ยอดเงินในกระเป๋าคงเหลือเทียบกับยอดที่ต้องจ่าย */}
              <div className="mt-3 flex items-center justify-between text-xs text-ink-muted px-1">
                <span>ยอดเงินในกระเป๋าของคุณ:</span>
                <span className="font-mono font-semibold text-ink">
                  ฿{(wallet?.balance ?? 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* ช่องกรอก PIN 6 หลัก */}
            <div className="rounded-card border border-hairline bg-white p-4 shadow-sm">
              <label className="block text-xs font-medium text-ink mb-2 flex items-center space-x-1.5">
                <Lock className="h-3.5 w-3.5 text-brand-blue" />
                <span>รหัส PIN ยืนยันการทำรายการ (6 หลัก)</span>
              </label>
              <input
                id="input-copay-pin"
                type="password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="******"
                className="w-full text-center tracking-[0.5em] font-mono text-lg rounded-pill border border-hairline py-2.5 focus:border-brand-blue focus:outline-none"
              />
            </div>

            {/* ปุ่มยืนยันชำระเงิน */}
            <button
              id="btn-confirm-checkout"
              disabled={checkoutMutation.isPending || (wallet ? wallet.balance < (scannedData.copaySplit?.citizenPaidAmount ?? scannedData.qrData.estimatedCitizenPay) : false)}
              onClick={() => checkoutMutation.mutate()}
              className="w-full flex items-center justify-center space-x-2 rounded-pill bg-brand-blue py-4 text-white text-base font-semibold shadow-lg shadow-blue-500/20 transition hover:bg-brand-blue-hover active:scale-98 disabled:opacity-50"
            >
              {checkoutMutation.isPending ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>ระบบ AI กำลังตรวจสอบความปลอดภัย...</span>
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
          </section>
        )}

        {/* แจ้งเตือนข้อผิดพลาด (ถ้ามี) */}
        {checkoutError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-status-error flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">ไม่สามารถทำรายการได้</p>
              <p className="mt-0.5">{checkoutError}</p>
            </div>
          </div>
        )}

        {/* แถบแจ้งมาตรฐานความปลอดภัยระดับสถาบัน */}
        <div className="pt-2 text-center text-[11px] text-ink-muted flex items-center justify-center space-x-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>ธุรกรรมนี้ได้รับการคุ้มครองด้วยการตรวจสอบพิกัด GPS สดร่วมกับ AI</span>
        </div>
      </main>
    </div>
  );
};
