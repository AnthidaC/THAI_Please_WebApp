import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Sparkles,
  Store,
  RefreshCw,
  Star,
  MapPin,
} from 'lucide-react';
import { getMerchantHistory } from '../../../services/paymentApi';

export const MerchantSalesHistoryPage: React.FC = () => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['merchant-sales'],
    queryFn: () => getMerchantHistory(),
  });

  return (
    <div className="min-h-screen bg-surface-soft p-4 md:p-8 font-sans text-ink">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-6 w-6 text-brand-blue" />
              <h1 className="text-xl font-bold text-ink">สถิติยอดขายและประวัติการรับเงินร้านค้า</h1>
            </div>
            <p className="text-xs text-ink-muted mt-1">
              สรุปรายได้จากโครงการไทยช่วยไทยพลีส สัดส่วน Co-pay 60/40
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center space-x-1.5 rounded-pill bg-white border border-hairline px-3.5 py-2 text-xs font-medium text-ink shadow-sm hover:bg-gray-50 transition"
          >
            <RefreshCw className="h-3.5 w-3.5 text-brand-blue" />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>

        {/* ข้อมูลร้านค้า */}
        {data?.merchant && (
          <div className="mb-6 rounded-card border border-hairline bg-white p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue">
                <Store className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">{data.merchant.shopName}</h2>
                <div className="flex items-center space-x-3 text-xs text-ink-muted mt-0.5">
                  <span>Tax ID: {data.merchant.taxId}</span>
                  <span>•</span>
                  <span className="flex items-center space-x-1 text-amber-600 font-semibold">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    <span>{data.merchant.averageRatingStars.toFixed(1)}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="text-xs text-ink-muted flex items-center space-x-1">
              <MapPin className="h-3.5 w-3.5 text-brand-blue" />
              <span>พิกัดร้านค้า: {data.merchant.latitude.toFixed(4)}, {data.merchant.longitude.toFixed(4)}</span>
            </div>
          </div>
        )}

        {/* แดชบอร์ดสรุปตัวเลข 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: ยอดขายรวม */}
          <div className="rounded-card border border-hairline bg-white p-5 shadow-sm">
            <span className="text-xs text-ink-muted font-medium">ยอดขายรวมทั้งหมด</span>
            <div className="mt-2 font-mono text-2xl font-bold text-ink">
              ฿ {isLoading ? '---' : (data?.summary.totalRevenue ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium block mt-1">
              สะสมจากโครงการ Co-pay
            </span>
          </div>

          {/* Card 2: เงินสมทบจากรัฐบาล 60% */}
          <div className="rounded-card border border-blue-100 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm">
            <span className="text-xs text-brand-blue font-medium flex items-center space-x-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>รัฐบาลสมทบ (60%)</span>
            </span>
            <div className="mt-2 font-mono text-2xl font-bold text-brand-blue">
              ฿ {isLoading ? '---' : (data?.summary.governmentSubsidyTotal ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-ink-muted block mt-1">
              โอนเข้าบัญชีร้านค้าโดยตรง
            </span>
          </div>

          {/* Card 3: เงินที่ได้รับจากประชาชน 40% */}
          <div className="rounded-card border border-hairline bg-white p-5 shadow-sm">
            <span className="text-xs text-ink-muted font-medium">ประชาชนจ่าย (40%)</span>
            <div className="mt-2 font-mono text-2xl font-bold text-status-success">
              ฿ {isLoading ? '---' : (data?.summary.citizenPaidTotal ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-ink-muted block mt-1">
              หักจากกระเป๋าเงินดิจิทัลทันที
            </span>
          </div>

          {/* Card 4: จำนวนบิล */}
          <div className="rounded-card border border-hairline bg-white p-5 shadow-sm">
            <span className="text-xs text-ink-muted font-medium">จำนวนรายการที่ขายได้</span>
            <div className="mt-2 font-mono text-2xl font-bold text-ink">
              {isLoading ? '---' : data?.summary.totalTransactions ?? 0} รายการ
            </div>
            <span className="text-[11px] text-ink-muted block mt-1">
              การสแกนผ่าน Dynamic QR
            </span>
          </div>
        </div>

        {/* ตารางรายการบิลที่ลูกค้าสแกนจ่าย */}
        <div className="rounded-card border border-hairline bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-ink mb-4">รายการบิลขายล่าสุด</h3>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-ink-muted">กำลังโหลดรายการบิล...</div>
          ) : !data || data.transactions.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink-muted">
              ยังไม่มีประวัติการรับชำระเงิน
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-hairline text-ink-muted">
                    <th className="pb-3 font-medium">วัน-เวลา</th>
                    <th className="pb-3 font-medium">รหัส QR / อ้างอิง</th>
                    <th className="pb-3 font-medium">ลูกค้า</th>
                    <th className="pb-3 font-medium text-right">ยอดรวม (100%)</th>
                    <th className="pb-3 font-medium text-right">รัฐสมทบ (60%)</th>
                    <th className="pb-3 font-medium text-right">ลูกค้าจ่าย (40%)</th>
                    <th className="pb-3 font-medium text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {data.transactions.map((tx) => (
                    <tr key={tx.transactionId} className="hover:bg-surface-soft/60 transition">
                      <td className="py-3 font-mono text-[11px] text-ink-muted">
                        {new Date(tx.createdAt).toLocaleString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 font-mono text-[11px] text-ink font-semibold">
                        {tx.qrReference}
                      </td>
                      <td className="py-3 font-medium text-ink">{tx.customerName}</td>
                      <td className="py-3 text-right font-mono font-bold text-ink">
                        ฿{tx.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-brand-blue">
                        ฿{tx.governmentCopayAmount.toFixed(2)}
                      </td>
                      <td className="py-3 text-right font-mono font-semibold text-status-success">
                        ฿{tx.citizenPaidAmount.toFixed(2)}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`rounded-pill px-2.5 py-0.5 text-[10px] font-medium border ${
                            tx.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-status-success border-emerald-200'
                              : 'bg-amber-50 text-status-warning border-amber-200'
                          }`}
                        >
                          {tx.status === 'SUCCESS' ? 'สำเร็จ' : 'รอตรวจสอบ'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
