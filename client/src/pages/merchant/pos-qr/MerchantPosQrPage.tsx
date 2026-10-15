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
  Clock,
  AlertTriangle,
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
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // คำนวณเวลานับถอยหลังของ QR Code (อายุ 3 นาที)
  useEffect(() => {
    if (!qrResult) return;

    const updateTimer = () => {
      const expiryTime = new Date(qrResult.expiresAt).getTime();
      const diffSec = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setSecondsRemaining(diffSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [qrResult]);

  const isExpired = secondsRemaining <= 0;
  const timerMinutes = Math.floor(secondsRemaining / 60);
  const timerSeconds = secondsRemaining % 60;
  const formattedTimer = `${String(timerMinutes).padStart(2, '0')}:${String(timerSeconds).padStart(2, '0')}`;

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

  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  /**
   * ฟังก์ชันวาดกรอบมน (Rounded Rectangle) บน Canvas
   */
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number | { tl?: number; tr?: number; br?: number; bl?: number }
  ) => {
    const tl = typeof r === 'number' ? r : r.tl ?? 0;
    const tr = typeof r === 'number' ? r : r.tr ?? 0;
    const br = typeof r === 'number' ? r : r.br ?? 0;
    const bl = typeof r === 'number' ? r : r.bl ?? 0;

    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  };

  /**
   * สร้างรูปภาพ QR Code พร้อมกรอบและรายละเอียดครบถ้วน เสมือนป้าย QR พร้อมเพย์ของธนาคาร
   */
  const generatePromptPayFramedImage = async (
    qr: DynamicQrResponse,
    shop: string,
    total: number
  ): Promise<string> => {
    const canvas = document.createElement('canvas');
    const w = 720;
    const h = 1060;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    const citizenPay = qr.estimatedCitizenPay;
    const govPay = qr.estimatedGovCopay;

    // 1. วาดการ์ดสีขาวพื้นหลังพร้อมขอบมน (Card Outer Frame)
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, 4, 4, w - 8, h - 8, 36);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 2. วาดแบนเนอร์ส่วนหัวสีน้ำเงินเข้ม (Thai QR / PromptPay Royal Blue Header)
    const headerGrad = ctx.createLinearGradient(0, 0, w, 155);
    headerGrad.addColorStop(0, '#0f2b5c');
    headerGrad.addColorStop(1, '#1a56db');

    ctx.save();
    ctx.fillStyle = headerGrad;
    drawRoundedRect(ctx, 4, 4, w - 8, 155, { tl: 36, tr: 36, bl: 0, br: 0 });
    ctx.fill();
    ctx.restore();

    // ป้ายแถบขาว "THAI QR PAYMENT"
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, (w - 260) / 2, 24, 260, 36, 18);
    ctx.fill();

    ctx.fillStyle = '#0f2b5c';
    ctx.font = 'bold 16px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('THAI QR PAYMENT', w / 2, 42);

    // หัวข้อแบนเนอร์โครงการ
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.fillText('ไทยช่วยไทยพลีส • โครงการ Co-pay 60/40', w / 2, 92);

    ctx.fillStyle = '#bfdbfe';
    ctx.font = '14px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.fillText('สแกน QR เพื่อชำระเงินร่วมกับสิทธิรัฐช่วยจ่าย', w / 2, 122);

    // 3. ข้อมูลร้านค้า (Merchant Info)
    ctx.fillStyle = '#64748b';
    ctx.font = '14px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.fillText('ร้านค้าสมาชิกโครงการ', w / 2, 185);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px "Prompt", "Sarabun", -apple-system, sans-serif';
    const displayShopName = shop.length > 32 ? shop.substring(0, 31) + '...' : shop;
    ctx.fillText(displayShopName, w / 2, 218);

    // 4. ยอดเงินรวมที่ต้องชำระ (Amount Section)
    ctx.fillStyle = '#64748b';
    ctx.font = '15px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.fillText('จำนวนเงินที่ต้องชำระ', w / 2, 260);

    ctx.fillStyle = '#1a56db';
    ctx.font = 'bold 44px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.fillText(`฿ ${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`, w / 2, 305);

    // แถบสรุปสัดส่วน Co-pay 60/40
    const barW = 600;
    const barX = (w - barW) / 2;
    const barY = 328;
    const barH = 44;

    ctx.fillStyle = '#eff6ff';
    drawRoundedRect(ctx, barX, barY, barW, barH, 14);
    ctx.fill();
    ctx.strokeStyle = '#bfdbfe';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 15px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `ลูกค้าจ่าย 40%: ฿${citizenPay.toFixed(2)}    |    รัฐช่วยจ่าย 60%: ฿${govPay.toFixed(2)}`,
      w / 2,
      barY + barH / 2
    );

    // 5. กล่องกรอบ QR Code ตรงกลาง (QR Container Box)
    const qrBoxW = 380;
    const qrBoxH = 380;
    const qrBoxX = (w - qrBoxW) / 2;
    const qrBoxY = 392;

    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 24);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // สร้างภาพ QR Code คุณภาพสูง
    const qrDataUrl = await QRCode.toDataURL(qr.qrReference, {
      width: 340,
      margin: 1,
      color: {
        dark: '#0a0b0d',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });

    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise<void>((resolve, reject) => {
      qrImg.onload = () => resolve();
      qrImg.onerror = reject;
    });

    const qrImgX = qrBoxX + (qrBoxW - 340) / 2;
    const qrImgY = qrBoxY + (qrBoxH - 340) / 2;
    ctx.drawImage(qrImg, qrImgX, qrImgY, 340, 340);

    // โลโก้ PromptPay / Thai QR ตรงกลางของ QR Code (Center Badge)
    const centerBadgeSize = 52;
    const centerBadgeX = w / 2 - centerBadgeSize / 2;
    const centerBadgeY = qrImgY + 340 / 2 - centerBadgeSize / 2;

    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, centerBadgeX, centerBadgeY, centerBadgeSize, centerBadgeSize, 12);
    ctx.fill();
    ctx.strokeStyle = '#1a56db';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#1a56db';
    ctx.font = 'bold 15px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('THAI', w / 2, centerBadgeY + 18);
    ctx.font = 'bold 12px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.fillText('QR', w / 2, centerBadgeY + 34);

    // 6. เส้นประคั่นส่วนรายละเอียด (Dashed Separator Line)
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(60, 796);
    ctx.lineTo(w - 60, 796);
    ctx.stroke();
    ctx.setLineDash([]); // รีเซ็ตเส้นประ

    // 7. หมายเลข Reference และเวลาสร้าง / เวลาหมดอายุ 3 นาที
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 15px "Courier New", monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Ref: ${qr.qrReference}`, w / 2, 826);

    const createdAtDate = new Date(qr.createdAt);
    const createdTimeStr = createdAtDate.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const createdDateStr = createdAtDate.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const expiresAtDate = new Date(qr.expiresAt);
    const expiryTimeStr = expiresAtDate.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });

    ctx.fillStyle = '#64748b';
    ctx.font = '13px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.fillText(`สร้างเมื่อ: ${createdDateStr} เวลา ${createdTimeStr} น.`, w / 2, 854);

    // ป้ายเตือนอายุ QR 3 นาที
    const pillW = 460;
    const pillH = 34;
    const pillX = (w - pillW) / 2;
    const pillY = 874;

    ctx.fillStyle = '#fef2f2';
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 17);
    ctx.fill();
    ctx.strokeStyle = '#fecaca';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 13px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.fillText(`⏳ QR Code มีอายุ 3 นาที (หมดอายุเวลา ${expiryTimeStr} น.)`, w / 2, pillY + pillH / 2);

    // 8. ส่วนท้ายการ์ด (Footer Banner)
    const footerW = 600;
    const footerX = (w - footerW) / 2;
    const footerY = 932;
    const footerH = 68;

    ctx.fillStyle = '#f8fafc';
    drawRoundedRect(ctx, footerX, footerY, footerW, footerH, 18);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 13px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.fillText('กรุณาสแกนจ่ายผ่านแอปไทยช่วยไทยพลีส เพื่อรับสิทธิรัฐช่วยจ่าย 60%', w / 2, footerY + 26);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px "Prompt", "Sarabun", -apple-system, sans-serif';
    ctx.fillText('ระบบความปลอดภัยระดับสถาบันการเงิน • ตรวจสอบพิกัด Geofence อัตโนมัติ', w / 2, footerY + 48);

    return canvas.toDataURL('image/png');
  };

  const handleDownloadQr = async () => {
    if (!qrResult) return;
    setIsDownloading(true);
    try {
      const activeShopName = qrResult.shopName || currentShopName;
      const cardDataUrl = await generatePromptPayFramedImage(
        qrResult,
        activeShopName,
        qrResult.totalAmount
      );
      const a = document.createElement('a');
      a.href = cardDataUrl;
      const cleanShop = activeShopName.replace(/[^\u0E00-\u0E7Fa-zA-Z0-9]/g, '_');
      a.download = `PromptPay-QR-${cleanShop}-${qrResult.totalAmount}THB.png`;
      a.click();
    } catch (err) {
      console.error('Error generating PromptPay QR card:', err);
      // Fallback กรณีมีข้อผิดพลาด ให้เซฟจาก canvas เดิม
      if (canvasRef.current) {
        const url = canvasRef.current.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `QR-${qrResult.qrReference || 'payment'}.png`;
        a.click();
      }
    } finally {
      setIsDownloading(false);
    }
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
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* Page Title & Action Bar */}
      <div className="bg-white border-b border-hairline px-4 md:px-8 py-3.5 mb-4 shadow-2xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => {
                if (qrResult) {
                  setQrResult(null);
                } else {
                  navigate(APP_ROUTES.HOME);
                }
              }}
              className="flex items-center space-x-1.5 rounded-pill px-3 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{qrResult ? 'กลับหน้าตั้งยอด' : 'หน้าหลัก'}</span>
            </button>
            <div className="border-l border-hairline pl-3">
              <h1 className="text-base md:text-lg font-bold text-ink">ระบบสร้าง QR รับเงินร้านค้า (POS)</h1>
              <p className="text-xs text-brand-blue font-medium">โครงการไทยช่วยไทยพลีส (Co-pay 60/40)</p>
            </div>
          </div>
          <button
            onClick={() => navigate(APP_ROUTES.MERCHANT_SALES)}
            className="hidden sm:inline-flex items-center space-x-1.5 rounded-pill px-3 py-1.5 text-xs font-medium text-brand-blue bg-blue-50 hover:bg-blue-100 transition border border-blue-200"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>ดูประวัติยอดขาย</span>
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-md md:max-w-5xl px-4 md:px-6 space-y-4">
        {/* VIEW 1: หน้าฟอร์มตั้งยอดเงิน (Responsive 2-Column บน Desktop, Stacked บน Mobile) */}
        {!qrResult ? (
          <div className="animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Left Column: ข้อมูลร้านค้าและปุ่มลัดเลือกยอดเงินด่วน (md:col-span-6 space-y-4) */}
              <div className="md:col-span-6 space-y-4">
                {/* ข้อมูลร้านค้าดึงจากระบบอัตโนมัติ (ไม่ต้องพิมพ์ตั้งชื่อเอง) */}
                <div className="rounded-card border border-hairline bg-white p-5 shadow-sm">
                  <div className="flex items-start space-x-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue flex-shrink-0 shadow-xs">
                      <Store className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-ink-muted font-medium">ร้านค้าที่เข้าสู่ระบบ (ดึงจากระบบ)</div>
                      <div className="text-base font-bold text-ink flex items-center space-x-1.5 mt-0.5 truncate">
                        <span className="truncate">{currentShopName}</span>
                        <span className="rounded-full bg-emerald-100 p-0.5 text-status-success flex-shrink-0" title="ร้านค้าลงทะเบียนถูกต้อง">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <div className="text-xs text-ink-muted font-mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center">
                          <MapPin className="h-3.5 w-3.5 text-brand-blue mr-1 flex-shrink-0" />
                          {merchantCoords.lat.toFixed(4)}, {merchantCoords.lon.toFixed(4)}
                        </span>
                        <span>• {merchantData?.merchant?.taxId || 'TAX-0105567890'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ปุ่มลัดเลือกยอดเงินด่วนยอดนิยม */}
                <div className="rounded-card border border-hairline bg-white p-5 shadow-sm">
                  <span className="text-xs font-semibold text-ink mb-3 block">
                    ⚡ เลือกยอดเงินด่วนยอดนิยม:
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 gap-2.5">
                    {[40, 60, 100, 120, 150, 200, 250, 300, 500].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(preset)}
                        className={`rounded-pill border py-2.5 text-xs font-mono font-medium transition active:scale-95 ${
                          amount === preset
                            ? 'border-brand-blue bg-blue-50 text-brand-blue font-bold shadow-sm ring-1 ring-brand-blue'
                            : 'border-hairline text-ink hover:bg-gray-50'
                        }`}
                      >
                        ฿{preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ปุ่มทางลัดไปหน้าดูประวัติยอดขาย */}
                <button
                  onClick={() => navigate(APP_ROUTES.MERCHANT_SALES)}
                  className="w-full flex items-center justify-center space-x-2 rounded-card border border-hairline bg-white py-3.5 px-4 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-gray-50 transition shadow-sm"
                >
                  <TrendingUp className="h-4 w-4 text-brand-blue" />
                  <span>ดูสรุปยอดขายและเงินอุดหนุนรัฐบาล 60%</span>
                </button>
              </div>

              {/* Right Column: ช่องระบุยอดเงิน, สรุปส่วนแบ่ง Co-pay 60/40 และปุ่มสร้าง QR (md:col-span-6 space-y-4) */}
              <div className="md:col-span-6 space-y-4">
                <div className="rounded-card border border-hairline bg-white p-5 md:p-6 shadow-sm space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-ink mb-2">
                      ระบุยอดเงินค่าสินค้า / บริการที่ต้องการเรียกเก็บ (บาท)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-2xl font-bold text-ink-muted">
                        ฿
                      </span>
                      <input
                        id="input-pos-amount"
                        type="number"
                        min="1"
                        max="100000"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="w-full rounded-card border border-hairline pl-11 pr-4 py-3.5 font-mono text-3xl font-extrabold text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                        placeholder="0"
                      />
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
                        <Sparkles className="h-3.5 w-3.5" />
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
                    className="w-full flex items-center justify-center space-x-2 rounded-card bg-brand-blue py-4 text-white text-base font-semibold shadow-lg shadow-blue-500/20 transition hover:bg-brand-blue-hover active:scale-98 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        <span>กำลังสร้าง QR รับเงิน...</span>
                      </>
                    ) : (
                      <>
                        <QrCode className="h-5 w-5" />
                        <span>สร้าง Dynamic QR รับเงิน (฿{amount.toLocaleString()})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: หน้าจอแสดงผล QR Code ให้ลูกค้าสแกนทันที (เด้งหน้าใหม่ เต็มตา ไม่ต้องเลื่อนจอ บนคอมกึ่งกลาง) */
          <div className="max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="rounded-card border border-hairline bg-white p-6 md:p-8 shadow-lg text-center">
              {/* Badge สถานะพร้อมสแกน & Countdown Timer 3 นาที */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
                {!isExpired ? (
                  <span className="inline-flex items-center space-x-1.5 rounded-pill bg-emerald-50 px-3 py-1 text-xs font-semibold text-status-success border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Dynamic QR พร้อมให้ลูกค้าสแกน</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 rounded-pill bg-red-50 px-3 py-1 text-xs font-semibold text-status-error border border-red-200 animate-pulse">
                    <AlertTriangle className="h-4 w-4" />
                    <span>QR หมดอายุ กรุณาทำรายการใหม่</span>
                  </span>
                )}

                <span
                  className={`inline-flex items-center space-x-1 rounded-pill px-2.5 py-1 text-xs font-mono font-bold border ${
                    isExpired
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : secondsRemaining < 60
                      ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                      : 'bg-blue-50 text-brand-blue border-blue-200'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>{isExpired ? 'หมดอายุแล้ว (00:00)' : `อายุ QR: ${formattedTimer} น.`}</span>
                </span>
              </div>

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
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-xs space-y-1 mb-3">
                <div className="flex justify-between text-ink-muted">
                  <span>ลูกค้าสแกนจ่าย 40%:</span>
                  <span className="font-mono font-bold text-ink">฿{(qrResult.estimatedCitizenPay).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-brand-blue">
                  <span>รัฐช่วยสมทบ 60%:</span>
                  <span className="font-mono font-bold">฿{(qrResult.estimatedGovCopay).toFixed(2)}</span>
                </div>
              </div>

              {/* Canvas QR Code ขนาด 280x280 ชัดเจนตรงกลางจอ พร้อม Overlay เมื่อหมดอายุ 3 นาที */}
              <div className="relative mx-auto my-3 flex items-center justify-center rounded-3xl border-2 border-hairline bg-white p-3 shadow-sm max-w-[305px] overflow-hidden">
                <canvas ref={canvasRef} className={`mx-auto block transition ${isExpired ? 'opacity-20 filter blur-[1.5px]' : ''}`} />
                {isExpired && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/92 p-4 text-center animate-in fade-in">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-status-error mb-2">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-bold text-status-error">QR หมดอายุแล้ว (3 นาที)</p>
                    <p className="text-xs text-ink-muted mt-1 mb-3">กรุณากดสร้างบิลใหม่เพื่อให้ลูกค้าสแกน</p>
                    <button
                      onClick={() => {
                        setQrResult(null);
                        setAmount(100);
                      }}
                      className="rounded-pill bg-brand-blue px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-hover active:scale-95"
                    >
                      สร้างบิลใหม่ทันที
                    </button>
                  </div>
                )}
              </div>

              {/* Reference number and copy button */}
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-ink-muted bg-surface-soft px-3.5 py-2.5 rounded-pill border border-hairline">
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
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  id="btn-download-qr"
                  disabled={isDownloading}
                  onClick={handleDownloadQr}
                  className="flex items-center justify-center space-x-1.5 rounded-pill border border-blue-200 bg-blue-50/70 py-3 text-xs font-semibold text-brand-blue shadow-sm hover:bg-blue-100 transition active:scale-95 disabled:opacity-50"
                  title="บันทึกรูปป้าย QR พร้อมเพย์เต็มรูปแบบ"
                >
                  {isDownloading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-brand-blue" />
                      <span>กำลังสร้างรูปป้าย...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 text-brand-blue" />
                      <span>บันทึกรูป QR พร้อมเพย์</span>
                    </>
                  )}
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
