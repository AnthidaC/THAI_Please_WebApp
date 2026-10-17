import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  History,
  Star,
  ChevronRight,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { getBuyerHistory } from '../../../services/paymentApi';
import { APP_ROUTES } from '../../../constants/routes';

export const CitizenTransactionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<'ALL' | 'SUCCESS' | 'FLAGGED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: transactions, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['buyer-history'],
    queryFn: getBuyerHistory,
  });

  const filtered = useMemo(() => {
    return (transactions || []).filter((tx) => {
      if (filterType === 'SUCCESS' && tx.status !== 'SUCCESS') return false;
      if (filterType === 'FLAGGED' && tx.status !== 'FLAGGED') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          tx.shopName.toLowerCase().includes(q) ||
          (tx.qrReference && tx.qrReference.toLowerCase().includes(q)) ||
          tx.transactionId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, filterType, searchQuery]);

  // คำนวณสรุปยอดรวมจากรายการที่แสดง (นับเฉพาะ Co-pay ที่ไม่ได้ถูกยกเลิกในยอดสะสม)
  const summary = useMemo(() => {
    const list = transactions || [];
    return list.reduce(
      (acc, tx) => {
        acc.count += 1;
        const isCopay = (!tx.transactionType || tx.transactionType === 'COPAY') && tx.status !== 'REJECTED';
        if (isCopay) {
          acc.citizenPaid += tx.citizenPaidAmount || 0;
          acc.govCopay += tx.governmentCopayAmount || 0;
        }
        if (tx.status === 'SUCCESS') acc.successCount += 1;
        if (tx.status === 'FLAGGED') acc.flaggedCount += 1;
        return acc;
      },
      { count: 0, citizenPaid: 0, govCopay: 0, successCount: 0, flaggedCount: 0 }
    );
  }, [transactions]);

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* Page Title & Action Bar */}
      <div className="bg-white border-b border-hairline px-3.5 sm:px-6 lg:px-8 py-3 sm:py-3.5 mb-3.5 sm:mb-5 shadow-2xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
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
                ประวัติการทำธุรกรรม (Transaction Ledger)
              </h1>
              <p className="text-[11px] sm:text-xs text-brand-blue font-medium truncate">
                ประวัติการใช้จ่ายร่วม Co-pay 60/40 และสลิปอิเล็กทรอนิกส์ย้อนหลัง
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="flex shrink-0 items-center space-x-1.5 rounded-pill px-2.5 sm:px-3.5 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-brand-blue' : ''}`} />
            <span className="hidden xs:inline">อัปเดต</span>
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-3.5 sm:px-6 lg:px-8 space-y-3.5 sm:space-y-4">
        {/* แถบสรุปภาพรวมธุรกรรม (ปรับขนาดอัตโนมัติ: มือถือ 2+1 คอลัมน์, แท็บเล็ต/เดสก์ท็อป 3 คอลัมน์) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-hairline bg-white p-3 sm:p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] text-ink-muted font-medium">รายการธุรกรรมทั้งหมด</p>
              <p className="font-mono text-lg sm:text-xl font-bold text-ink mt-0.5">
                {summary.count} <span className="text-xs font-normal text-ink-muted">รายการ</span>
              </p>
            </div>
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
              <History className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>

          <div className="rounded-2xl border border-hairline bg-white p-3 sm:p-4 shadow-2xs flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[11px] text-ink-muted font-medium truncate">จ่ายจริงสะสม (40%)</p>
              <p className="font-mono text-base sm:text-xl font-bold text-status-error mt-0.5 truncate">
                ฿{summary.citizenPaid.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="hidden xs:flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-status-error">
              <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 sm:p-4 shadow-2xs flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[11px] text-emerald-800 font-medium truncate">รัฐช่วยจ่ายสะสม (60%)</p>
              <p className="font-mono text-base sm:text-xl font-bold text-emerald-700 mt-0.5 truncate">
                ฿{summary.govCopay.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="hidden xs:flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </div>
        </div>

        {/* แถบค้นหา + ตัวกรองสถานะ (Responsive Toolbar: เรียงซ้อนบนมือถือ / เรียงแนวนอนบนจอใหญ่) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* ช่องค้นหา */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <input
              type="text"
              placeholder="ค้นหาชื่อร้านค้า หรือรหัสอ้างอิง QR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-pill border border-hairline bg-white pl-10 pr-4 py-2.5 text-xs text-ink placeholder:text-ink-muted focus:border-brand-blue focus:outline-none shadow-2xs"
            />
          </div>

          {/* ตัวกรองสถานะ */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 no-scrollbar">
            {(
              [
                { key: 'ALL', label: 'ทั้งหมด', count: summary.count },
                { key: 'SUCCESS', label: 'สำเร็จ', count: summary.successCount },
                { key: 'FLAGGED', label: 'รอตรวจสอบ', count: summary.flaggedCount },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key)}
                className={`shrink-0 inline-flex items-center space-x-1.5 rounded-pill px-3.5 py-2 text-xs font-semibold transition ${
                  filterType === tab.key
                    ? 'bg-brand-blue text-white shadow-2xs'
                    : 'bg-white border border-hairline text-ink-muted hover:text-ink'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-pill px-1.5 py-0.2 text-[10px] font-mono ${
                    filterType === tab.key
                      ? 'bg-white/20 text-white'
                      : 'bg-surface-soft text-ink-muted'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* รายการประวัติธุรกรรม */}
        <div className="rounded-card border border-hairline bg-white p-3 sm:p-4 lg:p-5 shadow-sm">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-ink-muted">กำลังโหลดข้อมูล...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <History className="h-10 w-10 text-ink-muted mx-auto mb-2 opacity-50" />
              <p className="text-xs font-medium text-ink-muted">ไม่พบรายการธุรกรรมตามเงื่อนไข</p>
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {filtered.map((tx) => {
                const isFlagged = tx.status === 'FLAGGED';
                const isRejected = tx.status === 'REJECTED';
                const isTopUp = tx.transactionType === 'TOPUP';
                const isRefund = tx.transactionType === 'REFUND';
                const isPositive = isTopUp || isRefund;

                const formattedDate = new Date(tx.createdAt).toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={tx.transactionId}
                    onClick={() => {
                      if (!isTopUp) {
                        navigate(`/citizen/slip/${tx.transactionId}`);
                      }
                    }}
                    className={`py-3 sm:py-3.5 px-2 sm:px-3 flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 xs:gap-3 ${
                      isTopUp ? 'cursor-default' : 'cursor-pointer hover:bg-surface-soft/70'
                    } rounded-xl transition group`}
                  >
                    {/* ด้านซ้าย: ไอคอน + ชื่อร้านค้า + สถานะ + วันเวลา */}
                    <div className="flex items-start xs:items-center space-x-2.5 sm:space-x-3.5 min-w-0 flex-1">
                      <div
                        className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl font-bold text-xs border ${
                          isPositive
                            ? 'bg-emerald-50 text-status-success border-emerald-200'
                            : isRejected
                            ? 'bg-red-50 text-status-error border-red-200'
                            : isFlagged
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-brand-blue-light text-brand-blue border-blue-200'
                        }`}
                      >
                        {isPositive ? '+฿' : 'Co'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-ink group-hover:text-brand-blue transition truncate max-w-[190px] xs:max-w-[220px] sm:max-w-xs md:max-w-md">
                            {tx.shopName}
                          </span>

                          {/* ป้ายสถานะรายการ */}
                          {isRejected ? (
                            <span className="inline-flex shrink-0 items-center space-x-1 rounded-pill bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-status-error border border-red-200">
                              <AlertTriangle className="h-2.5 w-2.5 text-status-error" />
                              <span>ยกเลิกและคืนเงินแล้ว</span>
                            </span>
                          ) : isFlagged ? (
                            <span className="inline-flex shrink-0 items-center space-x-1 rounded-pill bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                              <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />
                              <span>รอตรวจสอบ</span>
                            </span>
                          ) : (
                            <span className="inline-flex shrink-0 items-center space-x-1 rounded-pill bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                              <span>สำเร็จ</span>
                            </span>
                          )}

                          {tx.isEligibleForReview && !isPositive && !isRejected && (
                            <span className="inline-flex shrink-0 items-center space-x-0.5 rounded-pill bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 font-medium border border-amber-200">
                              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                              <span>รีวิวได้</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-ink-muted mt-0.5">
                          <span>{formattedDate} น.</span>
                          {tx.qrReference && (
                            <span className="hidden md:inline font-mono text-[10px] text-slate-400">
                              • Ref: {tx.qrReference}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ด้านขวา: รายละเอียดตัวเลข + ปุ่มดูสลิป */}
                    <div className="flex items-center justify-between xs:justify-end gap-3 pl-12 xs:pl-0 shrink-0 border-t xs:border-t-0 border-hairline/60 pt-2 xs:pt-0">
                      {/* บนจอ Tablet/Desktop แสดงยอดรวม 100% เพิ่มเติม */}
                      <div className="hidden lg:block text-right pr-3 border-r border-hairline">
                        <div className="text-[10px] text-ink-muted">
                          {isTopUp ? 'ยอดเติมเงิน' : 'ยอดเต็ม (100%)'}
                        </div>
                        <div className="font-mono text-xs font-semibold text-ink">
                          ฿{tx.totalAmount.toFixed(2)}
                        </div>
                      </div>

                      <div className="text-left xs:text-right">
                        <div
                          className={`font-mono text-xs sm:text-sm font-bold whitespace-nowrap ${
                            isPositive
                              ? 'text-status-success'
                              : isRejected
                              ? 'text-ink-muted line-through'
                              : 'text-status-error'
                          }`}
                        >
                          {isPositive ? '+' : '-'}฿{tx.citizenPaidAmount.toFixed(2)}
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-brand-blue font-medium whitespace-nowrap">
                          {isTopUp
                            ? `ช่องทาง ${tx.paymentChannel || 'PROMPTPAY'}`
                            : isRefund
                            ? `คืนโควตารัฐ ฿${tx.governmentCopayAmount.toFixed(2)}`
                            : `รัฐช่วย ฿${tx.governmentCopayAmount.toFixed(2)}`}
                        </div>
                      </div>

                      {!isTopUp && (
                        <div className="flex items-center space-x-1 rounded-pill bg-surface-soft group-hover:bg-blue-50 px-2.5 py-1.5 border border-hairline group-hover:border-blue-200 transition">
                          <Receipt className="h-3.5 w-3.5 text-brand-blue shrink-0" />
                          <span className="text-[11px] font-semibold text-brand-blue hidden sm:inline">
                            ดูสลิป
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-brand-blue group-hover:translate-x-0.5 transition shrink-0" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
