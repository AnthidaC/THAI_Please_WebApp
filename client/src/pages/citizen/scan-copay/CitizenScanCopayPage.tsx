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
} from 'lucide-react';
import {
  getWalletBalance,
  getQrDetails,
  checkoutCopay,
  generateDynamicQr,
  CopayPreviewData,
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

  // Mutation ตรวจสอบรหัส QR เพื่อพรีวิวยอดเงิน Co-pay
  const previewMutation = useMutation({
    mutationFn: (ref: string) => getQrDetails(ref),
    onSuccess: (data) => {
      setScannedData(data);
      setCheckoutError(null);
    },
    onError: (err: any) => {
      setCheckoutError(err.response?.data?.message || err.message || 'ไม่พบข้อมูล QR Code');
    },
  });

  // Mutation ชำระเงินร่วม
  const checkoutMutation = useMutation({
    mutationFn: () =>
      checkoutCopay({
        qrReference,
        userLatitude: userLocation.lat,
        userLongitude: userLocation.lon,
        merchantId: scannedData?.qrData.merchantId,
        pin,
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
      previewMutation.mutate(demoQr.qrReference);
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
                  onClick={() => previewMutation.mutate(qrReference)}
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
                  onClick={() => setScannedData(null)}
                  className="rounded-full text-xs text-brand-blue hover:underline"
                >
                  สแกนใหม่
                </button>
              </div>

              {/* รายละเอียดการคำนวณ Co-pay 60/40 */}
              <div className="mt-5 rounded-2xl border border-hairline bg-surface-soft p-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-ink-muted">ยอดรวมทั้งสิ้น (100%)</span>
                  <span className="font-mono font-bold text-base text-ink">
                    ฿{scannedData.qrData.totalAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm text-brand-blue">
                  <span className="flex items-center space-x-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>รัฐบาลช่วยจ่าย 60%</span>
                  </span>
                  <span className="font-mono font-bold">
                    - ฿{(scannedData.copaySplit?.governmentCopayAmount ?? scannedData.qrData.estimatedGovCopay).toFixed(2)}
                  </span>
                </div>

                <div className="border-t border-hairline pt-2.5 flex justify-between items-center text-sm font-semibold">
                  <span className="text-ink">ประชาชนจ่ายจริง (40%)</span>
                  <span className="font-mono text-xl text-status-error">
                    ฿{(scannedData.copaySplit?.citizenPaidAmount ?? scannedData.qrData.estimatedCitizenPay).toFixed(2)}
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
