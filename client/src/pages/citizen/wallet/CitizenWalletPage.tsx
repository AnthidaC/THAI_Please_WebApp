import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  QrCode,
  ArrowUpRight,
  History,
  ShieldCheck,
  PlusCircle,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { getWalletBalance, topUpWallet, getBuyerHistory } from '../../../services/paymentApi';
import { APP_ROUTES } from '../../../constants/routes';

export const CitizenWalletPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(300);
  const [topUpSuccessMsg, setTopUpSuccessMsg] = useState<string | null>(null);

  // ดึงข้อมูลกระเป๋าเงิน
  const {
    data: wallet,
    isLoading: isWalletLoading,
    isError: isWalletError,
    refetch: refetchWallet,
  } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: getWalletBalance,
    refetchInterval: 10000,
  });

  // ดึงประวัติธุรกรรมล่าสุด
  const { data: transactions, isLoading: isTxLoading } = useQuery({
    queryKey: ['buyer-history'],
    queryFn: getBuyerHistory,
  });

  // Mutation สำหรับเติมเงิน
  const topUpMutation = useMutation({
    mutationFn: (amount: number) => topUpWallet(amount),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      queryClient.invalidateQueries({ queryKey: ['buyer-history'] });
      setTopUpSuccessMsg(`เติมเงินสำเร็จ ฿${topUpAmount.toLocaleString()} ยอดคงเหลือใหม่: ฿${data.newBalance.toLocaleString()}`);
      setTimeout(() => {
        setTopUpSuccessMsg(null);
        setShowTopUpModal(false);
      }, 1500);
    },
  });

  const dailyUsedPercent = wallet
    ? Math.min(100, Math.round((wallet.dailyQuotaUsed / wallet.dailyQuotaLimit) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-surface-soft pb-24 font-sans text-ink">
      {/* Page Title & Action Bar */}
      <div className="bg-white border-b border-hairline px-4 md:px-8 py-3.5 mb-4 shadow-2xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue shadow-xs">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-ink">กระเป๋าเงินดิจิทัลประชาชน</h1>
              <p className="text-xs text-ink-muted">โครงการไทยช่วยไทยพลีส (Co-pay 60/40)</p>
            </div>
          </div>
          <button
            onClick={() => refetchWallet()}
            className="flex items-center space-x-1.5 rounded-pill px-3 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">อัปเดตล่าสุด</span>
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-md md:max-w-5xl px-4 md:px-6 space-y-4 pb-24 md:pb-12">
        {/* ข้อความแจ้งเตือนข้อผิดพลาด (ถ้ามี) */}
        {isWalletError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-status-error flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">ไม่สามารถเชื่อมต่อข้อมูลกระเป๋าเงินได้</p>
              <p className="text-xs mt-1 text-red-600">กรุณาเข้าสู่ระบบ หรือลองใหม่อีกครั้ง</p>
            </div>
          </div>
        )}

        {/* Responsive Grid: Single column on Mobile, 2-Column on Desktop */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left Column: Balances, Quota & 3-Month Milestones (md:col-span-7) */}
          <div className="md:col-span-7 space-y-4">
            {/* 1. การ์ดยอดเงินส่วนตัว (Personal Wallet Balance) */}
            <section className="relative overflow-hidden rounded-card border border-hairline bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                  ยอดเงินในกระเป๋าส่วนตัว
                </span>
                <span className="inline-flex items-center rounded-pill bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-status-success border border-emerald-200">
                  <span className="mr-1 h-1.5 w-1.5 rounded-full bg-status-success animate-pulse" />
                  พร้อมใช้งาน
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <div className="font-mono text-3xl font-bold tracking-tight text-ink">
                    ฿ {isWalletLoading ? '---.--' : (wallet?.balance ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    ใช้สำหรับชำระส่วนของประชาชน (40% หรือส่วนเกิน)
                  </p>
                </div>
                <button
                  id="btn-open-topup"
                  onClick={() => setShowTopUpModal(true)}
                  className="inline-flex items-center space-x-1.5 rounded-pill bg-brand-blue px-3.5 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-brand-blue-hover active:scale-95"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>เติมเงิน</span>
                </button>
              </div>
            </section>

            {/* 2. การ์ดสิทธิรัฐสมทบ 60% (Co-pay 60% Quota Card & Monthly Milestone Tracker) */}
            <section className="rounded-card border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-brand-blue" />
                  <h2 className="text-sm font-semibold text-ink">สิทธิรัฐช่วยจ่าย 60%</h2>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="inline-flex items-center rounded-pill bg-blue-100/70 px-2 py-0.5 text-[10px] font-semibold text-brand-blue border border-blue-200">
                    <Calendar className="mr-1 h-3 w-3" />
                    รอบ {wallet?.monthlyCycle?.currentMonthName ?? 'ตุลาคม 2569'}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-hairline/60 bg-white p-3">
                  <span className="text-[11px] text-ink-muted">โควตาวันนี้คงเหลือ</span>
                  <div className="mt-1 font-mono text-xl font-bold text-brand-blue">
                    ฿ {isWalletLoading ? '---' : (wallet?.dailyQuotaRemaining ?? 150).toFixed(2)}
                  </div>
                  <span className="text-[10px] text-ink-muted">
                    จากเต็ม ฿{(wallet?.dailyQuotaLimit ?? 150).toFixed(2)} / วัน
                  </span>
                </div>

                <div className="rounded-2xl border border-hairline/60 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-ink-muted">สิทธิสะสมรวมคงเหลือ</span>
                    <span className="rounded-pill bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                      งวดที่ {wallet?.monthlyCycle?.currentPeriodIndex ?? 1}/{wallet?.monthlyCycle?.totalPeriods ?? 3}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-xl font-bold text-emerald-600">
                    ฿ {isWalletLoading ? '---' : (wallet?.totalQuotaRemaining ?? 3000).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="mt-1 space-y-0.5 border-t border-hairline/60 pt-1">
                    <div className="text-[10px] text-ink flex items-center justify-between">
                      <span className="text-ink-muted">สะสมถึงงวด:</span>
                      <span className="font-semibold text-brand-blue">{wallet?.monthlyCycle?.currentMonthName ?? 'ตุลาคม 2569'}</span>
                    </div>
                    <div className="text-[9px] text-ink-muted flex items-center justify-between">
                      <span>เพิ่มรอบถัดไป:</span>
                      <span className="font-mono text-ink font-medium">{wallet?.monthlyCycle?.nextQuotaDate ?? '1 พ.ย. 2569'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* รอบการจัดสรรสิทธิ์รายเดือน (Monthly Quota Milestone Tracker) */}
              <div className="mt-3.5 pt-3 border-t border-hairline/70">
                <div className="flex items-center justify-between text-xs text-ink-muted mb-1.5">
                  <span className="flex items-center space-x-1.5 font-medium text-ink">
                    <Calendar className="h-3.5 w-3.5 text-brand-blue" />
                    <span>รอบการจัดสรรสิทธิ์รายเดือน (3 เดือน)</span>
                  </span>
                  <span className="text-[10px] text-brand-blue font-medium">
                    {wallet?.monthlyCycle?.periodRangeLabel ?? 'ต.ค. - ธ.ค. 2569'}
                  </span>
                </div>

                {/* 3 Steps monthly progress pills */}
                <div className="grid grid-cols-3 gap-1.5 mt-2">
                  {(wallet?.monthlyCycle?.periods ?? [
                    { periodNumber: 1, monthName: 'ต.ค. 2569', amount: 1000, status: 'ACTIVE', badgeLabel: 'กำลังใช้สิทธิ์งวดนี้' },
                    { periodNumber: 2, monthName: 'พ.ย. 2569', amount: 1000, status: 'UPCOMING', badgeLabel: 'เปิด 1 พ.ย.' },
                    { periodNumber: 3, monthName: 'ธ.ค. 2569', amount: 1000, status: 'UPCOMING', badgeLabel: 'เปิด 1 ธ.ค.' },
                  ]).map((p) => {
                    const isActive = p.status === 'ACTIVE';
                    const isCompleted = p.status === 'COMPLETED';
                    return (
                      <div
                        key={p.periodNumber}
                        className={`rounded-2xl border p-2 text-center transition ${
                          isActive
                            ? 'border-blue-400 bg-blue-50/80 shadow-sm ring-1 ring-blue-300'
                            : isCompleted
                            ? 'border-emerald-200 bg-emerald-50/50'
                            : 'border-hairline bg-surface-soft/80 opacity-75'
                        }`}
                      >
                        <div className="text-[9px] font-bold text-ink-muted">งวดที่ {p.periodNumber}</div>
                        <div className="text-[10px] font-bold text-ink mt-0.5">{p.monthName}</div>
                        <div className="font-mono text-xs font-bold text-ink mt-0.5">
                          ฿{p.amount.toLocaleString()}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-block rounded-pill px-1.5 py-0.2 text-[8px] font-semibold ${
                              isActive
                                ? 'bg-brand-blue text-white'
                                : isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-ink-muted'
                            }`}
                          >
                            {p.badgeLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* แถบการใช้สิทธิรายวัน */}
              <div className="mt-3.5">
                <div className="flex justify-between text-xs text-ink-muted mb-1.5">
                  <span>การใช้สิทธิวันนี้ (รีเซ็ตทุกวัน 06:00 น.)</span>
                  <span className="font-mono">{dailyUsedPercent}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-blue transition-all duration-500"
                    style={{ width: `${dailyUsedPercent}%` }}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: CTA & Transactions (md:col-span-5) */}
          <div className="md:col-span-5 space-y-4">
            {/* 3. Primary CTA: สแกน QR ชำระเงินร่วม Co-pay 60/40 */}
            <section>
              <button
                id="btn-scan-copay"
                onClick={() => navigate(APP_ROUTES.CITIZEN_SCAN_COPAY)}
                className="group flex w-full items-center justify-between rounded-card bg-brand-blue p-5 text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-brand-blue-hover active:scale-98"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-sm group-hover:scale-105 transition shadow-xs">
                    <QrCode className="h-7 w-7" />
                  </div>
                  <div className="text-left">
                    <div className="text-base font-bold leading-tight">
                      สแกนชำระ Co-pay 60/40
                    </div>
                    <div className="text-xs text-blue-100 mt-1">
                      สแกน Dynamic QR หน้าร้านค้าทันที
                    </div>
                  </div>
                </div>
                <div className="pr-1">
                  <ArrowUpRight className="h-6 w-6 text-white/90 group-hover:translate-x-1 group-hover:-translate-y-1 transition" />
                </div>
              </button>
            </section>

            {/* 4. รายการธุรกรรมล่าสุด (Recent Transactions) */}
            <section className="rounded-card border border-hairline bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <History className="h-4 w-4 text-ink-muted" />
                  <h3 className="text-sm font-semibold text-ink">ประวัติการใช้จ่ายล่าสุด</h3>
                </div>
                <button
                  onClick={() => navigate(APP_ROUTES.CITIZEN_TRANSACTIONS)}
                  className="text-xs font-medium text-brand-blue hover:underline"
                >
                  ดูทั้งหมด
                </button>
              </div>

              {isTxLoading ? (
                <div className="py-6 text-center text-xs text-ink-muted">กำลังโหลดประวัติ...</div>
              ) : !transactions || transactions.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-ink-muted mb-2">
                    <History className="h-6 w-6" />
                  </div>
                  <p className="text-xs text-ink-muted">ยังไม่มีประวัติการใช้จ่าย</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">กดสแกน QR เพื่อเริ่มต้นใช้สิทธิ Co-pay ได้ทันที</p>
                </div>
              ) : (
                <div className="divide-y divide-hairline">
                  {transactions.slice(0, 4).map((tx) => (
                    <div
                      key={tx.transactionId}
                      onClick={() => navigate(`/citizen/slip/${tx.transactionId}`)}
                      className="flex items-center justify-between py-3 cursor-pointer hover:bg-surface-soft/60 px-2 rounded-xl transition"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-status-success font-semibold text-xs">
                          ฿
                        </div>
                        <div>
                          <p className="text-sm font-medium text-ink leading-snug">{tx.shopName}</p>
                          <p className="text-[11px] text-ink-muted">
                            {new Date(tx.createdAt).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold text-status-error">
                          -฿{tx.citizenPaidAmount.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-brand-blue">
                          รัฐช่วย ฿{tx.governmentCopayAmount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Institutional Calm Badge */}
            <section className="flex items-center justify-center space-x-2 py-2 text-xs text-ink-muted">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>ระบบตรวจจับความปลอดภัยพิกัด GPS & Semi-AI ทำงานตลอดเวลา</span>
            </section>
          </div>
        </div>
      </main>

      {/* Modal เติมเงินด่วน (Quick Top-up Modal) */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-sm rounded-card border border-hairline bg-white p-6 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
            <h3 className="text-lg font-bold text-ink">เติมเงินเข้ากระเป๋า</h3>
            <p className="text-xs text-ink-muted mt-1">
              เลือกยอดเงินที่ต้องการเติมเพื่อใช้ชำระเงินร่วม Co-pay 40%
            </p>

            {topUpSuccessMsg ? (
              <div className="my-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center text-status-success font-medium text-sm">
                🎉 {topUpSuccessMsg}
              </div>
            ) : (
              <>
                {/* ปุ่มเลือกจำนวนเงินสำเร็จรูป */}
                <div className="my-5 grid grid-cols-3 gap-2">
                  {[100, 300, 500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      className={`rounded-pill border py-2.5 text-xs font-semibold font-mono transition ${
                        topUpAmount === amt
                          ? 'border-brand-blue bg-brand-blue-light text-brand-blue'
                          : 'border-hairline text-ink hover:border-gray-400'
                      }`}
                    >
                      ฿{amt.toLocaleString()}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-hairline pt-4">
                  <button
                    type="button"
                    onClick={() => setShowTopUpModal(false)}
                    className="rounded-pill px-4 py-2 text-xs font-medium text-ink-muted hover:bg-gray-100 transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    id="btn-confirm-topup"
                    disabled={topUpMutation.isPending}
                    onClick={() => topUpMutation.mutate(topUpAmount)}
                    className="inline-flex items-center space-x-1.5 rounded-pill bg-brand-blue px-5 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-brand-blue-hover active:scale-95 disabled:opacity-50"
                  >
                    {topUpMutation.isPending ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>กำลังประมวลผล...</span>
                      </>
                    ) : (
                      <span>ยืนยันเติมเงิน ฿{topUpAmount.toLocaleString()}</span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
