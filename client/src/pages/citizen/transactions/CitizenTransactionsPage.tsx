import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  History,
  Star,
  ChevronRight,
  RefreshCw,
  Search,
} from 'lucide-react';
import { getBuyerHistory } from '../../../services/paymentApi';
import { APP_ROUTES } from '../../../constants/routes';

export const CitizenTransactionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<'ALL' | 'SUCCESS' | 'FLAGGED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: transactions, isLoading, refetch } = useQuery({
    queryKey: ['buyer-history'],
    queryFn: getBuyerHistory,
  });

  const filtered = (transactions || []).filter((tx) => {
    if (filterType === 'SUCCESS' && tx.status !== 'SUCCESS') return false;
    if (filterType === 'FLAGGED' && tx.status !== 'FLAGGED') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        tx.shopName.toLowerCase().includes(q) ||
        (tx.qrReference && tx.qrReference.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* Page Title & Action Bar */}
      <div className="bg-white border-b border-hairline px-4 md:px-8 py-3.5 mb-4 shadow-2xs">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => navigate(APP_ROUTES.CITIZEN_WALLET)}
              className="flex items-center space-x-1.5 rounded-pill px-3 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>กลับกระเป๋าเงิน</span>
            </button>
            <div className="border-l border-hairline pl-3">
              <h1 className="text-base font-bold text-ink">ประวัติการทำธุรกรรม (Transaction Ledger)</h1>
              <p className="text-xs text-brand-blue font-medium">ประวัติการใช้จ่ายร่วม Co-pay 60/40 ทั้งหมด</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center space-x-1.5 rounded-pill px-3 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">อัปเดต</span>
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-md md:max-w-4xl px-4 md:px-6 space-y-4">
        {/* ช่องค้นหา */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <input
            type="text"
            placeholder="ค้นหาชื่อร้านค้า หรือรหัสอ้างอิง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-pill border border-hairline bg-white pl-10 pr-4 py-2.5 text-xs text-ink placeholder:text-ink-muted focus:border-brand-blue focus:outline-none shadow-sm"
          />
        </div>

        {/* ตัวกรองสถานะ */}
        <div className="flex space-x-2">
          {(
            [
              { key: 'ALL', label: 'ทั้งหมด' },
              { key: 'SUCCESS', label: 'สำเร็จ' },
              { key: 'FLAGGED', label: 'รอตรวจสอบ' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              className={`rounded-pill px-4 py-1.5 text-xs font-medium transition ${
                filterType === tab.key
                  ? 'bg-brand-blue text-white shadow-sm'
                  : 'bg-white border border-hairline text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* รายการประวัติธุรกรรม */}
        <div className="rounded-card border border-hairline bg-white p-4 shadow-sm">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-ink-muted">กำลังโหลดข้อมูล...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <History className="h-10 w-10 text-ink-muted mx-auto mb-2 opacity-50" />
              <p className="text-xs font-medium text-ink-muted">ไม่พบรายการธุรกรรมตามเงื่อนไข</p>
            </div>
          ) : (
            <div className="divide-y divide-hairline">
              {filtered.map((tx) => (
                <div
                  key={tx.transactionId}
                  onClick={() => navigate(`/citizen/slip/${tx.transactionId}`)}
                  className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-surface-soft/60 px-2 rounded-xl transition group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue font-bold text-xs">
                      Co
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-ink group-hover:text-brand-blue transition">
                          {tx.shopName}
                        </span>
                        {tx.isEligibleForReview && (
                          <span className="inline-flex items-center space-x-0.5 rounded-pill bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 font-medium border border-amber-200">
                            <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                            <span>รีวิวได้</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        {new Date(tx.createdAt).toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-center space-x-2">
                    <div>
                      <div className="font-mono text-sm font-bold text-status-error">
                        -฿{tx.citizenPaidAmount.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-brand-blue">
                        รัฐช่วย ฿{tx.governmentCopayAmount.toFixed(2)}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-muted group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
