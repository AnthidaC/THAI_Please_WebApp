import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  Sparkles,
  MapPin,
  RefreshCw,
  Download,
  Store,
  CheckCircle2,
  TrendingUp,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';
import { generateDynamicQr, getMerchantHistory, DynamicQrResponse } from '../../../services/paymentApi';
import { APP_ROUTES } from '../../../constants/routes';

export const MerchantPosQrPage: React.FC = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<number>(100);
  const [merchantCoords, setMerchantCoords] = useState<{ lat: number; lon: number }>({
    lat: 13.7563,
    lon: 100.5018,
  });
  const [qrResult, setQrResult] = useState<DynamicQrResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ดึงข้อมูลร้านค้าจริงจากระบบอัตโนมัติ (ไม่ต้องกรอกเองทุกครั้ง)
  const { data: merchantData, isLoading: isMerchantLoading } = useQuery({
    queryKey: ['merchant-profile'],
    queryFn: () => getMerchantHistory(),
  });

  // ซิงค์พิกัดร้านค้าจากข้อมูลระบบหรือเบราว์เซอร์
  useEffect(() => {
    if (merchantData?.merchant?.latitude && merchantData?.merchant?.longitude) {
      setMerchantCoords({
        lat: merchantData.merchant.latitude,
        lon: merchantData.merchant.longitude,
      });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setMerchantCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      });
    }
  }, [merchantData]);

  // วาด QR Code ลงบน Canvas เมื่อสลับเข้าสู่หน้า QR Result
  useEffect(() => {
    if (qrResult && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        qrResult.qrReference,
        {
          width: 280,
          margin: 2,
          color: {
            dark: '#0a0b0d',
            light: '#ffffff',
          },
        },
        (err) => {
          if (err) console.error('QR rendering error:', err);
        }
      );
    }
  }, [qrResult]);

  const handleGenerate = async () => {
    if (amount <= 0) return;
    setIsGenerating(true);
    try {
      const activeShopName =
        merchantData?.merchant?.shopName || 'ร้านข้าวมันไก่ป้าณี (วิสาหกิจชุมชน)';
      const activeMerchantId = merchantData?.merchant?.merchantId;

      const result = await generateDynamicQr({
        amount,
        latitude: merchantCoords.lat,
        longitude: merchantCoords.lon,
        shopName: activeShopName,
        merchantId: activeMerchantId,
      });
      // เด้งเข้าสู่หน้าแสดง QR Code ทันที ไม่ต้องเลื่อนจอ
      setQrResult(result);
    } catch (err: any) {
      console.error(err);
      alert('ไม่สามารถสร้าง QR ได้: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadQr = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR-${qrResult?.qrReference || 'payment'}.png`;
    a.click();
  };

  const handleCopyRef = () => {
    if (qrResult?.qrReference) {
      navigator.clipboard.writeText(qrResult.qrReference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentShopName =
    merchantData?.merchant?.shopName || (isMerchantLoading ? 'กำลังโหลดข้อมูลร้าน...' : 'ร้านข้าวมันไก่ป้าณี (วิสาหกิจชุมชน)');

  return (
    <div className="min-h-screen bg-surface-soft pb-20 font-sans text-ink">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 border-b border-hairline bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button
            onClick={() => {
              if (qrResult) {
                setQrResult(null);
              } else {
                navigate(APP_ROUTES.HOME);
              }
            }}
            className="flex items-center space-x-1.5 rounded-full p-1.5 text-xs font-medium text-ink-muted hover:bg-gray-100 hover:text-ink transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{qrResult ? 'กลับหน้าตั้งยอด' : 'หน้าหลัก'}</span>
          </button>
          <div className="text-right">
            <span className="text-xs font-semibold text-ink">สร้าง Dynamic QR รับเงิน</span>
            <span className="block text-[10px] text-brand-blue">ร้านค้า (POS Co-pay)</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
        {/* VIEW 1: หน้าฟอร์มตั้งยอดเงิน (แสดงเมื่อยังไม่ได้สร้าง QR หรือกดสร้างบิลใหม่) */}
        {!qrResult ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* ข้อมูลร้านค้าดึงจากระบบอัตโนมัติ (ไม่ต้องพิมพ์ตั้งชื่อเอง) */}
            <div className="rounded-card border border-hairline bg-white p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue flex-shrink-0">
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[10px] text-ink-muted font-medium">ร้านค้าที่เข้าสู่ระบบ (ดึงจากระบบ)</div>
                  <div className="text-sm font-bold text-ink flex items-center space-x-1 mt-0.5">
                    <span>{currentShopName}</span>
                    <span className="rounded-full bg-emerald-100 p-0.5 text-status-success" title="ร้านค้าลงทะเบียนถูกต้อง">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="text-[10px] text-ink-muted font-mono mt-0.5 flex items-center space-x-2">
                    <span className="flex items-center">
                      <MapPin className="h-3 w-3 text-brand-blue mr-0.5" />
                      {merchantCoords.lat.toFixed(4)}, {merchantCoords.lon.toFixed(4)}
                    </span>
                    <span>• {merchantData?.merchant?.taxId || 'TAX-0105567890'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ฟอร์มตั้งยอดเงินและปุ่มลัด */}
            <div className="rounded-card border border-hairline bg-white p-5 shadow-sm space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">
                  ระบุยอดเงินค่าสินค้า / บริการที่ต้องการเรียกเก็บ
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xl font-bold text-ink-muted">
                    ฿
                  </span>
                  <input
                    id="input-pos-amount"
                    type="number"
                    min="1"
                    max="100000"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full rounded-pill border border-hairline pl-10 pr-4 py-3 font-mono text-2xl font-bold text-ink focus:border-brand-blue focus:outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* ปุ่มลัดเลือกยอดเงินด่วน */}
              <div>
                <span className="text-[11px] font-medium text-ink-muted mb-2 block">
                  ⚡ ยอดเงินด่วนยอดนิยม:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[40, 60, 100, 120, 150, 250].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset)}
                      className={`rounded-pill border py-2 text-xs font-mono font-medium transition ${
                        amount === preset
                          ? 'border-brand-blue bg-blue-50 text-brand-blue font-bold shadow-sm'
                          : 'border-hairline text-ink hover:bg-gray-50'
                      }`}
                    >
                      ฿{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* สรุปสัดส่วน Co-pay 60/40 ล่วงหน้า */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">ลูกค้าสแกนจ่าย 40%:</span>
                  <span className="font-mono font-bold text-ink text-sm">
                    ฿{Math.max(0, amount - Math.min(amount * 0.6, 150)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-brand-blue">
                  <span className="flex items-center space-x-1">
                    <Sparkles className="h-3 w-3" />
                    <span>รัฐบาลสมทบ 60%:</span>
                  </span>
                  <span className="font-mono font-bold text-sm">
                    ฿{Math.min(amount * 0.6, 150).toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-blue-200/60 pt-2 flex justify-between font-semibold">
                  <span className="text-ink">ยอดขายรวมที่ร้านได้รับ:</span>
                  <span className="font-mono text-status-success text-base">฿{amount.toFixed(2)}</span>
                </div>
              </div>

              {/* ปุ่มสร้าง QR รับเงิน (กดแล้วเด้งไปหน้า QR ทันที ไม่ต้องเลื่อนจอ) */}
              <button
                id="btn-generate-qr"
                disabled={isGenerating || amount <= 0}
                onClick={handleGenerate}
                className="w-full flex items-center justify-center space-x-2 rounded-pill bg-brand-blue py-4 text-white text-base font-semibold shadow-lg shadow-blue-500/20 transition hover:bg-brand-blue-hover active:scale-98 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>กำลังสร้าง QR รับเงิน...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="h-5 w-5" />
                    <span>สร้าง QR รับเงิน (฿{amount.toLocaleString()})</span>
                  </>
                )}
              </button>
            </div>

            {/* ปุ่มทางลัดไปหน้าดูประวัติยอดขาย */}
            <button
              onClick={() => navigate(APP_ROUTES.MERCHANT_SALES)}
              className="w-full flex items-center justify-center space-x-2 rounded-pill border border-hairline bg-white py-3 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-gray-50 transition shadow-sm"
            >
              <TrendingUp className="h-4 w-4 text-brand-blue" />
              <span>ดูสรุปยอดขายและเงินอุดหนุนรัฐบาล</span>
            </button>
          </div>
        ) : (
          /* VIEW 2: หน้าจอแสดงผล QR Code ให้ลูกค้าสแกนทันที (เด้งหน้าใหม่ เต็มตา ไม่ต้องเลื่อนจอ) */
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="rounded-card border border-hairline bg-white p-6 shadow-lg text-center">
              {/* Badge สถานะพร้อมสแกน */}
              <span className="inline-flex items-center space-x-1.5 rounded-pill bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-status-success border border-emerald-200 mb-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>Dynamic QR พร้อมให้ลูกค้าสแกน</span>
              </span>

              {/* ชื่อร้านค้า (ดึงจากระบบ) */}
              <h2 className="text-base font-bold text-ink mt-1">{qrResult.shopName}</h2>

              {/* ยอดเงินใหญ่ ชัดเจน ไม่ต้องเลื่อนจอ */}
              <div className="my-2">
                <span className="text-[11px] text-ink-muted">ยอดรวมที่ต้องชำระ</span>
                <div className="font-mono text-4xl font-extrabold text-brand-blue">
                  ฿ {qrResult.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* สรุปสัดส่วน Co-pay */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-2.5 text-xs space-y-1 mb-3">
                <div className="flex justify-between text-ink-muted">
                  <span>ลูกค้าสแกนจ่าย 40%:</span>
                  <span className="font-mono font-bold text-ink">฿{(qrResult.estimatedCitizenPay).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-brand-blue">
                  <span>รัฐช่วยสมทบ 60%:</span>
                  <span className="font-mono font-bold">฿{(qrResult.estimatedGovCopay).toFixed(2)}</span>
                </div>
              </div>

              {/* Canvas QR Code ขนาด 280x280 ชัดเจนตรงกลางจอ */}
              <div className="relative mx-auto my-2 flex items-center justify-center rounded-3xl border-2 border-hairline bg-white p-3 shadow-sm max-w-[305px]">
                <canvas ref={canvasRef} className="mx-auto block" />
              </div>

              {/* Reference number and copy button */}
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-ink-muted bg-surface-soft px-3.5 py-2 rounded-pill border border-hairline">
                <span className="truncate">Ref: {qrResult.qrReference}</span>
                <button
                  onClick={handleCopyRef}
                  className="flex items-center space-x-1 text-brand-blue font-sans font-semibold hover:underline ml-2 flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-status-success" />
                      <span className="text-status-success">คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>คัดลอก</span>
                    </>
                  )}
                </button>
              </div>

              {/* ปุ่มสร้างบิลใหม่ และบันทึกรูป */}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleDownloadQr}
                  className="flex items-center justify-center space-x-1.5 rounded-pill border border-hairline bg-white py-3 text-xs font-semibold text-ink shadow-sm hover:bg-gray-50 transition active:scale-95"
                >
                  <Download className="h-4 w-4 text-brand-blue" />
                  <span>บันทึกรูป QR</span>
                </button>

                <button
                  id="btn-create-new-bill"
                  onClick={() => {
                    setQrResult(null);
                    setAmount(100);
                  }}
                  className="flex items-center justify-center space-x-1.5 rounded-pill bg-brand-blue py-3 text-xs font-semibold text-white shadow-md hover:bg-brand-blue-hover transition active:scale-95"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>สร้างบิลใหม่</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
