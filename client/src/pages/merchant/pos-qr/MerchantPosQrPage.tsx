import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Sparkles,
  MapPin,
  RefreshCw,
  Download,
  Store,
  CheckCircle2,
} from 'lucide-react';
import { generateDynamicQr, DynamicQrResponse } from '../../../services/paymentApi';

export const MerchantPosQrPage: React.FC = () => {
  const [amount, setAmount] = useState<number>(100);
  const [shopName, setShopName] = useState<string>('ร้านข้าวมันไก่ป้าณี (วิสาหกิจชุมชน)');
  const [merchantCoords, setMerchantCoords] = useState<{ lat: number; lon: number }>({
    lat: 13.7563,
    lon: 100.5018,
  });
  const [qrResult, setQrResult] = useState<DynamicQrResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ดึงพิกัดร้านค้าจริงจากเบราว์เซอร์
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setMerchantCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      });
    }
  }, []);

  // วาด QR Code ลงบน Canvas เมื่อมี qrResult
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
      const result = await generateDynamicQr({
        amount,
        latitude: merchantCoords.lat,
        longitude: merchantCoords.lon,
        shopName,
      });
      setQrResult(result);
    } catch (err) {
      console.error(err);
      alert('ไม่สามารถสร้าง QR ได้');
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

  return (
    <div className="min-h-screen bg-surface-soft p-4 md:p-8 font-sans text-ink">
      <div className="mx-auto max-w-4xl">
        {/* หัวข้อส่วน POS หน้าร้าน */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Store className="h-6 w-6 text-brand-blue" />
              <h1 className="text-xl font-bold text-ink">ระบบสร้าง Dynamic QR หน้าร้านค้า (POS)</h1>
            </div>
            <p className="text-xs text-ink-muted mt-1">
              สร้าง QR Code รับเงินเฉพาะบิล คำนวณ Co-pay 60/40 พร้อมบันทึกพิกัด GPS หน้าร้าน
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs text-ink-muted bg-white border border-hairline px-3 py-1.5 rounded-pill shadow-sm">
            <MapPin className="h-3.5 w-3.5 text-brand-blue" />
            <span>พิกัดร้านค้า:</span>
            <span className="font-mono text-ink font-semibold">
              {merchantCoords.lat.toFixed(4)}, {merchantCoords.lon.toFixed(4)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* คอลัมน์ซ้าย: ฟอร์มตั้งยอดเงินและร้านค้า */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-card border border-hairline bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-ink mb-4">กำหนดราคาสินค้า / บริการ</h2>

              {/* ชื่อร้านค้า */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-ink-muted mb-1.5">ชื่อร้านค้า</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full rounded-pill border border-hairline px-4 py-2 text-xs focus:border-brand-blue focus:outline-none"
                />
              </div>

              {/* ยอดเงิน */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-ink-muted mb-1.5">
                  ยอดเงินรวมที่ต้องการเรียกเก็บ (บาท)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-ink-muted">
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
                  />
                </div>
              </div>

              {/* ปุ่มเลือกยอดเงินด่วน */}
              <div className="mb-5">
                <span className="text-[11px] text-ink-muted mb-2 block">ปุ่มลัดเลือกยอดเงินด่วน:</span>
                <div className="grid grid-cols-3 gap-2">
                  {[40, 60, 100, 150, 200, 300].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset)}
                      className={`rounded-pill border py-2 text-xs font-mono font-medium transition ${
                        amount === preset
                          ? 'border-brand-blue bg-brand-blue-light text-brand-blue font-bold'
                          : 'border-hairline text-ink hover:bg-gray-50'
                      }`}
                    >
                      ฿{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* สรุปสัดส่วน Co-pay ล่วงหน้า */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-ink-muted">ลูกค้าจ่ายส่วนตัว (40%):</span>
                  <span className="font-mono font-bold text-ink">
                    ฿{Math.max(0, amount - Math.min(amount * 0.6, 150)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-brand-blue">
                  <span className="flex items-center space-x-1">
                    <Sparkles className="h-3 w-3" />
                    <span>รัฐบาลโอนสมทบ (60%):</span>
                  </span>
                  <span className="font-mono font-bold">
                    ฿{Math.min(amount * 0.6, 150).toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-blue-200/60 pt-2 flex justify-between font-semibold">
                  <span>ร้านค้าได้รับเงินรวม:</span>
                  <span className="font-mono text-status-success text-sm">฿{amount.toFixed(2)}</span>
                </div>
              </div>

              {/* ปุ่มสร้าง QR */}
              <button
                id="btn-generate-qr"
                disabled={isGenerating || amount <= 0}
                onClick={handleGenerate}
                className="mt-5 w-full flex items-center justify-center space-x-2 rounded-pill bg-brand-blue py-3.5 text-xs font-semibold text-white shadow-md transition hover:bg-brand-blue-hover active:scale-98 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>กำลังสร้าง Dynamic QR...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4" />
                    <span>สร้าง QR Code รับเงิน (฿{amount.toLocaleString()})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* คอลัมน์ขวา: หน้าจอแสดงผล QR Code ขนาดใหญ่หน้าร้าน */}
          <div className="lg:col-span-7">
            <div className="rounded-card border border-hairline bg-white p-6 shadow-sm flex flex-col items-center justify-center min-h-[460px] text-center">
              {qrResult ? (
                <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
                  <span className="rounded-pill bg-emerald-50 text-status-success text-xs font-semibold px-3 py-1 border border-emerald-200 mb-3 flex items-center space-x-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Dynamic QR พร้อมให้ลูกค้าสแกน</span>
                  </span>

                  <h3 className="text-base font-bold text-ink">{qrResult.shopName}</h3>
                  <div className="font-mono text-3xl font-extrabold text-brand-blue mt-1">
                    ฿ {qrResult.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5">
                    รัฐช่วย 60% สูงสุด ฿150 / ประชาชนจ่าย 40%
                  </p>

                  {/* QR Code Canvas */}
                  <div className="my-5 rounded-3xl border-2 border-hairline p-4 bg-white shadow-sm">
                    <canvas ref={canvasRef} className="mx-auto" />
                  </div>

                  <div className="flex items-center space-x-2 text-xs font-mono text-ink-muted mb-4 bg-surface-soft px-3 py-1.5 rounded-pill border border-hairline">
                    <span>Ref: {qrResult.qrReference}</span>
                    <button
                      onClick={handleCopyRef}
                      className="text-brand-blue hover:underline ml-2 font-sans font-medium"
                    >
                      {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                    </button>
                  </div>

                  {/* ปุ่มดาวน์โหลด QR และรีเฟรช */}
                  <div className="flex space-x-3">
                    <button
                      onClick={handleDownloadQr}
                      className="inline-flex items-center space-x-1.5 rounded-pill border border-hairline bg-white px-4 py-2 text-xs font-semibold text-ink shadow-sm hover:bg-gray-50 transition"
                    >
                      <Download className="h-3.5 w-3.5 text-brand-blue" />
                      <span>ดาวน์โหลดรูปภาพ QR</span>
                    </button>
                    <button
                      onClick={handleGenerate}
                      className="inline-flex items-center space-x-1.5 rounded-pill bg-brand-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-hover transition"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>สร้างบิลใหม่</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-50 text-brand-blue mb-4">
                    <QrCode className="h-12 w-12" />
                  </div>
                  <h3 className="text-base font-semibold text-ink">ยังไม่ได้สร้าง QR Code สำหรับบิลนี้</h3>
                  <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">
                    กรอกยอดเงินและกดปุ่ม "สร้าง QR Code รับเงิน" เพื่อแสดงภาพคิวอาร์โค้ดขนาดใหญ่ให้ลูกค้าสแกน
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
