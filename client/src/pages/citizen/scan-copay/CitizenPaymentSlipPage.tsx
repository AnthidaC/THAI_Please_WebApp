import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  Download,
  Star,
  ArrowLeft,
  AlertTriangle,
  BellRing,
  Check,
  FileCheck2,
  X,
} from 'lucide-react';
import { getTransactionSlip, SlipData } from '../../../services/paymentApi';
import { APP_ROUTES } from '../../../constants/routes';

const AUTOSAVE_PERMISSION_KEY = 'thai_please_slip_autosave_permission';
const AUTO_SAVED_SLIPS_STORAGE_KEY = 'thai_please_auto_saved_slips';

type AutoSavePermission = 'granted' | 'denied' | 'prompt';

function getAutoSavedSlipsMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(AUTO_SAVED_SLIPS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function markSlipAsAutoSaved(slipId: string) {
  try {
    const current = getAutoSavedSlipsMap();
    current[slipId] = true;
    localStorage.setItem(AUTO_SAVED_SLIPS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
}

/**
 * เรนเดอร์สลิปโอนเงินรูปแบบธนาคาร (Bank-Style e-Slip) มาตรฐาน สะอาด เรียบหรู
 * ไม่ตีกรอบยิบย่อย และใช้ถ้อยคำทางการกระชับตามแบบฉบับสลิปธนาคารพาณิชย์/รัฐ
 */
async function renderBankSlipCanvasPng(
  slip: SlipData,
  verifyQrDataUrl: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  const width = 760;
  const hasDiscount = Boolean(slip.discountAmount && slip.discountAmount > 0);
  const height = hasDiscount ? 1080 : 1010;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 1. พื้นหลังสีขาวสะอาด
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // แถบเส้นสีเอกลักษณ์ด้านบนสุด (Top Brand Accent)
  const isFlagged = slip.status === 'FLAGGED';
  const topBarGrad = ctx.createLinearGradient(0, 0, width, 0);
  if (isFlagged) {
    topBarGrad.addColorStop(0, '#D97706');
    topBarGrad.addColorStop(1, '#F59E0B');
  } else {
    topBarGrad.addColorStop(0, '#1D4ED8');
    topBarGrad.addColorStop(0.5, '#2563EB');
    topBarGrad.addColorStop(1, '#059669');
  }
  ctx.fillStyle = topBarGrad;
  ctx.fillRect(0, 0, width, 8);

  let curY = 54;

  // 2. ส่วนหัวสลิป: โลโก้แอป / ธนาคาร และ สถานะการทำรายการ
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 24px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THAI PLEASE', 50, curY);

  ctx.fillStyle = '#64748B';
  ctx.font = '500 15px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText('กระเป๋าเงินดิจิทัล (G-Wallet)', 50, curY + 24);

  // สถานะและวันเวลาด้านขวา
  const rightX = width - 50;
  ctx.textAlign = 'right';
  ctx.fillStyle = isFlagged ? '#D97706' : '#059669';
  ctx.font = 'bold 22px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText(isFlagged ? 'ชำระเงินสำเร็จ (รอตรวจสอบ)' : '✓ ชำระเงินสำเร็จ', rightX, curY);

  const formattedDate = new Date(slip.timestamp).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  ctx.fillStyle = '#94A3B8';
  ctx.font = '400 15px "Prompt", "Noto Sans Thai", monospace';
  ctx.fillText(`${formattedDate} น.`, rightX, curY + 24);

  // เส้นคั่นบางสะอาด
  curY += 56;
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(50, curY);
  ctx.lineTo(width - 50, curY);
  ctx.stroke();

  // 3. ยอดจำนวนเงินเด่นชัด (Hero Amount)
  curY += 42;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = '500 17px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText('จำนวนเงิน', width / 2, curY);

  curY += 46;
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 44px "Prompt", "Noto Sans Thai", monospace';
  ctx.fillText(`฿${slip.citizenPaidAmount.toFixed(2)}`, width / 2, curY);

  // เส้นคั่น
  curY += 34;
  ctx.strokeStyle = '#F1F5F9';
  ctx.beginPath();
  ctx.moveTo(50, curY);
  ctx.lineTo(width - 50, curY);
  ctx.stroke();

  // 4. เส้นทางโอนเงิน จาก -> ไปยัง (สะอาด เรียบหรู ไม่มีกล่องซ้อนกรอบ)
  curY += 38;
  const maskedWallet = `G-Wallet •••-•-•${(slip.transactionId || '8492').slice(-4)}`;

  // จาก (From)
  ctx.beginPath();
  ctx.arc(68, curY + 12, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#EFF6FF';
  ctx.fill();
  ctx.fillStyle = '#2563EB';
  ctx.font = 'bold 13px "Prompt", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('จาก', 68, curY + 17);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 14px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText('จาก', 102, curY - 2);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 20px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText(slip.customerName || 'ประชาชนผู้ได้รับสิทธิ', 102, curY + 22);

  ctx.fillStyle = '#64748B';
  ctx.font = '400 15px "Prompt", "Noto Sans Thai", monospace';
  ctx.fillText(maskedWallet, 102, curY + 44);

  // เส้นเชื่อมโยงประในแนวตั้ง
  curY += 66;
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(68, curY - 14);
  ctx.lineTo(68, curY + 4);
  ctx.stroke();
  ctx.restore();

  // ไปยัง (To)
  ctx.beginPath();
  ctx.arc(68, curY + 22, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#ECFDF5';
  ctx.fill();
  ctx.fillStyle = '#059669';
  ctx.font = 'bold 13px "Prompt", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ถึง', 68, curY + 27);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 14px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText('ไปยัง', 102, curY + 8);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 20px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText(slip.shopName, 102, curY + 32);

  ctx.fillStyle = '#64748B';
  ctx.font = '400 15px "Prompt", "Noto Sans Thai", monospace';
  ctx.fillText(`รหัสร้านค้า: ${slip.merchantTaxId || '0105564000123'}`, 102, curY + 54);

  // เส้นคั่น
  curY += 80;
  ctx.strokeStyle = '#F1F5F9';
  ctx.beginPath();
  ctx.moveTo(50, curY);
  ctx.lineTo(width - 50, curY);
  ctx.stroke();

  // 5. รายละเอียดการชำระเงินและสิทธิประโยชน์
  curY += 34;
  const drawLine = (label: string, value: string, color = '#0F172A', isBold = false) => {
    ctx.fillStyle = '#64748B';
    ctx.font = '400 16px "Prompt", "Noto Sans Thai", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, 50, curY);

    ctx.fillStyle = color;
    ctx.font = `${isBold ? 'bold' : '500'} 17px "Prompt", "Noto Sans Thai", monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(value, width - 50, curY);
    curY += 32;
  };

  const originalTotal = slip.originalTotalAmount ?? slip.totalAmount;
  drawLine('ยอดรวมสินค้า/บริการ', `฿${originalTotal.toFixed(2)}`);

  if (hasDiscount) {
    drawLine(
      `ส่วนลดคูปอง (${slip.discountCode || 'DISCOUNT'})`,
      `-฿${(slip.discountAmount || 0).toFixed(2)}`,
      '#059669',
      true
    );
  }

  drawLine('สิทธิรัฐช่วยจ่าย (60%)', `-฿${slip.governmentCopayAmount.toFixed(2)}`, '#2563EB', true);
  drawLine('ค่าธรรมเนียม', '0.00 บาท', '#64748B');

  const totalSavings =
    slip.totalSavingsAmount ?? slip.governmentCopayAmount + (slip.discountAmount || 0);
  if (totalSavings > 0) {
    curY += 4;
    ctx.fillStyle = '#059669';
    ctx.font = '500 14px "Prompt", "Noto Sans Thai", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`* ประหยัดรวม ฿${totalSavings.toFixed(2)} จากโครงการ Co-pay`, 50, curY);
    curY += 12;
  }

  // เส้นคั่นประด้านล่าง
  curY += 26;
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(50, curY);
  ctx.lineTo(width - 50, curY);
  ctx.stroke();
  ctx.restore();

  // 6. ส่วนท้ายสลิป: เลขที่รายการ และ Mini QR ตรวจสอบ
  curY += 34;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 13px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText('เลขที่รายการ', 50, curY);

  ctx.fillStyle = '#334155';
  ctx.font = '500 15px "Prompt", "Noto Sans Thai", monospace';
  ctx.fillText(slip.slipId, 50, curY + 20);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '500 13px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText('รหัสอ้างอิง', 50, curY + 50);

  ctx.fillStyle = '#334155';
  ctx.font = '500 15px "Prompt", "Noto Sans Thai", monospace';
  ctx.fillText(slip.qrReference || slip.transactionId, 50, curY + 70);

  // QR Code ตรวจสอบสลิปมุมขวาล่าง
  if (verifyQrDataUrl) {
    await new Promise<void>((resolve) => {
      const qrImg = new Image();
      qrImg.onload = () => {
        const qrSize = 96;
        const qrX = width - 50 - qrSize;
        const qrY = curY - 10;
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '400 12px "Prompt", "Noto Sans Thai", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('สแกนตรวจสอบสลิป', qrX + qrSize / 2, qrY + qrSize + 16);
        resolve();
      };
      qrImg.onerror = () => resolve();
      qrImg.src = verifyQrDataUrl;
    });
  }

  return canvas.toDataURL('image/png', 1.0);
}

export const CitizenPaymentSlipPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // ตรวจสอบว่ามาจากการจ่ายเงินสำเร็จที่ต้องการ Auto-Save หรือไม่
  const isAutoSaveFlow =
    searchParams.get('autosave') === '1' ||
    Boolean((location.state as { autoSave?: boolean } | null)?.autoSave);

  // สถานะสิทธิ์การบันทึกสลิปอัตโนมัติ (granted | denied | prompt)
  const [autoSavePermission, setAutoSavePermission] = useState<AutoSavePermission>(() => {
    try {
      const saved = localStorage.getItem(AUTOSAVE_PERMISSION_KEY);
      if (saved === 'granted' || saved === 'denied') return saved;
      return 'prompt';
    } catch {
      return 'prompt';
    }
  });

  // โมดอลขอสิทธิ์บันทึกสลิปอัตโนมัติ
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // สถานะการให้คะแนนรีวิวร้านค้า (In-app modal)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // ข้อมูลรูปภาพสลิปที่เรนเดอร์ล่วงหน้าไว้ในหน่วยความจำ
  const [cachedSlipDataUrl, setCachedSlipDataUrl] = useState<string>('');
  const [verifyQrDataUrl, setVerifyQrDataUrl] = useState<string>('');
  const [isPreRendering, setIsPreRendering] = useState(false);

  // สถานะแจ้งเตือนการบันทึกสลิป
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'auto_saved' | 'manual_saved'>('idle');
  const autoSaveTriggeredRef = useRef(false);

  const { data: slip, isLoading, isError } = useQuery({
    queryKey: ['transaction-slip', id],
    queryFn: () => getTransactionSlip(id || ''),
    enabled: !!id,
  });

  // ฟังก์ชันสั่งดาวน์โหลดไฟล์ PNG ที่เรนเดอร์เตรียมไว้แล้วลงเครื่องทันที (Instant Download)
  const triggerInstantDownload = useCallback(
    (dataUrl: string, slipId: string, mode: 'auto_saved' | 'manual_saved') => {
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `THAI-Please-Slip-${slipId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadStatus(mode);
    },
    []
  );

  // 1. ทันทีที่ได้ข้อมูลสลิป ให้สร้าง Mini QR สำหรับตรวจสอบสลิป และเรนเดอร์ PNG เตรียมไว้ล่วงหน้าทันที
  useEffect(() => {
    let active = true;
    if (!slip) return;

    const prepareSlipAssets = async () => {
      setIsPreRendering(true);
      try {
        const verifyPayload = JSON.stringify({
          type: 'THAI_PLEASE_ESLIP_VERIFY',
          slipId: slip.slipId,
          txId: slip.transactionId,
          merchantTaxId: slip.merchantTaxId,
          paid: slip.citizenPaidAmount,
          govCopay: slip.governmentCopayAmount,
          ts: slip.timestamp,
        });

        const qrUrl = await QRCode.toDataURL(verifyPayload, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#0F172A',
            light: '#FFFFFF',
          },
        });

        if (!active) return;
        setVerifyQrDataUrl(qrUrl);

        const pngDataUrl = await renderBankSlipCanvasPng(slip, qrUrl);
        if (!active) return;
        setCachedSlipDataUrl(pngDataUrl);
      } catch (err) {
        console.error('Failed to pre-render slip image:', err);
      } finally {
        if (active) setIsPreRendering(false);
      }
    };

    prepareSlipAssets();
    return () => {
      active = false;
    };
  }, [slip]);

  // 2. ระบบ Auto-Save สลิป: ทำงาน "เฉพาะ" ตอนเด้งมาหลังชำระเงินสำเร็จครั้งแรกเท่านั้น
  useEffect(() => {
    // กฎเหล็ก: หากไม่ได้เด้งมาจากหน้าจ่ายเงิน (เช่น กดดูจากประวัติธุรกรรม/กระเป๋าเงิน) -> ไม่ต้อง Auto-Save เด็ดขาด
    if (!isAutoSaveFlow) return;

    if (!slip || !cachedSlipDataUrl || autoSaveTriggeredRef.current) return;

    // ตรวจสอบว่าสลิปนี้เคยถูก Auto-Save ไปแล้วหรือไม่ (เช่น ผู้ใช้เคยกดรีเฟรชหน้าสลิป)
    const alreadySaved = getAutoSavedSlipsMap();
    if (alreadySaved[slip.slipId]) {
      // เคยบันทึกไปแล้ว ไม่ต้องเซฟซ้ำ และล้าง search param ?autosave=1 ออก
      if (searchParams.get('autosave') === '1') {
        window.history.replaceState({}, '', `/citizen/slip/${slip.slipId}`);
      }
      return;
    }

    autoSaveTriggeredRef.current = true;

    // เคลียร์ search param ?autosave=1 ออกจาก URL ทันที เพื่อป้องกันการรีเฟรชแล้วเซฟซ้ำ
    if (searchParams.get('autosave') === '1') {
      window.history.replaceState({}, '', `/citizen/slip/${slip.slipId}`);
    }

    if (autoSavePermission === 'granted') {
      // มีสิทธิ์ -> บันทึกอัตโนมัติเฉพาะการชำระเงินครั้งนี้
      triggerInstantDownload(cachedSlipDataUrl, slip.slipId, 'auto_saved');
      markSlipAsAutoSaved(slip.slipId);
    } else if (autoSavePermission === 'prompt') {
      // ยังไม่ได้เลือกสิทธิ์ และเพิ่งจ่ายเงินเสร็จ -> แสดงหน้าต่างถามสิทธิ์
      setShowPermissionModal(true);
    }
  }, [slip, cachedSlipDataUrl, autoSavePermission, isAutoSaveFlow, searchParams, triggerInstantDownload]);

  const handleGrantPermissionAndSave = () => {
    try {
      localStorage.setItem(AUTOSAVE_PERMISSION_KEY, 'granted');
    } catch {
      // ignore storage error
    }
    setAutoSavePermission('granted');
    setShowPermissionModal(false);

    if (slip && cachedSlipDataUrl) {
      triggerInstantDownload(cachedSlipDataUrl, slip.slipId, 'auto_saved');
      markSlipAsAutoSaved(slip.slipId);
    }
  };

  const handleSaveOnceOnly = () => {
    setShowPermissionModal(false);
    if (slip && cachedSlipDataUrl) {
      triggerInstantDownload(cachedSlipDataUrl, slip.slipId, 'manual_saved');
      markSlipAsAutoSaved(slip.slipId);
    }
  };

  const handleDenyAutoSave = () => {
    try {
      localStorage.setItem(AUTOSAVE_PERMISSION_KEY, 'denied');
    } catch {
      // ignore
    }
    setAutoSavePermission('denied');
    setShowPermissionModal(false);
  };

  const handleToggleAutoSavePermission = () => {
    if (autoSavePermission === 'granted') {
      try {
        localStorage.setItem(AUTOSAVE_PERMISSION_KEY, 'denied');
      } catch {
        // ignore
      }
      setAutoSavePermission('denied');
    } else {
      handleGrantPermissionAndSave();
    }
  };

  const handleManualDownloadSlip = async () => {
    if (!slip) return;
    if (cachedSlipDataUrl) {
      triggerInstantDownload(cachedSlipDataUrl, slip.slipId, 'manual_saved');
      return;
    }
    const pngUrl = await renderBankSlipCanvasPng(slip, verifyQrDataUrl);
    setCachedSlipDataUrl(pngUrl);
    triggerInstantDownload(pngUrl, slip.slipId, 'manual_saved');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
          <p className="mt-3 text-xs text-slate-500">กำลังโหลดสลิปรายการ...</p>
        </div>
      </div>
    );
  }

  if (isError || !slip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">ไม่พบข้อมูลสลิปรายการนี้</h2>
          <p className="text-xs text-slate-500 mt-1">รหัสธุรกรรมอาจไม่ถูกต้องหรือถูกยกเลิก</p>
          <button
            onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
            className="mt-5 w-full rounded-full bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            กลับสู่กระเป๋าเงิน
          </button>
        </div>
      </div>
    );
  }

  const isFlagged = slip.status === 'FLAGGED';
  const maskedWalletId = `G-Wallet •••-•-•${(slip.transactionId || '8492').slice(-4)}`;
  const formattedTimestamp = new Date(slip.timestamp).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const originalTotal = slip.originalTotalAmount ?? slip.totalAmount;
  const hasDiscount = Boolean(slip.discountAmount && slip.discountAmount > 0);
  const totalSavings =
    slip.totalSavingsAmount ?? slip.governmentCopayAmount + (slip.discountAmount || 0);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-12 font-sans text-slate-900">
      {/* โมดอลขอสิทธิ์บันทึกสลิปอัตโนมัติ (Permission Request Modal) */}
      {showPermissionModal && (
        <div
          id="modal-slip-permission"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">
                  บันทึกสลิปลงเครื่องอัตโนมัติ?
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  ระบบจะบันทึกภาพสลิปลงในอุปกรณ์ของท่านโดยอัตโนมัติทุกครั้งที่ทำรายการสำเร็จ
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                id="btn-grant-autosave"
                onClick={handleGrantPermissionAndSave}
                className="w-full flex items-center justify-center space-x-1.5 rounded-full bg-blue-600 py-2.5 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Check className="h-4 w-4" />
                <span>อนุญาตและบันทึกสลิป</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  id="btn-save-once"
                  onClick={handleSaveOnceOnly}
                  className="w-full rounded-full border border-slate-200 bg-white py-2 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  เฉพาะครั้งนี้
                </button>
                <button
                  id="btn-deny-autosave"
                  onClick={handleDenyAutoSave}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
                >
                  ไว้คราวหลัง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* โมดอลประเมินร้านค้า (24h Review Modal) */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">ประเมินร้านค้า</h2>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              ให้คะแนนความพึงพอใจการใช้บริการที่ร้าน <span className="font-semibold text-slate-800">{slip.shopName}</span>
            </p>

            <div className="flex justify-center space-x-2 py-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  className="p-1 transition hover:scale-110"
                >
                  <Star
                    className={`h-7 w-7 ${
                      star <= reviewRating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-200 fill-slate-100'
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="pt-1">
              <button
                onClick={() => {
                  setReviewSubmitted(true);
                  setShowReviewModal(false);
                }}
                className="w-full rounded-full bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700"
              >
                ส่งผลการประเมิน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header Bar */}
      <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3 mb-4 shadow-xs">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="flex shrink-0 items-center space-x-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
              title="กลับกระเป๋าเงิน"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">กลับ</span>
            </button>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              สลิปทำรายการ
            </h1>
          </div>

          {/* ปุ่มสถานะ Auto-Save แบบมินิมอล */}
          <button
            onClick={
              autoSavePermission === 'granted'
                ? handleToggleAutoSavePermission
                : () => setShowPermissionModal(true)
            }
            className={`shrink-0 inline-flex items-center space-x-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium border transition ${
              autoSavePermission === 'granted'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="ตั้งค่าสิทธิ์บันทึกสลิปอัตโนมัติ"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                autoSavePermission === 'granted' ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <span>
              {autoSavePermission === 'granted' ? 'บันทึกอัตโนมัติ: เปิด' : 'บันทึกอัตโนมัติ'}
            </span>
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-lg px-4 sm:px-6 space-y-4">
        {/* ข้อความแจ้งเตือนบันทึกรูปภาพเรียบร้อย */}
        {downloadStatus === 'auto_saved' || downloadStatus === 'manual_saved' ? (
          <div
            id="banner-autosave-success"
            className="flex items-center space-x-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs text-emerald-800"
          >
            <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-medium truncate">
              บันทึกภาพสลิปลงในอุปกรณ์เรียบร้อยแล้ว
            </span>
          </div>
        ) : null}

        {/* ============================================================== */}
        {/* บัตรสลิปโอนจ่ายรูปแบบธนาคาร (Bank-Style e-Slip Card)              */}
        {/* ============================================================== */}
        <div
          id="receipt-slip"
          className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md"
        >
          {/* เส้นขอบสีด้านบนของสลิป (Top Accent Line) */}
          <div
            className={`h-2 w-full ${
              isFlagged
                ? 'bg-amber-500'
                : 'bg-gradient-to-r from-blue-700 via-indigo-600 to-emerald-500'
            }`}
          />

          <div className="p-5 sm:p-6 space-y-5">
            {/* 1. ส่วนหัวสลิป: ธนาคาร / โครงการ และ สถานะ */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-sm font-bold tracking-wide text-slate-900 block">
                  THAI PLEASE
                </span>
                <span className="text-xs text-slate-500 block">
                  กระเป๋าเงินดิจิทัล (G-Wallet)
                </span>
              </div>
              <div className="text-right">
                <span
                  className={`inline-flex items-center space-x-1 text-xs sm:text-sm font-bold ${
                    isFlagged ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{isFlagged ? 'ชำระเงินสำเร็จ (รอตรวจสอบ)' : 'ชำระเงินสำเร็จ'}</span>
                </span>
                <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                  {formattedTimestamp} น.
                </p>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 2. ยอดเงินชำระหลัก (Hero Amount) */}
            <div className="text-center py-1">
              <span className="text-xs text-slate-400 font-medium">จำนวนเงิน</span>
              <div className="text-3xl sm:text-4xl font-bold font-mono text-slate-900 tracking-tight mt-0.5">
                ฿{slip.citizenPaidAmount.toFixed(2)}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 3. รายละเอียดผู้โอน (จาก) และผู้รับเงิน (ไปยัง) */}
            <div className="space-y-3.5">
              {/* จาก (ผู้โอน) */}
              <div className="flex items-start space-x-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 font-bold text-xs mt-0.5">
                  จาก
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-slate-400 block">จาก</span>
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {slip.customerName || 'ประชาชนผู้ได้รับสิทธิ'}
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    {maskedWalletId}
                  </p>
                </div>
              </div>

              {/* เส้นประเชื่อมต่อ */}
              <div className="ml-4 h-3.5 border-l-2 border-dashed border-slate-200" />

              {/* ไปยัง (ผู้รับเงิน) */}
              <div className="flex items-start space-x-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs mt-0.5">
                  ถึง
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-slate-400 block">ไปยัง</span>
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {slip.shopName}
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    รหัสร้านค้า: {slip.merchantTaxId || '0105564000123'}
                  </p>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* 4. รายละเอียดค่าใช้จ่ายและส่วนลด (ไม่มีกรอบกล่องซ้อนกรอบ) */}
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">ยอดรวมสินค้า/บริการ</span>
                <span className="font-mono text-slate-800 font-medium">
                  ฿{originalTotal.toFixed(2)}
                </span>
              </div>

              {hasDiscount && (
                <div className="flex items-center justify-between text-emerald-600">
                  <span>ส่วนลดคูปอง ({slip.discountCode || 'DISCOUNT'})</span>
                  <span className="font-mono font-medium">
                    -฿{(slip.discountAmount || 0).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-blue-600">
                <span>สิทธิรัฐช่วยจ่าย (60%)</span>
                <span className="font-mono font-medium">
                  -฿{slip.governmentCopayAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">ค่าธรรมเนียม</span>
                <span className="font-mono text-slate-600">0.00 บาท</span>
              </div>

              {totalSavings > 0 && (
                <p className="text-[11px] text-emerald-700 font-medium pt-1">
                  ประหยัดรวม ฿{totalSavings.toFixed(2)} จากโครงการ Co-pay
                </p>
              )}
            </div>

            {/* เส้นประคั่นส่วนล่าง */}
            <div className="border-t border-dashed border-slate-200" />

            {/* 5. ส่วนท้ายสลิป: รหัสอ้างอิง และ Mini QR ตรวจสอบสลิป */}
            <div className="flex items-end justify-between gap-3 pt-1">
              <div className="space-y-1.5 min-w-0">
                <div>
                  <span className="text-[11px] text-slate-400 block">เลขที่รายการ</span>
                  <span className="font-mono text-xs text-slate-700 font-medium truncate block">
                    {slip.slipId}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">รหัสอ้างอิง</span>
                  <span className="font-mono text-xs text-slate-700 font-medium truncate block">
                    {slip.qrReference || slip.transactionId}
                  </span>
                </div>
              </div>

              {/* QR Code ตรวจสอบสลิป */}
              <div className="flex flex-col items-center shrink-0">
                {verifyQrDataUrl ? (
                  <img
                    src={verifyQrDataUrl}
                    alt="QR ตรวจสอบสลิป"
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-md border border-slate-200 p-0.5 bg-white"
                  />
                ) : (
                  <div className="h-16 w-16 sm:h-20 sm:w-20 animate-pulse rounded-md bg-slate-100" />
                )}
                <span className="text-[9px] text-slate-400 mt-1">
                  สแกนตรวจสอบสลิป
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ปุ่มบันทึกภาพสลิป */}
        <button
          id="btn-download-slip"
          onClick={handleManualDownloadSlip}
          disabled={isPreRendering}
          className="w-full flex items-center justify-center space-x-2 rounded-full border border-blue-600 bg-white py-3 text-xs font-semibold text-blue-600 shadow-xs transition hover:bg-blue-50 active:scale-98 disabled:opacity-60"
        >
          {downloadStatus !== 'idle' ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-emerald-700">บันทึกสลิปซ้ำ</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>บันทึกภาพสลิป</span>
            </>
          )}
        </button>

        {/* แถบประเมินร้านค้า (สะอาด เรียบง่าย ไม่รกสายตา) */}
        {!reviewSubmitted ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2 min-w-0">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
              <span className="text-xs text-slate-700 truncate font-medium">
                ให้คะแนนความพึงพอใจร้าน {slip.shopName}
              </span>
            </div>
            <button
              onClick={() => setShowReviewModal(true)}
              className="shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition"
            >
              ประเมินร้าน
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5 text-xs text-emerald-800 flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>ขอบคุณสำหรับการประเมินร้านค้า</span>
          </div>
        )}

        {/* ปุ่มกลับหน้าหลักกระเป๋าเงิน */}
        <button
          onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
          className="w-full rounded-full bg-blue-600 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-98"
        >
          กลับสู่หน้าหลักกระเป๋าเงิน
        </button>
      </main>
    </div>
  );
};
