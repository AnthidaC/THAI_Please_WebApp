import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  QrCode,
  Sparkles,
  RefreshCw,
  Download,
  CheckCircle2,
  TrendingUp,
  ArrowLeft,
  Copy,
  Check,
  Clock,
  AlertTriangle,
  Volume2,
  VolumeX,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';
import {
  generateDynamicQr,
  getMerchantHistory,
  getQrPaymentStatus,
  streamQrPaymentStatus,
  DynamicQrResponse,
  QrPaymentStatusResponse,
} from '../../../services/paymentApi';
import { APP_ROUTES } from '../../../constants/routes';

const MERCHANT_SOUND_PREF_KEY = 'thai_please_merchant_pos_sound_enabled';

/**
 * สร้างเสียงแจ้งเตือนเงินเข้ามาตรฐานเครื่อง POS ธนาคาร (Web Audio Chime + เสียงแจ้งยอดภาษาไทย)
 */
function playMerchantPaymentAlertSound(totalAmount: number) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // โน้ต 3 จังหวะสไตล์เครื่อง POS ธนาคาร (C6 -> E6 -> G6)
      const notes = [
        { freq: 1046.5, start: 0, duration: 0.14 },
        { freq: 1318.5, start: 0.13, duration: 0.14 },
        { freq: 1567.98, start: 0.26, duration: 0.42 },
      ];

      notes.forEach(({ freq, start, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.28, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + duration);
      });
    }
  } catch (e) {
    console.warn('Audio chime failed:', e);
  }

  // เสียงพูดแจ้งยอดเงินเข้าภาษาไทย (ถ้าระบบเบราว์เซอร์รองรับ)
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        `ได้รับเงินชำระ ${totalAmount.toFixed(0)} บาท เรียบร้อยแล้วค่ะ`
      );
      utterance.lang = 'th-TH';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  } catch {
    // ignore speech synthesis error
  }
}

export const MerchantPosQrPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number>(100);
  const [merchantCoords, setMerchantCoords] = useState<{ lat: number; lon: number }>({
    lat: 13.7563,
    lon: 100.5018,
  });
  const [qrResult, setQrResult] = useState<DynamicQrResponse | null>(null);
  const [paidInfo, setPaidInfo] = useState<NonNullable<QrPaymentStatusResponse['paidTransaction']> | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const notifiedQrRef = useRef<string | null>(null);

  // สถานะเปิด/ปิดเสียงแจ้งเตือนเมื่อมีเงินเข้า (ร้านค้าเลือกเปิด/ปิดได้ และจำค่าไว้ในเครื่อง)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(MERCHANT_SOUND_PREF_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MERCHANT_SOUND_PREF_KEY, String(next));
      } catch {
        // ignore storage error
      }
      if (next) {
        // เล่นเสียงติ๊งสั้นๆ เพื่อยืนยันการเปิดเสียงและปลดล็อก AudioContext ของเบราว์เซอร์
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.setValueAtTime(1318.5, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
          }
        } catch {
          // ignore
        }
      } else if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  }, []);

  // คำนวณเวลานับถอยหลังของ QR Code (อายุ 3 นาที)
  useEffect(() => {
    if (!qrResult || paidInfo) return;

    const updateTimer = () => {
      const expiryTime = new Date(qrResult.expiresAt).getTime();
      const diffSec = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setSecondsRemaining(diffSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [qrResult, paidInfo]);

  const isExpired = secondsRemaining <= 0 && !paidInfo;
  const timerMinutes = Math.floor(secondsRemaining / 60);
  const timerSeconds = secondsRemaining % 60;
  const formattedTimer = `${String(timerMinutes).padStart(2, '0')}:${String(timerSeconds).padStart(2, '0')}`;

  // ตรวจสอบสถานะการจ่ายเงินของ QR Code แบบ Real-time ทันทีผ่าน Server-Sent Events (SSE) พร้อม Polling Fallback
  useEffect(() => {
    if (!qrResult || paidInfo || isExpired) return;

    let active = true;

    const handleSuccessfulPayment = (paidTx: any) => {
      if (!active) return;
      setPaidInfo(paidTx);
      queryClient.invalidateQueries({ queryKey: ['merchant-sales'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-profile'] });

      if (notifiedQrRef.current !== qrResult.qrReference) {
        notifiedQrRef.current = qrResult.qrReference;
        if (soundEnabled) {
          playMerchantPaymentAlertSound(paidTx.totalAmount);
        }
      }
    };

    // 1. เชื่อมต่อ Server-Sent Events (SSE) เพื่อรับแจ้งเตือนแบบ Real-Time ทันที (0 ms Latency)
    const streamController = new AbortController();
    const eventSource = { close: () => streamController.abort() };
    streamQrPaymentStatus(qrResult.qrReference, (res) => {
          if (res.status === 'USED' && res.paidTransaction) {
            handleSuccessfulPayment(res.paidTransaction);
            eventSource.close();
          } else if (res.status === 'EXPIRED') {
            setSecondsRemaining(0);
            eventSource.close();
          }
    }, streamController.signal).catch(() => { /* Polling remains available if streaming disconnects. */ });

    // 2. สำรองด้วย Polling เผื่อเครือข่ายไม่อนุญาต SSE (ความถี่ต่ำทุก 3 วินาทีเพื่อประหยัดทรัพยากร)
    const checkPaymentStatusFallback = async () => {
      try {
        const res = await getQrPaymentStatus(qrResult.qrReference);
        if (!active) return;

        if (res.status === 'USED' && res.paidTransaction) {
          handleSuccessfulPayment(res.paidTransaction);
          eventSource?.close();
        } else if (res.status === 'EXPIRED') {
          setSecondsRemaining(0);
          eventSource?.close();
        }
      } catch {
        // ignore network error
      }
    };

    const pollInterval = setInterval(checkPaymentStatusFallback, 3000);

    return () => {
      active = false;
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [qrResult, paidInfo, isExpired, soundEnabled, queryClient]);

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
    if (qrResult && !paidInfo && canvasRef.current) {
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
  }, [qrResult, paidInfo]);

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
      setPaidInfo(null);
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
    ctx.fillText(`⏳ QR Code หมดอายุเวลา ${expiryTimeStr} น.`, w / 2, pillY + pillH / 2);

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
    ctx.fillText('โครงการไทยช่วยไทยพลีส (THAI Please) • กระทรวงการคลัง', w / 2, footerY + 48);

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

  const govPreviewAmount = Math.min((amount || 0) * 0.6, 200);
  const citizenPreviewAmount = Math.max(0, (amount || 0) - govPreviewAmount);
  const govPercent = amount > 0 ? Math.round((govPreviewAmount / amount) * 100) : 60;

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* Page Title & Action Bar (พร้อมปุ่มเลือกเปิด/ปิดเสียงแจ้งเตือนเมื่อมีเงินเข้า) */}
      <div className="bg-white border-b border-hairline px-3.5 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 mb-3 sm:mb-4 shadow-2xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center space-x-2 sm:space-x-2.5 min-w-0">
            <button
              onClick={() => {
                if (qrResult) {
                  setQrResult(null);
                  setPaidInfo(null);
                } else {
                  navigate(APP_ROUTES.HOME);
                }
              }}
              className="flex items-center space-x-1.5 rounded-pill px-2.5 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline shrink-0"
              title={qrResult ? 'กลับหน้าตั้งยอด' : 'หน้าหลัก'}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{qrResult ? 'กลับหน้าตั้งยอด' : 'หน้าหลัก'}</span>
            </button>
            <div className="border-l border-hairline pl-2.5 sm:pl-3 min-w-0">
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-ink truncate flex items-center gap-1.5">
                <span className="truncate">{currentShopName}</span>
                <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" aria-label="ร้านค้าลงทะเบียนถูกต้อง" />
              </h1>
              <p className="hidden sm:block text-xs text-brand-blue font-medium truncate">
                สร้าง QR รับชำระเงิน Co-pay 60/40
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* ปุ่มเลือกเปิด-ปิดเสียงแจ้งเตือนเมื่อมีเงินชำระเข้ามา */}
            <button
              id="btn-toggle-merchant-sound"
              type="button"
              onClick={handleToggleSound}
              className={`inline-flex items-center space-x-1.5 rounded-pill px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition border ${
                soundEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-surface-soft text-ink-muted border-hairline hover:bg-gray-200 hover:text-ink'
              }`}
              title={
                soundEnabled
                  ? 'เปิดเสียงแจ้งเตือนเงินเข้าอยู่ (คลิกเพื่อปิดเสียง)'
                  : 'ปิดเสียงแจ้งเตือนเงินเข้าอยู่ (คลิกเพื่อเปิดเสียง)'
              }
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="hidden xs:inline">เสียงแจ้งเตือน: เปิด</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                  <span className="hidden xs:inline">เสียงแจ้งเตือน: ปิด</span>
                </>
              )}
            </button>

            <button
              onClick={() => navigate(APP_ROUTES.MERCHANT_SALES)}
              className="inline-flex items-center space-x-1.5 rounded-pill px-2.5 sm:px-3 py-1.5 text-xs font-medium text-brand-blue bg-blue-50 hover:bg-blue-100 transition border border-blue-200 shrink-0"
            >
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">ประวัติยอดขาย</span>
            </button>
          </div>
        </div>
      </div>

      {/* กล่องเด้งและหน้าจอมาตรฐานแจ้งเตือนเมื่อธุรกรรมเสร็จสมบูรณ์ (Standard POS Payment Completed Modal) */}
      {paidInfo && qrResult && (
        <div
          id="modal-merchant-payment-success"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            {/* แถบหัวมาตรฐานธนาคารสีเขียวมรกต */}
            <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-6 py-6 text-center text-white">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white text-emerald-600 shadow-lg">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <span className="inline-flex items-center space-x-1 rounded-pill bg-white/20 px-3 py-0.5 text-[11px] font-semibold text-white">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>ธุรกรรมเสร็จสมบูรณ์</span>
              </span>
              <h2 className="mt-2 text-lg sm:text-xl font-bold">ได้รับเงินชำระเรียบร้อยแล้ว</h2>
              <p className="mt-0.5 font-mono text-xs text-emerald-100">
                {new Date(paidInfo.completedAt).toLocaleString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}{' '}
                น.
              </p>
            </div>

            {/* รายละเอียดจำนวนเงินที่ร้านค้าได้รับ */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center">
                <span className="text-xs font-semibold text-emerald-900 block">
                  ยอดเงินรวมที่เข้าบัญชีร้านค้า (100%)
                </span>
                <div className="mt-1 font-mono text-3xl sm:text-4xl font-extrabold text-emerald-700">
                  + ฿{paidInfo.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* ตารางแจกแจงสัดส่วน Co-pay 60/40 และข้อมูลผู้จ่าย */}
              <div className="rounded-2xl border border-hairline bg-surface-soft p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted flex items-center space-x-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-brand-blue shrink-0" />
                    <span>ผู้ชำระเงิน</span>
                  </span>
                  <span className="font-bold text-ink">{paidInfo.customerName}</span>
                </div>

                <div className="border-t border-hairline pt-2 flex items-center justify-between">
                  <span className="text-ink-muted">รับจากกระเป๋าลูกค้า (40%)</span>
                  <span className="font-mono font-bold text-ink">
                    ฿{paidInfo.citizenPaidAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-brand-blue">
                  <span className="flex items-center space-x-1 font-medium">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span>รัฐบาลสมทบให้ร้านค้า (60%)</span>
                  </span>
                  <span className="font-mono font-bold">
                    ฿{paidInfo.governmentCopayAmount.toFixed(2)}
                  </span>
                </div>

                <div className="border-t border-hairline pt-2 flex items-center justify-between text-[11px] text-ink-muted">
                  <span>รหัสอ้างอิง</span>
                  <span className="font-mono">{qrResult.qrReference}</span>
                </div>
              </div>

              {/* แถบสถานะเสียงแจ้งเตือน */}
              <div className="flex items-center justify-between px-1 text-[11px] text-ink-muted">
                <span>
                  สถานะเสียงแจ้งเตือนร้านค้า:{' '}
                  <strong className={soundEnabled ? 'text-emerald-700' : 'text-ink-muted'}>
                    {soundEnabled ? 'เปิดเสียงอยู่' : 'ปิดเสียงอยู่'}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className="text-brand-blue font-semibold hover:underline"
                >
                  {soundEnabled ? 'ปิดเสียง' : 'เปิดเสียง'}
                </button>
              </div>

              {/* ปุ่มดำเนินการต่อ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => navigate(APP_ROUTES.MERCHANT_SALES)}
                  className="rounded-pill border border-hairline bg-white py-3 px-4 text-xs font-semibold text-ink hover:bg-gray-50 transition"
                >
                  ดูประวัติยอดขาย
                </button>
                <button
                  id="btn-ack-payment-next-bill"
                  type="button"
                  onClick={() => {
                    setPaidInfo(null);
                    setQrResult(null);
                    setAmount(100);
                  }}
                  className="rounded-pill bg-brand-blue py-3 px-4 text-xs font-bold text-white shadow-md hover:bg-brand-blue-hover transition active:scale-95"
                >
                  ตกลง • รับรายการถัดไป
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-3.5 sm:px-6 lg:px-8 space-y-4">
        {/* VIEW 1: หน้าตั้งยอดเงิน — ปรับขนาดอัตโนมัติทั้งมือถือ แท็บเล็ต และเดสก์ท็อป */}
        {!qrResult ? (
          <div className="animate-in fade-in duration-200">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
              <div className="lg:col-span-7 rounded-card border border-hairline bg-white p-4 sm:p-6 shadow-sm space-y-4">
                {/* ช่องระบุยอดเงิน */}
                <div>
                  <label htmlFor="input-pos-amount" className="block text-xs sm:text-sm font-semibold text-ink mb-1.5">
                    ยอดเงินที่ต้องการเรียกเก็บ (บาท)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-2xl sm:text-3xl font-bold text-ink-muted">
                      ฿
                    </span>
                    <input
                      id="input-pos-amount"
                      type="number"
                      inputMode="decimal"
                      min="1"
                      max="100000"
                      value={amount || ''}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full rounded-card border border-hairline pl-11 pr-4 py-3 sm:py-3.5 font-mono text-2xl sm:text-3xl md:text-4xl font-extrabold text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* ปุ่มลัดเลือกยอดเงินด่วน (8 ปุ่ม แบ่ง 4 คอลัมน์สมมาตรทุกหน้าจอ) */}
                <div>
                  <span className="block text-[11px] font-medium text-ink-muted mb-2">
                    เลือกยอดเงินด่วน:
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[40, 60, 100, 120, 150, 200, 250, 300].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(preset)}
                        className={`rounded-pill border py-2 sm:py-2.5 text-xs sm:text-sm font-mono font-medium transition active:scale-95 ${
                          amount === preset
                            ? 'border-brand-blue bg-blue-50 text-brand-blue font-bold ring-1 ring-brand-blue'
                            : 'border-hairline text-ink hover:bg-gray-50'
                        }`}
                      >
                        ฿{preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* สรุปส่วนแบ่ง Co-pay แบบกระชับ (แสดงทุกขนาดจอ) */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-100 bg-blue-50/50 px-3.5 py-2.5 text-xs">
                  <span className="text-ink-muted">
                    ลูกค้าจ่าย (40%):{' '}
                    <b className="font-mono text-ink">฿{citizenPreviewAmount.toFixed(2)}</b>
                  </span>
                  <span className="text-brand-blue flex items-center gap-1 font-medium">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      รัฐช่วย (60%): <b className="font-mono">฿{govPreviewAmount.toFixed(2)}</b>
                    </span>
                  </span>
                </div>

                {/* ปุ่มสร้าง QR รับเงิน (กดแล้วเด้งไปหน้า QR ทันที) */}
                <button
                  id="btn-generate-qr"
                  disabled={isGenerating || amount <= 0}
                  onClick={handleGenerate}
                  className="w-full flex items-center justify-center space-x-2 rounded-card bg-brand-blue py-3.5 sm:py-4 text-white text-sm sm:text-base font-semibold shadow-lg shadow-blue-500/20 transition hover:bg-brand-blue-hover active:scale-98 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin shrink-0" />
                      <span>กำลังสร้าง QR...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="h-5 w-5 shrink-0" />
                      <span>สร้าง QR รับเงิน ฿{(amount || 0).toLocaleString()}</span>
                    </>
                  )}
                </button>
              </div>

              {/* ข้อมูลสรุปสัดส่วนการรับเงิน (จอใหญ่แสดงด้านขวา / มือถือแสดงการ์ดสรุปด้านล่าง) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-sm text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-ink">สรุปสัดส่วนรายรับร้านค้า</h3>
                    <span className="rounded-pill bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-status-success border border-emerald-200">
                      โอนเข้าบัญชีร้าน 100%
                    </span>
                  </div>

                  {/* แถบแสดงสัดส่วน Co-pay */}
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden flex">
                      <div
                        className="h-full bg-brand-blue transition-all duration-300"
                        style={{ width: `${govPercent}%` }}
                        title={`รัฐสมทบ ${govPercent}%`}
                      />
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${100 - govPercent}%` }}
                        title={`ลูกค้าจ่าย ${100 - govPercent}%`}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-ink-muted">
                      <span className="text-brand-blue font-medium">● รัฐสมทบ ({govPercent}%)</span>
                      <span className="text-emerald-700 font-medium">● ลูกค้าจ่าย ({100 - govPercent}%)</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-hairline">
                    <div className="flex justify-between items-center">
                      <span className="text-ink-muted">ลูกค้าสแกนจ่าย</span>
                      <span className="font-mono font-bold text-ink">฿{citizenPreviewAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-brand-blue">
                      <span>รัฐบาลสมทบ (สูงสุด ฿200/วัน)</span>
                      <span className="font-mono font-bold">฿{govPreviewAmount.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-hairline pt-2.5 flex justify-between items-center font-semibold">
                      <span className="text-ink">ยอดขายรวมที่ร้านได้รับ</span>
                      <span className="font-mono text-status-success text-base sm:text-lg font-bold">
                        ฿{(amount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => navigate(APP_ROUTES.MERCHANT_SALES)}
                  className="w-full flex items-center justify-center space-x-2 rounded-card border border-hairline bg-white py-3 px-4 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-gray-50 transition shadow-sm"
                >
                  <TrendingUp className="h-4 w-4 text-brand-blue shrink-0" />
                  <span>ดูสรุปยอดขายและประวัติการรับเงินทั้งหมด</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: หน้าจอแสดงผล QR Code ให้ลูกค้าสแกนทันที (ปรับตัวตามขนาดจอตั้งแต่ 320px ถึงจอใหญ่) */
          <div className="max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="rounded-card border border-hairline bg-white p-4 sm:p-6 md:p-8 shadow-lg text-center">
              {/* Badge สถานะพร้อมสแกน & Countdown Timer 3 นาที */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-2">
                {!isExpired ? (
                  <span className="inline-flex items-center space-x-1.5 rounded-pill bg-emerald-50 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-status-success border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-status-success animate-ping" />
                    <span>รอรับชำระเงิน</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 rounded-pill bg-red-50 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-status-error border border-red-200 animate-pulse">
                    <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    <span>QR หมดอายุ กรุณาทำรายการใหม่</span>
                  </span>
                )}

                <span
                  className={`inline-flex items-center space-x-1 rounded-pill px-2.5 py-1 text-[11px] sm:text-xs font-mono font-bold border ${
                    isExpired
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : secondsRemaining < 60
                      ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                      : 'bg-blue-50 text-brand-blue border-blue-200'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>{isExpired ? 'หมดอายุแล้ว' : `เวลาคงเหลือ ${formattedTimer}`}</span>
                </span>
              </div>

              {/* ชื่อร้านค้า (ดึงจากระบบ) */}
              <h2 className="text-sm sm:text-base font-bold text-ink mt-1 truncate">{qrResult.shopName}</h2>

              {/* ยอดเงินใหญ่ ชัดเจน */}
              <div className="my-1.5">
                <div className="font-mono text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-blue">
                  ฿ {qrResult.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-ink-muted">
                  <span>
                    ลูกค้าจ่าย <b className="font-mono text-ink">฿{qrResult.estimatedCitizenPay.toFixed(2)}</b>
                  </span>
                  <span>•</span>
                  <span className="text-brand-blue">
                    รัฐช่วย <b className="font-mono">฿{qrResult.estimatedGovCopay.toFixed(2)}</b>
                  </span>
                </div>
              </div>

              {/* Canvas QR Code ย่อ-ขยายตามหน้าจออัตโนมัติ พร้อม Overlay เมื่อหมดอายุ 3 นาที */}
              <div className="relative mx-auto my-3 flex items-center justify-center rounded-3xl border-2 border-hairline bg-white p-2.5 sm:p-3 shadow-sm w-full max-w-[290px] sm:max-w-[305px] overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className={`mx-auto block max-w-full h-auto transition ${
                    isExpired ? 'opacity-20 filter blur-[1.5px]' : ''
                  }`}
                />
                {isExpired && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/92 p-4 text-center animate-in fade-in">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-status-error mb-2">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-bold text-status-error">QR Code หมดอายุแล้ว</p>
                    <p className="text-xs text-ink-muted mt-1 mb-3">กรุณาสร้าง QR ใหม่เพื่อรับชำระเงิน</p>
                    <button
                      onClick={() => {
                        setPaidInfo(null);
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
              <div className="mt-3 flex items-center justify-between gap-2 text-xs font-mono text-ink-muted bg-surface-soft px-3.5 py-2.5 rounded-pill border border-hairline">
                <span className="truncate min-w-0">Ref: {qrResult.qrReference}</span>
                <button
                  onClick={handleCopyRef}
                  className="flex items-center space-x-1 text-brand-blue font-sans font-semibold hover:underline shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-status-success" />
                      <span className="text-status-success">คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>คัดลอก</span>
                    </>
                  )}
                </button>
              </div>

              {/* ปุ่มสร้างบิลใหม่ และบันทึกรูป (เรียง 1 คอลัมน์บนจอเล็ก และ 2 คอลัมน์บนจอปกติ) */}
              <div className="mt-4 sm:mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <button
                  id="btn-download-qr"
                  disabled={isDownloading}
                  onClick={handleDownloadQr}
                  className="flex items-center justify-center space-x-1.5 rounded-pill border border-blue-200 bg-blue-50/70 py-3 px-4 text-xs font-semibold text-brand-blue shadow-sm hover:bg-blue-100 transition active:scale-95 disabled:opacity-50"
                  title="บันทึกรูปป้าย QR พร้อมเพย์เต็มรูปแบบ"
                >
                  {isDownloading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-brand-blue shrink-0" />
                      <span>กำลังสร้างรูปป้าย...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 text-brand-blue shrink-0" />
                      <span>บันทึกรูปภาพ QR</span>
                    </>
                  )}
                </button>

                <button
                  id="btn-create-new-bill"
                  onClick={() => {
                    setPaidInfo(null);
                    setQrResult(null);
                    setAmount(100);
                  }}
                  className="flex items-center justify-center space-x-1.5 rounded-pill bg-brand-blue py-3 px-4 text-xs font-semibold text-white shadow-md hover:bg-brand-blue-hover transition active:scale-95"
                >
                  <RefreshCw className="h-4 w-4 shrink-0" />
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
