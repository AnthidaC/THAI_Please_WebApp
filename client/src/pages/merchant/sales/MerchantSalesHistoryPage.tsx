import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Sparkles,
  Store,
  RefreshCw,
  Star,
  MapPin,
  Search,
  CheckCircle2,
  XCircle,
  QrCode,
} from 'lucide-react';
import { getMerchantHistory } from '../../../services/paymentApi';
import { APP_ROUTES } from '../../../constants/routes';

export const MerchantSalesHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'SUCCESS' | 'REJECTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [salesDate, setSalesDate] = useState<string>('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['merchant-sales', salesDate],
    queryFn: () => getMerchantHistory(undefined, salesDate || undefined),
  });

  const allTransactions = data?.transactions || [];

  const filteredTransactions = allTransactions.filter((tx) => {
    if (filterStatus === 'SUCCESS' && tx.status !== 'SUCCESS' && tx.status !== 'FLAGGED') return false;
    if (filterStatus === 'REJECTED' && tx.status !== 'REJECTED') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        tx.qrReference.toLowerCase().includes(q) ||
        tx.customerName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const renderStatusBadge = (status: string) => {
    const isSuccess = status === 'SUCCESS' || status === 'FLAGGED';
    const isRejected = status === 'REJECTED';

    return (
      <span
        className={`inline-flex items-center space-x-1 rounded-pill px-2.5 py-0.5 text-[10px] font-semibold border whitespace-nowrap ${
          isSuccess
            ? 'bg-emerald-50 text-status-success border-emerald-200'
            : isRejected
            ? 'bg-red-50 text-status-error border-red-200'
            : 'bg-gray-100 text-ink-muted border-gray-200'
        }`}
      >
        {isSuccess ? (
          <>
            <CheckCircle2 className="h-3 w-3 shrink-0" />
            <span>สำเร็จ</span>
          </>
        ) : isRejected ? (
          <>
            <XCircle className="h-3 w-3 shrink-0" />
            <span>ถูกระงับ/นอกพิกัด</span>
          </>
        ) : (
          <span>{status}</span>
        )}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* Page Title & Action Bar */}
      <div className="bg-white border-b border-hairline px-3.5 sm:px-6 lg:px-8 py-3 sm:py-3.5 mb-4 shadow-2xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue shadow-xs">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-ink truncate">
                สถิติยอดขายและประวัติการรับเงินร้านค้า
              </h1>
              <p className="text-[11px] sm:text-xs text-ink-muted truncate">
                สรุปรายได้และประวัติธุรกรรมทั้งหมดในโครงการ Co-pay 60/40
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate(APP_ROUTES.MERCHANT_POS_QR)}
              className="inline-flex items-center space-x-1.5 rounded-pill bg-brand-blue px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-hover transition active:scale-95"
            >
              <QrCode className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xs:inline">สร้าง QR รับเงิน</span>
            </button>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center space-x-1.5 rounded-pill bg-surface-soft border border-hairline px-2.5 sm:px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-gray-200 hover:text-ink transition"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className="h-3.5 w-3.5 text-brand-blue" />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-3.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-hairline bg-white p-4 text-sm">
          <label htmlFor="sales-date" className="font-medium">ยอดขายประจำวันที่ (เวลาไทย)</label>
          <input id="sales-date" type="date" value={salesDate} onChange={event => setSalesDate(event.target.value)} className="rounded-full border border-hairline px-3 py-2" />
          <button type="button" onClick={() => setSalesDate('')} className="rounded-full border border-hairline px-4 py-2 text-xs">ดูทั้งหมด</button>
          {!salesDate && <span className="text-xs text-ink-muted">กำลังแสดงยอดขายทั้งหมด</span>}
        </div>
        {/* ข้อมูลร้านค้า */}
        {data?.merchant && (
          <div className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue">
                <Store className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-ink truncate">{data.merchant.shopName}</h2>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] sm:text-xs text-ink-muted mt-0.5">
                  <span className="font-mono">Tax ID: {data.merchant.taxId}</span>
                  <span>•</span>
                  <span className="inline-flex items-center space-x-1 text-amber-600 font-semibold">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500 shrink-0" />
                    <span>{data.merchant.averageRatingStars.toFixed(1)}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="text-[11px] sm:text-xs text-ink-muted flex items-center space-x-1.5 bg-surface-soft px-3 py-1.5 rounded-pill border border-hairline self-start sm:self-auto shrink-0">
              <MapPin className="h-3.5 w-3.5 text-brand-blue shrink-0" />
              <span className="font-mono">
                พิกัด: {data.merchant.latitude.toFixed(4)}, {data.merchant.longitude.toFixed(4)}
              </span>
            </div>
          </div>
        )}

        {/* แดชบอร์ดสรุปตัวเลข 4 KPI Cards (2x2 บนมือถือ, 4 คอลัมน์บนจอใหญ่) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: ยอดขายรวม */}
          <div className="rounded-card border border-hairline bg-white p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs text-ink-muted font-medium">ยอดขายสำเร็จรวม</span>
            <div className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-bold text-ink break-all">
              ฿ {isLoading ? '---' : (data?.summary.totalRevenue ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] sm:text-[11px] text-emerald-600 font-medium block mt-1">
              สะสมจากโครงการ Co-pay
            </span>
          </div>

          {/* Card 2: เงินสมทบจากรัฐบาล 60% */}
          <div className="rounded-card border border-blue-100 bg-gradient-to-br from-blue-50/60 to-white p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs text-brand-blue font-medium flex items-center space-x-1">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">รัฐบาลสมทบ (60%)</span>
            </span>
            <div className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-bold text-brand-blue break-all">
              ฿ {isLoading ? '---' : (data?.summary.governmentSubsidyTotal ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] sm:text-[11px] text-ink-muted block mt-1">
              โอนเข้าบัญชีร้านโดยตรง
            </span>
          </div>

          {/* Card 3: เงินที่ได้รับจากประชาชน 40% */}
          <div className="rounded-card border border-hairline bg-white p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs text-ink-muted font-medium">ประชาชนจ่าย (40%)</span>
            <div className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-bold text-status-success break-all">
              ฿ {isLoading ? '---' : (data?.summary.citizenPaidTotal ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] sm:text-[11px] text-ink-muted block mt-1">
              หักจากกระเป๋าดิจิทัลทันที
            </span>
          </div>

          {/* Card 4: จำนวนบิล */}
          <div className="rounded-card border border-hairline bg-white p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs text-ink-muted font-medium">จำนวนบิลที่ขายได้</span>
            <div className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-bold text-ink">
              {isLoading ? '---' : data?.summary.totalTransactions ?? 0} รายการ
            </div>
            <span className="text-[10px] sm:text-[11px] text-ink-muted block mt-1">
              ทำรายการผ่าน QR ร้านค้า
            </span>
          </div>
        </div>

        {/* ส่วนรายการประวัติธุรกรรมทั้งหมดของร้านค้า */}
        <div className="rounded-card border border-hairline bg-white p-4 sm:p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-ink">ประวัติการทำธุรกรรมร้านค้า</h3>
              <p className="text-[11px] sm:text-xs text-ink-muted mt-0.5">
                บันทึกประวัติการรับชำระเงินทั้งหมดในระบบ
              </p>
            </div>

            {/* ช่องค้นหา */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
              <input
                type="text"
                placeholder="ค้นหารหัส QR หรือชื่อลูกค้า..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-pill border border-hairline bg-surface-soft/50 pl-9 pr-3.5 py-2 text-xs text-ink focus:bg-white focus:border-brand-blue focus:outline-none"
              />
            </div>
          </div>

          {/* ตัวกรองสถานะธุรกรรม */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2 text-xs">
            {(
              [
                { key: 'ALL', label: 'ทั้งหมด' },
                { key: 'SUCCESS', label: 'สำเร็จ' },
                { key: 'REJECTED', label: 'ไม่สำเร็จ / ยกเลิก' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                className={`rounded-pill px-3 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-medium transition ${
                  filterStatus === tab.key
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'bg-surface-soft border border-hairline text-ink-muted hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-xs text-ink-muted">กำลังโหลดรายการบิล...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink-muted">
              ไม่พบรายการธุรกรรมตามเงื่อนไขที่เลือก
            </div>
          ) : (
            <>
              {/* 1. MOBILE & SMALL SCREEN CARD VIEW (แสดงบนมือถือ < 768px อ่านง่าย ไม่ต้องเลื่อนซ้าย-ขวา) */}
              <div className="space-y-3 md:hidden">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.transactionId}
                    className="rounded-2xl border border-hairline bg-surface-soft/50 p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-ink truncate">{tx.customerName}</div>
                        <div className="font-mono text-[11px] text-ink-muted truncate mt-0.5">
                          Ref: {tx.qrReference}
                        </div>
                      </div>
                      <div className="shrink-0">{renderStatusBadge(tx.status)}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-white p-2.5 border border-hairline/70 text-center">
                      <div>
                        <span className="block text-[10px] text-ink-muted">ยอดรวม (100%)</span>
                        <span className="font-mono text-xs font-bold text-ink">
                          ฿{tx.totalAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="border-x border-hairline/70 px-1">
                        <span className="block text-[10px] text-brand-blue">รัฐสมทบ (60%)</span>
                        <span className="font-mono text-xs font-bold text-brand-blue">
                          ฿{tx.governmentCopayAmount.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-ink-muted">ลูกค้าจ่าย (40%)</span>
                        <span className="font-mono text-xs font-bold text-status-success">
                          ฿{tx.citizenPaidAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-ink-muted pt-0.5">
                      <span>วัน-เวลาทำรายการ</span>
                      <span className="font-mono">
                        {new Date(tx.createdAt).toLocaleString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>


                  </div>
                ))}
              </div>

              {/* 2. TABLET & DESKTOP TABLE VIEW (แสดงบนหน้าจอ >= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-hairline text-ink-muted">
                      <th className="pb-3 pr-3 font-medium whitespace-nowrap">วัน-เวลา</th>
                      <th className="pb-3 px-3 font-medium whitespace-nowrap">รหัส QR / อ้างอิง</th>
                      <th className="pb-3 px-3 font-medium">ลูกค้า</th>
                      <th className="pb-3 px-3 font-medium text-right whitespace-nowrap">ยอดรวม (100%)</th>
                      <th className="pb-3 px-3 font-medium text-right whitespace-nowrap">รัฐสมทบ (60%)</th>
                      <th className="pb-3 px-3 font-medium text-right whitespace-nowrap">ลูกค้าจ่าย (40%)</th>
                      <th className="pb-3 pl-3 font-medium text-center whitespace-nowrap">สถานะธุรกรรม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.transactionId} className="hover:bg-surface-soft/60 transition">
                        <td className="py-3.5 pr-3 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[11px] text-ink font-semibold whitespace-nowrap">
                          <span>{tx.qrReference}</span>
                        </td>
                        <td className="py-3.5 px-3 font-medium text-ink">
                          <div>{tx.customerName}</div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-ink whitespace-nowrap">
                          ฿{tx.totalAmount.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-semibold text-brand-blue whitespace-nowrap">
                          ฿{tx.governmentCopayAmount.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-semibold text-status-success whitespace-nowrap">
                          ฿{tx.citizenPaidAmount.toFixed(2)}
                        </td>
                        <td className="py-3.5 pl-3 text-center whitespace-nowrap">
                          {renderStatusBadge(tx.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
