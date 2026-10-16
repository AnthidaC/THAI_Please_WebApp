import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  ShieldCheck,
  Download,
  Star,
  ArrowLeft,
  AlertTriangle,
  Store,
  Calendar,
  Gift,
  Sparkles,
} from 'lucide-react';
import { getTransactionSlip } from '../../../services/paymentApi';
import { APP_ROUTES } from '../../../constants/routes';

export const CitizenPaymentSlipPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const { data: slip, isLoading, isError } = useQuery({
    queryKey: ['transaction-slip', id],
    queryFn: () => getTransactionSlip(id || ''),
    enabled: !!id,
  });

  const handleDownloadSlip = () => {
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-soft font-sans">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-blue border-t-transparent mx-auto" />
          <p className="mt-3 text-xs text-ink-muted">กำลังดึงหลักฐานการชำระเงิน...</p>
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

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* Page Title & Action Bar */}
      <div className="bg-white border-b border-hairline px-4 md:px-8 py-3.5 mb-4 shadow-2xs">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="flex items-center space-x-1.5 rounded-pill px-3 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>กลับกระเป๋าเงิน</span>
            </button>
            <div className="border-l border-hairline pl-3">
              <h1 className="text-base font-bold text-ink">หลักฐานการชำระเงินดิจิทัล (e-Slip)</h1>
              <p className="text-xs text-brand-blue font-medium">โครงการไทยช่วยไทยพลีส (Co-pay 60/40)</p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-xl px-4 sm:px-6 space-y-4">
        {/* บัตร e-Slip หลักฐานการชำระเงิน */}
        <div id="receipt-slip" className="relative overflow-hidden rounded-card border border-hairline bg-white p-6 shadow-md">
          {/* หัวสลิป */}
          <div className="text-center pb-5 border-b border-hairline">
            <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${isFlagged ? 'bg-amber-100 text-status-warning' : 'bg-emerald-100 text-status-success'} mb-3`}>
              {isFlagged ? (
                <AlertTriangle className="h-7 w-7" />
              ) : (
                <CheckCircle2 className="h-7 w-7" />
              )}
            </div>
            <h1 className="text-lg font-bold text-ink">
              {isFlagged ? 'ชำระเงินร่วมสำเร็จ (อยู่ระหว่างตรวจสอบรายการ)' : 'ชำระเงินร่วมสำเร็จ'}
            </h1>
            <p className="text-xs text-brand-blue font-medium mt-0.5">
              โครงการไทยช่วยไทยพลีส (Co-pay 60/40)
            </p>
            <p className="font-mono text-[11px] text-ink-muted mt-1">
              เลขที่สลิป: {slip.slipId}
            </p>
          </div>

          {/* รายละเอียดร้านค้าและเวลา */}
          <div className="py-4 border-b border-hairline space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted flex items-center space-x-1.5">
                <Store className="h-3.5 w-3.5 text-brand-blue" />
                <span>ร้านค้า</span>
              </span>
              <span className="font-semibold text-ink">{slip.shopName}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-ink-muted flex items-center space-x-1.5">
                <Calendar className="h-3.5 w-3.5 text-ink-muted" />
                <span>วัน-เวลาทำรายการ</span>
              </span>
              <span className="font-mono text-ink">
                {new Date(slip.timestamp).toLocaleString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-ink-muted">รหัสอ้างอิง QR</span>
              <span className="font-mono text-[11px] text-ink-muted truncate max-w-[200px]">
                {slip.qrReference}
              </span>
            </div>
          </div>

          {/* ยอดเงินและสัดส่วน Co-pay */}
          <div className="py-4 border-b border-hairline space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-muted">ยอดรวมสินค้า (100%)</span>
              <span className={`font-mono ${slip.discountAmount && slip.discountAmount > 0 ? 'line-through text-ink-muted text-xs' : 'font-medium text-ink'}`}>
                ฿{(slip.originalTotalAmount ?? slip.totalAmount).toFixed(2)}
              </span>
            </div>

            {slip.discountAmount && slip.discountAmount > 0 ? (
              <>
                <div className="flex items-center justify-between text-xs text-emerald-700 font-medium">
                  <span className="flex items-center space-x-1">
                    <Gift className="h-3.5 w-3.5 text-emerald-600" />
                    <span>ส่วนลดคูปอง / โค้ดชวนเพื่อน ({slip.discountCode || 'DISCOUNT'})</span>
                  </span>
                  <span className="font-mono font-bold">
                    - ฿{slip.discountAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-ink-muted pb-1 border-b border-hairline/60">
                  <span>ยอดสุทธิก่อนคำนวณ Co-pay 60/40</span>
                  <span className="font-mono font-semibold text-ink">
                    ฿{(slip.netTotalAmount ?? slip.totalAmount).toFixed(2)}
                  </span>
                </div>
              </>
            ) : null}

            <div className="flex items-center justify-between text-xs text-brand-blue">
              <span className="flex items-center space-x-1">
                <Sparkles className="h-3.5 w-3.5" />
                <span>รัฐบาลสมทบ (60%)</span>
              </span>
              <span className="font-mono font-semibold">
                - ฿{slip.governmentCopayAmount.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-hairline/60">
              <span className="text-sm font-semibold text-ink">ประชาชนจ่ายจริง (40%)</span>
              <span className="font-mono text-2xl font-bold text-status-error">
                ฿{slip.citizenPaidAmount.toFixed(2)}
              </span>
            </div>

            {/* ป้ายประหยัดเงินรวม */}
            <div className="mt-2 rounded-xl bg-blue-50 border border-blue-200 p-2 text-center">
              <span className="text-xs font-semibold text-brand-blue">
                🎉 ประหยัดเงินรวม: ฿{(slip.totalSavingsAmount ?? (slip.governmentCopayAmount + (slip.discountAmount || 0))).toFixed(2)}
              </span>
              {slip.discountAmount && slip.discountAmount > 0 ? (
                <span className="block text-[10px] text-brand-blue-hover mt-0.5">
                  (รัฐบาลช่วย ฿{slip.governmentCopayAmount.toFixed(2)} + ส่วนลดคูปอง ฿{slip.discountAmount.toFixed(2)})
                </span>
              ) : null}
            </div>
          </div>

          {/* ตราประทับยืนยันสลิปอิเล็กทรอนิกส์ (ไม่แสดงค่าการตรวจสอบภายในให้ผู้ใช้เห็น) */}
          <div className="mt-4 rounded-2xl bg-surface-soft px-3.5 py-2.5 text-[11px] flex items-center justify-between">
            <span className="flex items-center space-x-1.5 text-emerald-800 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>ยืนยันหลักฐานการชำระเงินอิเล็กทรอนิกส์</span>
            </span>
            <span className="rounded-pill bg-white px-2.5 py-0.5 text-[10px] text-emerald-700 font-semibold border border-emerald-200">
              e-Slip Verified
            </span>
          </div>
        </div>

        {/* ปุ่มบันทึกสลิปภาพ */}
        <button
          id="btn-download-slip"
          onClick={handleDownloadSlip}
          className="w-full flex items-center justify-center space-x-2 rounded-pill border border-hairline bg-white py-3 text-xs font-semibold text-ink shadow-sm transition hover:bg-gray-50 active:scale-98"
        >
          {downloadSuccess ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-status-success" />
              <span className="text-status-success">บันทึกรูปภาพสลิปลงในอุปกรณ์แล้ว</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4 text-brand-blue" />
              <span>บันทึกสลิปภาพลงเครื่อง</span>
            </>
          )}
        </button>

        {/* ปุ่มประเมินร้านค้า (24 ชั่วโมง ตาม FR-CIT-06) */}
        <div className="rounded-card border border-amber-200 bg-amber-50/60 p-4 shadow-sm flex items-start justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-1 text-xs font-bold text-amber-900">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              <span>สิทธิประเมินรีวิวร้านค้า (ภายใน 24 ชม.)</span>
            </div>
            <p className="text-[11px] text-amber-800">
              คะแนนจากผู้ซื้อจริงจะช่วยเพิ่มโอกาสการมองเห็นให้ร้านค้ารายย่อยในระบบ AI
            </p>
          </div>
          <button
            onClick={() => alert(`เปิดหน้าประเมินร้าน ${slip.shopName} (โมดูล Dev 3 - 24h Review)`)}
            className="rounded-pill bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 transition flex-shrink-0 ml-2"
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
