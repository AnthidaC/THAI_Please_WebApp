import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  ShieldCheck,
  Download,
  Star,
  ArrowLeft,
  AlertTriangle,
  Store,
  Gift,
  Sparkles,
  ArrowDown,
  UserCheck,
  BellRing,
  Lock,
  Check,
  Zap,
  Building2,
  FileCheck2,
} from 'lucide-react';
import { getTransactionSlip, SlipData } from '../../../services/paymentApi';
import { APP_ROUTES } from '../../../constants/routes';

const AUTOSAVE_PERMISSION_KEY = 'thai_please_slip_autosave_permission';
const SAVED_SLIPS_SESSION_KEY = 'thai_please_saved_slips_session';

type AutoSavePermission = 'granted' | 'denied' | 'prompt';

function getSavedSlipsMap(): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(SAVED_SLIPS_SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function markSlipAsSaved(slipId: string) {
  try {
    const current = getSavedSlipsMap();
    current[slipId] = true;
    sessionStorage.setItem(SAVED_SLIPS_SESSION_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
}

/**
 * วาดสลิปโอนเงินรูปแบบธนาคาร (Bank-Style e-Slip) ความละเอียดสูงลงบน HTML5 Canvas ล่วงหน้า
 * เพื่อให้การกดบันทึกหรือ Auto-Save ทำงานได้ทันที (< 10ms) โดยไม่ต้องรอเรนเดอร์ใหม่
 */
async function renderBankSlipCanvasPng(
  slip: SlipData,
  verifyQrDataUrl: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  const width = 840;
  const hasDiscount = Boolean(slip.discountAmount && slip.discountAmount > 0);
  const height = hasDiscount ? 1240 : 1150;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // 1. พื้นหลังสลิปสีขาวนวลพร้อมลวดลายความปลอดภัยจางๆ (Bank Watermark Pattern)
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, width, height);

  // แถบหัวสลิปสีน้ำเงินกรมท่า-เขียวมรกตตามมาตรฐานธนาคาร/รัฐ
  const isFlagged = slip.status === 'FLAGGED';
  const headerGrad = ctx.createLinearGradient(0, 0, width, 210);
  if (isFlagged) {
    headerGrad.addColorStop(0, '#B45309');
    headerGrad.addColorStop(1, '#D97706');
  } else {
    headerGrad.addColorStop(0, '#0F2942');
    headerGrad.addColorStop(0.6, '#1E3A8A');
    headerGrad.addColorStop(1, '#047857');
  }
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, width, 205);

  // ลายน้ำจางๆ บนพื้นสลิป
  ctx.save();
  ctx.fillStyle = 'rgba(30, 58, 138, 0.025)';
  ctx.font = 'bold 28px "Prompt", "Noto Sans Thai", sans-serif';
  for (let y = 260; y < height - 60; y += 140) {
    for (let x = 40; x < width; x += 380) {
      ctx.fillText('THAI PLEASE e-SLIP', x, y);
    }
  }
  ctx.restore();

  // กรอบการ์ดด้านใน
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 225, width - 48, height - 250);

  // 2. ข้อมูลส่วนหัวสลิป (แบงก์/โครงการ + สถานะ + วันเวลา)
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 20px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THAI Please • กระทรวงการคลัง (G-Wallet)', 40, 48);

  ctx.textAlign = 'right';
  ctx.font = '500 18px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText('Co-pay 60/40 Official e-Slip', width - 40, 48);

  // วงกลมเครื่องหมายถูก
  ctx.beginPath();
  ctx.arc(72, 125, 34, 0, Math.PI * 2);
  ctx.fillStyle = isFlagged ? '#FEF3C7' : '#D1FAE5';
  ctx.fill();

  ctx.fillStyle = isFlagged ? '#D97706' : '#059669';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isFlagged ? '!' : '✓', 72, 138);

  // ชื่อสถานะรายการ และ วัน-เวลาที่โอน
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 34px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText(
    isFlagged ? 'ชำระเงินร่วมสำเร็จ (รอตรวจสอบ)' : 'โอนเงิน / ชำระเงินร่วมสำเร็จ',
    124,
    118
  );

  const formattedDate = new Date(slip.timestamp).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '400 22px "Prompt", "Noto Sans Thai", monospace';
  ctx.fillText(`${formattedDate} น.`, 124, 154);

  // 3. ส่วนผู้โอน (จาก) -> ผู้รับเงิน (ไปยังร้านค้า) เหมือนสลิปโอนเงินธนาคาร
  let curY = 265;

  // กล่องผู้โอน (FROM)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(44, curY, width - 88, 120);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(44, curY, width - 88, 120);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 18px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText('จาก (ผู้โอน / ประชาชน)', 68, curY + 34);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 26px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText(slip.customerName || 'ประชาชนผู้ได้รับสิทธิ', 68, curY + 70);

  const maskedWallet = `G-WALLET •••-•-•${(slip.transactionId || '8492').slice(-4)}`;
  ctx.fillStyle = '#2563EB';
  ctx.font = '500 20px "Prompt", "Noto Sans Thai", monospace';
  ctx.fillText(`กระเป๋าเงินดิจิทัลประชาชน (${maskedWallet})`, 68, curY + 102);

  // ลูกศรเชื่อมโยง (Arrow Down)
  curY += 135;
  ctx.fillStyle = '#2563EB';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('↓', width / 2, curY + 12);
  ctx.textAlign = 'left';

  curY += 28;

  // กล่องผู้รับเงิน (TO MERCHANT)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(44, curY, width - 88, 130);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(44, curY, width - 88, 130);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 18px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText('ไปยัง (ร้านค้าถุงเงิน Co-pay 60/40)', 68, curY + 34);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 26px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText(slip.shopName, 68, curY + 70);

  ctx.fillStyle = '#475569';
  ctx.font = '500 19px "Prompt", "Noto Sans Thai", monospace';
  ctx.fillText(
    `เลขประจำตัวผู้เสียภาษีร้านค้า (Tax ID): ${slip.merchantTaxId || '0105564000123'}`,
    68,
    curY + 105
  );

  // เส้นคั่นประ (Dashed Divider)
  curY += 160;
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(44, curY);
  ctx.lineTo(width - 44, curY);
  ctx.stroke();
  ctx.restore();

  // 4. รายละเอียดจำนวนเงินและสัดส่วน Co-pay 60/40
  curY += 45;
  const drawRow = (
    label: string,
    value: string,
    color = '#334155',
    isBold = false,
    fontSize = 22
  ) => {
    ctx.fillStyle = '#64748B';
    ctx.font = `${isBold ? '600' : '400'} ${fontSize}px "Prompt", "Noto Sans Thai", sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(label, 52, curY);

    ctx.fillStyle = color;
    ctx.font = `${isBold ? 'bold' : '600'} ${fontSize}px "Prompt", "Noto Sans Thai", monospace`;
    ctx.textAlign = 'right';
    ctx.fillText(value, width - 52, curY);
    curY += 44;
  };

  const originalTotal = slip.originalTotalAmount ?? slip.totalAmount;
  drawRow('ยอดรวมค่าสินค้า/บริการ (100%)', `฿${originalTotal.toFixed(2)}`, '#0F172A');

  if (hasDiscount) {
    drawRow(
      `ส่วนลดคูปอง (${slip.discountCode || 'DISCOUNT'})`,
      `- ฿${(slip.discountAmount || 0).toFixed(2)}`,
      '#059669',
      true
    );
    drawRow(
      'ยอดสุทธิหลังหักคูปอง',
      `฿${(slip.netTotalAmount ?? slip.totalAmount).toFixed(2)}`,
      '#334155'
    );
  }

  drawRow(
    'รัฐบาลช่วยจ่ายสมทบ 60% (G-Wallet)',
    `- ฿${slip.governmentCopayAmount.toFixed(2)}`,
    '#1D4ED8',
    true
  );

  drawRow('ค่าธรรมเนียมการโอน (Fee)', '฿0.00 (ฟรี)', '#059669');

  // กล่องยอดหักกระเป๋าประชาชนจริง (40%)
  curY += 6;
  ctx.fillStyle = '#EFF6FF';
  ctx.fillRect(44, curY - 28, width - 88, 86);
  ctx.strokeStyle = '#BFDBFE';
  ctx.strokeRect(44, curY - 28, width - 88, 86);

  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 25px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('จำนวนเงินที่หักจากกระเป๋า (40%)', 64, curY + 24);

  ctx.fillStyle = '#DC2626';
  ctx.font = 'bold 38px "Prompt", "Noto Sans Thai", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`฿${slip.citizenPaidAmount.toFixed(2)}`, width - 64, curY + 28);

  curY += 86;

  // แถบประหยัดเงินรวม
  const totalSavings =
    slip.totalSavingsAmount ?? slip.governmentCopayAmount + (slip.discountAmount || 0);
  ctx.fillStyle = '#ECFDF5';
  ctx.fillRect(44, curY, width - 88, 52);
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 20px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `ประหยัดเงินรวมทั้งสิ้น ฿${totalSavings.toFixed(2)} จากโครงการไทยช่วยไทยพลีส`,
    width / 2,
    curY + 33
  );

  curY += 76;

  // 5. ส่วนท้ายสลิป: เลขที่รายการอ้างอิง + Mini QR ตรวจสอบสลิปธนาคาร
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.moveTo(44, curY);
  ctx.lineTo(width - 44, curY);
  ctx.stroke();
  ctx.restore();

  curY += 36;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = '600 18px "Prompt", "Noto Sans Thai", monospace';
  ctx.fillText(`เลขที่รายการ (Ref. No.): ${slip.slipId}`, 52, curY + 16);

  ctx.fillStyle = '#64748B';
  ctx.font = '400 17px "Prompt", "Noto Sans Thai", monospace';
  ctx.fillText(`อ้างอิง QR ร้านค้า: ${slip.qrReference}`, 52, curY + 48);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 18px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText('✓ ยืนยันสลิปอิเล็กทรอนิกส์ (e-Slip Verified)', 52, curY + 84);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '400 15px "Prompt", "Noto Sans Thai", sans-serif';
  ctx.fillText('สแกน QR Code ด้านขวาเพื่อตรวจสอบความถูกต้องของสลิป', 52, curY + 114);

  // วาด Mini QR Code ด้านขวาล่าง
  if (verifyQrDataUrl) {
    await new Promise<void>((resolve) => {
      const qrImg = new Image();
      qrImg.onload = () => {
        const qrSize = 136;
        const qrX = width - 52 - qrSize;
        const qrY = curY - 10;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
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

  // โมดอลขอสิทธิ์บันทึกสลิปอัตโนมัติ (แสดงเมื่อไม่มีสิทธิ์บันทึกอัตโนมัติ)
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // ข้อมูลรูปภาพสลิปที่เรนเดอร์ล่วงหน้าไว้ในหน่วยความจำ (ช่วยให้กดปุ๊บเซฟปั๊บทันที < 10ms)
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

      markSlipAsSaved(slipId);
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

  // 2. ระบบ Auto-Save สลิปหลังชำระเงิน:
  //    - หากมีสิทธิ์ ('granted') -> บันทึกสลิปลงเครื่องอัตโนมัติทันทีที่เรนเดอร์เสร็จ
  //    - หากยังไม่มีสิทธิ์ ('prompt' หรือ 'denied' ตอนเพิ่งจ่ายเงิน) -> แสดงหน้าต่างขอสิทธิ์บันทึกสลิปอัตโนมัติ
  useEffect(() => {
    if (!slip || !cachedSlipDataUrl || autoSaveTriggeredRef.current) return;

    const alreadySavedMap = getSavedSlipsMap();
    const alreadySavedThisSlip = Boolean(alreadySavedMap[slip.slipId]);

    if (alreadySavedThisSlip && !isAutoSaveFlow) {
      return;
    }

    autoSaveTriggeredRef.current = true;

    if (autoSavePermission === 'granted') {
      // มีสิทธิ์แล้ว -> บันทึกสลิปอัตโนมัติทันที!
      triggerInstantDownload(cachedSlipDataUrl, slip.slipId, 'auto_saved');
    } else if (autoSavePermission === 'prompt' || isAutoSaveFlow) {
      // ยังไม่มีสิทธิ์บันทึกสลิปอัตโนมัติ -> ขอสิทธิ์จากผู้ใช้ทันที
      setShowPermissionModal(true);
    }
  }, [slip, cachedSlipDataUrl, autoSavePermission, isAutoSaveFlow, triggerInstantDownload]);

  // ผู้ใช้กด "อนุญาตและบันทึกสลิปอัตโนมัติ"
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
    }
  };

  // ผู้ใช้กด "อนุญาตเฉพาะครั้งนี้"
  const handleSaveOnceOnly = () => {
    setShowPermissionModal(false);
    if (slip && cachedSlipDataUrl) {
      triggerInstantDownload(cachedSlipDataUrl, slip.slipId, 'manual_saved');
    }
  };

  // ผู้ใช้กด "ไว้ภายหลัง / ปฏิเสธ Auto-Save"
  const handleDenyAutoSave = () => {
    try {
      localStorage.setItem(AUTOSAVE_PERMISSION_KEY, 'denied');
    } catch {
      // ignore
    }
    setAutoSavePermission('denied');
    setShowPermissionModal(false);
  };

  // สลับเปิด-ปิดสิทธิ์ Auto-Save จากแถบตั้งค่าบนหน้าสลิป
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

  // กดปุ่มบันทึกสลิปด้วยตนเอง (ทำงานทันทีเพราะใช้รูปที่ Pre-render ไว้แล้ว)
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
      <div className="flex min-h-screen items-center justify-center bg-surface-soft font-sans">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-blue border-t-transparent mx-auto" />
          <p className="mt-3 text-xs text-ink-muted">กำลังออกสลิปโอนเงินอิเล็กทรอนิกส์ (e-Slip)...</p>
        </div>
      </div>
    );
  }

  if (isError || !slip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-soft p-4 font-sans">
        <div className="w-full max-w-sm rounded-card border border-hairline bg-white p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-status-warning mx-auto mb-3" />
          <h2 className="text-base font-bold text-ink">ไม่พบข้อมูลสลิปรายการนี้</h2>
          <p className="text-xs text-ink-muted mt-1">รหัสธุรกรรมอาจไม่ถูกต้องหรือถูกยกเลิก</p>
          <button
            onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
            className="mt-5 w-full rounded-pill bg-brand-blue py-2.5 text-xs font-semibold text-white transition hover:bg-brand-blue-hover"
          >
            กลับสู่กระเป๋าเงิน
          </button>
        </div>
      </div>
    );
  }

  const isFlagged = slip.status === 'FLAGGED';
  const maskedWalletId = `G-WALLET •••-•-•${(slip.transactionId || '8492').slice(-4)}`;
  const formattedTimestamp = new Date(slip.timestamp).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* โมดอลขอสิทธิ์บันทึกสลิปอัตโนมัติ (Permission Request Modal) */}
      {showPermissionModal && (
        <div
          id="modal-slip-permission"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn"
        >
          <div className="w-full max-w-md rounded-2xl border border-hairline bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200 text-brand-blue">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center space-x-1 rounded-pill bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  <Lock className="h-2.5 w-2.5" />
                  <span>ขอสิทธิ์การเข้าถึงเพื่อบันทึกไฟล์</span>
                </span>
                <h2 className="text-sm sm:text-base font-bold text-ink mt-1">
                  อนุญาตให้บันทึกสลิปลงเครื่องอัตโนมัติหรือไม่?
                </h2>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  เพื่อให้เหมือนแอปพลิเคชันธนาคาร ระบบสามารถบันทึกภาพสลิปโอนเงินความละเอียดสูง (PNG)
                  ลงในคลังภาพ/อุปกรณ์ของท่านโดยอัตโนมัติทันทีทุกครั้งที่ชำระเงินสำเร็จ
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-surface-soft border border-hairline p-3 text-[11px] text-ink-muted space-y-1">
              <div className="flex items-center space-x-1.5 font-semibold text-ink">
                <Zap className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>สลิปถูกเตรียมไว้พร้อมแล้ว (บันทึกไวในเสี้ยววินาที)</span>
              </div>
              <p className="pl-5">
                ไฟล์: <span className="font-mono text-ink">THAI-Please-Slip-{slip.slipId}.png</span>
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                id="btn-grant-autosave"
                onClick={handleGrantPermissionAndSave}
                className="w-full flex items-center justify-center space-x-2 rounded-pill bg-brand-blue py-3 px-4 text-xs font-bold text-white shadow-md transition hover:bg-brand-blue-hover active:scale-98"
              >
                <Check className="h-4 w-4" />
                <span>อนุญาตและบันทึกสลิปอัตโนมัติทันที (แนะนำ)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  id="btn-save-once"
                  onClick={handleSaveOnceOnly}
                  className="w-full rounded-pill border border-hairline bg-white py-2.5 px-3 text-xs font-semibold text-ink transition hover:bg-gray-50"
                >
                  อนุญาตเฉพาะครั้งนี้
                </button>
                <button
                  id="btn-deny-autosave"
                  onClick={handleDenyAutoSave}
                  className="w-full rounded-pill border border-hairline bg-surface-soft py-2.5 px-3 text-xs font-medium text-ink-muted transition hover:bg-gray-200 hover:text-ink"
                >
                  ไม่อนุญาต (บันทึกเอง)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Title & Action Bar */}
      <div className="bg-white border-b border-hairline px-3.5 sm:px-6 lg:px-8 py-3 sm:py-3.5 mb-3.5 shadow-2xs">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <button
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="flex shrink-0 items-center space-x-1.5 rounded-pill px-2.5 sm:px-3 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline"
              title="กลับกระเป๋าเงิน"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">กลับกระเป๋าเงิน</span>
            </button>
            <div className="border-l border-hairline pl-2.5 sm:pl-3 min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-ink truncate">
                สลิปโอนเงิน / ชำระเงินร่วม (Bank e-Slip)
              </h1>
              <p className="text-[11px] sm:text-xs text-brand-blue font-medium truncate">
                โครงการไทยช่วยไทยพลีส • G-Wallet Co-pay 60/40
              </p>
            </div>
          </div>

          {/* ปุ่มสลับสิทธิ์ Auto-Save มุมขวาบน */}
          <button
            onClick={
              autoSavePermission === 'granted'
                ? handleToggleAutoSavePermission
                : () => setShowPermissionModal(true)
            }
            className={`shrink-0 inline-flex items-center space-x-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold border transition ${
              autoSavePermission === 'granted'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
            }`}
            title="ตั้งค่าสิทธิ์บันทึกสลิปอัตโนมัติ"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                autoSavePermission === 'granted' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span>
              {autoSavePermission === 'granted' ? 'Auto-Save: เปิดอยู่' : 'ขอสิทธิ์ Auto-Save'}
            </span>
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-xl px-3.5 sm:px-6 space-y-3.5">
        {/* แถบแจ้งสถานะการบันทึกสลิปอัตโนมัติ หรือปุ่มขอสิทธิ์ */}
        {downloadStatus === 'auto_saved' ? (
          <div
            id="banner-autosave-success"
            className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 shadow-2xs"
          >
            <div className="flex items-center space-x-2 min-w-0">
              <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-semibold truncate">
                บันทึกสลิปลงเครื่องอัตโนมัติเรียบร้อยแล้ว (THAI-Please-Slip-{slip.slipId}.png)
              </span>
            </div>
            <span className="shrink-0 rounded-pill bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
              Auto-Saved
            </span>
          </div>
        ) : downloadStatus === 'manual_saved' ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900 shadow-2xs">
            <div className="flex items-center space-x-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-semibold truncate">
                บันทึกรูปภาพสลิปลงในอุปกรณ์เรียบร้อยแล้ว
              </span>
            </div>
            {autoSavePermission !== 'granted' && (
              <button
                onClick={handleGrantPermissionAndSave}
                className="shrink-0 rounded-pill bg-emerald-700 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-800 transition"
              >
                เปิด Auto-Save ครั้งถัดไป
              </button>
            )}
          </div>
        ) : autoSavePermission !== 'granted' ? (
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 shadow-2xs">
            <div className="flex items-center space-x-2 min-w-0">
              <BellRing className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="font-medium">
                ยังไม่ได้เปิดสิทธิ์บันทึกสลิปอัตโนมัติ (Auto-Save) หลังจ่ายเงิน
              </span>
            </div>
            <button
              onClick={handleGrantPermissionAndSave}
              className="shrink-0 rounded-pill bg-amber-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-amber-700 transition text-center"
            >
              อนุญาตสิทธิ์และบันทึกทันที
            </button>
          </div>
        ) : null}

        {/* บัตรสลิปโอนจ่ายรูปแบบธนาคาร (Bank Transfer Context e-Slip) */}
        <div
          id="receipt-slip"
          className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
        >
          {/* 1. แถบหัวสลิปสไตล์ธนาคาร (Bank Header Banner) */}
          <div
            className={`px-4 sm:px-6 pt-4 pb-5 text-white ${
              isFlagged
                ? 'bg-gradient-to-r from-amber-700 via-amber-600 to-amber-500'
                : 'bg-gradient-to-r from-slate-900 via-blue-900 to-emerald-800'
            }`}
          >
            <div className="flex items-center justify-between text-[11px] text-white/85 pb-3 border-b border-white/15">
              <span className="flex items-center space-x-1.5 font-semibold tracking-wide">
                <Building2 className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                <span>THAI Please • กระทรวงการคลัง (G-Wallet)</span>
              </span>
              <span className="font-mono text-[10px] sm:text-[11px] bg-white/15 px-2 py-0.5 rounded-pill">
                Co-pay 60/40 e-Slip
              </span>
            </div>

            <div className="mt-3.5 flex items-center space-x-3.5">
              <div
                className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full shadow-inner ${
                  isFlagged
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {isFlagged ? (
                  <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7" />
                ) : (
                  <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                  {isFlagged
                    ? 'ชำระเงินร่วมสำเร็จ (อยู่ระหว่างตรวจสอบ)'
                    : 'โอนเงิน / ชำระเงินร่วมสำเร็จ'}
                </h2>
                <p className="font-mono text-xs text-white/90 mt-0.5">
                  {formattedTimestamp} น.
                </p>
              </div>
            </div>
          </div>

          {/* 2. เนื้อหาสลิป: ผู้โอน (From) -> ผู้รับเงิน (To) เหมือนสลิปธนาคาร */}
          <div className="p-4 sm:p-6 space-y-4 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]">
            {/* กล่องผู้โอน -> ผู้รับโอน */}
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-3.5 sm:p-4 shadow-2xs space-y-2.5">
              {/* จาก (ผู้โอน / ประชาชน) */}
              <div className="flex items-start space-x-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 border border-blue-200 text-brand-blue">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-ink-muted">
                      จาก (ผู้โอน / ประชาชน)
                    </span>
                    <span className="text-[10px] font-semibold text-brand-blue bg-blue-50 px-2 py-0.5 rounded-pill border border-blue-100">
                      G-Wallet
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-ink truncate mt-0.5">
                    {slip.customerName || 'ประชาชนผู้ได้รับสิทธิ'}
                  </p>
                  <p className="font-mono text-[11px] text-ink-muted">
                    กระเป๋าเงินดิจิทัลประชาชน • {maskedWalletId}
                  </p>
                </div>
              </div>

              {/* ลูกศรเชื่อมโยงเหมือนสลิปโอนเงินธนาคาร */}
              <div className="relative flex items-center pl-3.5 py-0.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-brand-blue">
                  <ArrowDown className="h-3.5 w-3.5" />
                </div>
                <div className="ml-3 flex-1 border-t border-dashed border-slate-200" />
              </div>

              {/* ไปยัง (ผู้รับเงิน / ร้านค้าถุงเงิน) */}
              <div className="flex items-start space-x-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-ink-muted">
                      ไปยัง (ร้านค้าถุงเงินโครงการ)
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-pill border border-emerald-100">
                      ร้านค้า Co-pay 60/40
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-ink truncate mt-0.5">
                    {slip.shopName}
                  </p>
                  <p className="font-mono text-[11px] text-ink-muted">
                    เลขผู้เสียภาษีร้านค้า (Tax ID): {slip.merchantTaxId || '0105564000123'}
                  </p>
                </div>
              </div>
            </div>

            {/* 3. รายละเอียดจำนวนเงิน สัดส่วน Co-pay และค่าธรรมเนียม */}
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-3.5 sm:p-4 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">ยอดรวมค่าสินค้า/บริการ (100%)</span>
                <span
                  className={`font-mono ${
                    slip.discountAmount && slip.discountAmount > 0
                      ? 'line-through text-ink-muted text-xs'
                      : 'font-semibold text-ink'
                  }`}
                >
                  ฿{(slip.originalTotalAmount ?? slip.totalAmount).toFixed(2)}
                </span>
              </div>

              {slip.discountAmount && slip.discountAmount > 0 ? (
                <>
                  <div className="flex items-center justify-between text-xs text-emerald-700 font-medium">
                    <span className="flex items-center space-x-1">
                      <Gift className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>ส่วนลดคูปอง ({slip.discountCode || 'DISCOUNT'})</span>
                    </span>
                    <span className="font-mono font-bold">
                      - ฿{slip.discountAmount.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-ink-muted pb-1.5 border-b border-dashed border-slate-200">
                    <span>ยอดสุทธิก่อนคำนวณสิทธิ Co-pay 60/40</span>
                    <span className="font-mono font-semibold text-ink">
                      ฿{(slip.netTotalAmount ?? slip.totalAmount).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : null}

              <div className="flex items-center justify-between text-xs text-brand-blue">
                <span className="flex items-center space-x-1 font-medium">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>รัฐบาลช่วยจ่ายสมทบ 60% (G-Wallet)</span>
                </span>
                <span className="font-mono font-bold">
                  - ฿{slip.governmentCopayAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">ค่าธรรมเนียมการโอน (Fee)</span>
                <span className="font-mono font-semibold text-emerald-700">
                  ฿0.00 (ยกเว้นค่าธรรมเนียม)
                </span>
              </div>

              {/* ยอดหักบัญชีกระเป๋าประชาชนจริง (40%) */}
              <div className="mt-1 rounded-xl bg-blue-50/70 border border-blue-200 px-3.5 py-2.5 flex items-center justify-between">
                <div>
                  <span className="block text-xs sm:text-sm font-bold text-ink">
                    จำนวนเงินที่หักจากกระเป๋า (40%)
                  </span>
                  <span className="text-[10px] text-ink-muted">
                    ชำระผ่านกระเป๋าเงินดิจิทัลประชาชนสำเร็จ
                  </span>
                </div>
                <span className="font-mono text-xl sm:text-2xl font-extrabold text-status-error">
                  ฿{slip.citizenPaidAmount.toFixed(2)}
                </span>
              </div>

              {/* ป้ายประหยัดเงินรวม */}
              <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 px-3 py-2 text-center">
                <span className="text-xs font-bold text-emerald-800">
                  🎉 ประหยัดเงินในรายการนี้รวม: ฿
                  {(
                    slip.totalSavingsAmount ??
                    slip.governmentCopayAmount + (slip.discountAmount || 0)
                  ).toFixed(2)}
                </span>
                {slip.discountAmount && slip.discountAmount > 0 ? (
                  <span className="block text-[10px] text-emerald-700 mt-0.5">
                    (รัฐช่วยจ่าย ฿{slip.governmentCopayAmount.toFixed(2)} + คูปองส่วนลด ฿
                    {slip.discountAmount.toFixed(2)})
                  </span>
                ) : null}
              </div>
            </div>

            {/* 4. ส่วนท้ายสลิป: รหัสอ้างอิงธุรกรรม + Mini QR Code ตรวจสอบสลิปธนาคาร */}
            <div className="rounded-2xl border border-slate-200 bg-white/95 p-3.5 sm:p-4 shadow-2xs flex flex-col xs:flex-row items-start xs:items-center justify-between gap-3.5">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-bold text-emerald-800">
                    e-Slip Verified • ตรวจสอบย้อนกลับได้
                  </span>
                </div>
                <p className="font-mono text-[11px] text-ink font-semibold truncate">
                  เลขที่รายการ (Ref.): {slip.slipId}
                </p>
                <p className="font-mono text-[10px] text-ink-muted truncate">
                  อ้างอิง QR ร้านค้า: {slip.qrReference}
                </p>
                <p className="text-[10px] text-ink-muted pt-0.5">
                  สแกน QR Code เพื่อตรวจสอบความถูกต้องของสลิปโอนเงิน
                </p>
              </div>

              {/* Mini Verification QR Code เหมือนสลิปธนาคารจริง */}
              <div className="flex flex-col items-center shrink-0 self-center xs:self-auto bg-surface-soft p-2 rounded-xl border border-hairline">
                {verifyQrDataUrl ? (
                  <img
                    src={verifyQrDataUrl}
                    alt="QR ตรวจสอบสลิป"
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg bg-white p-1 border border-slate-200"
                  />
                ) : (
                  <div className="h-16 w-16 sm:h-20 sm:w-20 animate-pulse rounded-lg bg-slate-200" />
                )}
                <span className="text-[9px] font-semibold text-ink-muted mt-1">
                  สแกนตรวจสอบสลิป
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ปุ่มบันทึกสลิปภาพลงเครื่อง (ทำงานไวทันที < 10ms จาก Pre-rendered Canvas) */}
        <button
          id="btn-download-slip"
          onClick={handleManualDownloadSlip}
          disabled={isPreRendering}
          className="w-full flex items-center justify-center space-x-2 rounded-pill border border-brand-blue/30 bg-white py-3.5 text-xs font-bold text-brand-blue shadow-sm transition hover:bg-blue-50 active:scale-98 disabled:opacity-60"
        >
          {downloadStatus !== 'idle' ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-status-success" />
              <span className="text-status-success">
                บันทึกภาพสลิปลงเครื่องแล้ว (กดเพื่อบันทึกซ้ำทันที)
              </span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4 text-brand-blue" />
              <span>บันทึกสลิปภาพลงเครื่องทันที (Fast Save PNG)</span>
            </>
          )}
        </button>

        {/* ปุ่มประเมินร้านค้า (24 ชั่วโมง ตาม FR-CIT-06) */}
        <div className="rounded-card border border-amber-200 bg-amber-50/60 p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center space-x-1 text-xs font-bold text-amber-900">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500 shrink-0" />
              <span>สิทธิประเมินรีวิวร้านค้า (ภายใน 24 ชม.)</span>
            </div>
            <p className="text-[11px] text-amber-800">
              คะแนนจากผู้ซื้อจริงจะช่วยเพิ่มโอกาสการมองเห็นให้ร้านค้ารายย่อยในระบบ AI
            </p>
          </div>
          <button
            onClick={() => alert(`เปิดหน้าประเมินร้าน ${slip.shopName} (โมดูล Dev 3 - 24h Review)`)}
            className="w-full sm:w-auto rounded-pill bg-amber-500 px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 transition shrink-0 text-center"
          >
            ให้คะแนนร้าน
          </button>
        </div>

        {/* ปุ่มกลับหน้าหลัก */}
        <button
          onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
          className="w-full rounded-pill bg-brand-blue py-3.5 text-xs font-semibold text-white shadow-md transition hover:bg-brand-blue-hover active:scale-98"
        >
          กลับสู่หน้าหลักกระเป๋าเงิน
        </button>
      </main>
    </div>
  );
};
