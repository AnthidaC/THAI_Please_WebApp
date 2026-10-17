import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Eye,
  X,
  Store,
  UserX,
  FileSearch,
} from 'lucide-react';
import {
  getFraudAlerts,
  resolveFraudAlert,
  FraudAlertItem,
  FraudResolveAction,
} from '../../../services/paymentApi';

export const AdminFraudAlertsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedAlert, setSelectedAlert] = useState<FraudAlertItem | null>(null);
  const [resolveNote, setResolveNote] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: alerts, isLoading, refetch } = useQuery({
    queryKey: ['fraud-alerts'],
    queryFn: getFraudAlerts,
    refetchInterval: 15000,
  });

  const actionSuccessTextMap: Record<FraudResolveAction, string> = {
    APPROVE: 'ยืนยันรายการปกติ (Approve) เรียบร้อยแล้ว',
    REJECT: 'บันทึกส่งเรื่องตรวจสอบบัญชีเบื้องหลังเรียบร้อยแล้ว (ไม่ดึงเงินคืนอัตโนมัติ)',
    SUSPEND_MERCHANT: 'ระงับสิทธิ์ร้านค้าชั่วคราวเพื่อส่งเจ้าหน้าที่เข้าตรวจสอบร้านค้าเรียบร้อยแล้ว',
    SUSPEND_USER: 'ระงับสิทธิ์การใช้จ่ายโครงการของประชาชนรายนี้ชั่วคราวเรียบร้อยแล้ว',
  };

  const resolveMutation = useMutation({
    mutationFn: (params: { id: string; action: FraudResolveAction; note?: string }) =>
      resolveFraudAlert(params.id, params.action, params.note),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] });
      setActionFeedback({
        type: 'success',
        text: actionSuccessTextMap[vars.action] || 'บันทึกผลการตรวจสอบเรียบร้อยแล้ว',
      });
      setSelectedAlert(null);
      setResolveNote('');
      setTimeout(() => setActionFeedback(null), 5000);
    },
    onError: (err: any) => {
      setActionFeedback({
        type: 'error',
        text: err.response?.data?.message || err.message || 'ไม่สามารถบันทึกผลการตรวจสอบได้',
      });
    },
  });

  const formatDistance = (meters: number) =>
    meters > 1000 ? `${(meters / 1000).toFixed(1)} กม.` : `${meters.toFixed(0)} ม.`;

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* Page Title & Action Bar */}
      <div className="bg-white border-b border-hairline px-3.5 sm:px-6 lg:px-8 py-3 sm:py-3.5 mb-4 shadow-2xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-status-error border border-red-100 shadow-xs">
              <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-ink truncate">
                ระบบตรวจจับและแจ้งเตือนทุจริตพิกัด GPS &amp; Semi-AI
              </h1>
              <p className="text-[11px] sm:text-xs text-ink-muted truncate">
                คัดกรองความน่าสงสัยซ้ำๆ ส่งให้ Admin ตรวจสอบร้านค้าหรือระงับสิทธิ์ผู้ต้องสงสัย (ไม่ดึงเงินคืนอัตโนมัติ)
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex shrink-0 items-center space-x-1.5 rounded-pill bg-surface-soft border border-hairline px-2.5 sm:px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-gray-200 hover:text-ink transition"
            title="ตรวจสอบล่าสุด"
          >
            <RefreshCw className="h-3.5 w-3.5 text-brand-blue" />
            <span className="hidden sm:inline">ตรวจสอบล่าสุด</span>
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-3.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        {/* แถบแจ้งเตือนผลการดำเนินการ */}
        {actionFeedback && (
          <div
            className={`rounded-2xl border p-3.5 sm:p-4 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs animate-in fade-in ${
              actionFeedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-status-error'
            }`}
          >
            <div className="flex items-center space-x-2 font-medium">
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-status-error shrink-0" />
              )}
              <span>{actionFeedback.text}</span>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="p-1 text-ink-muted hover:text-ink shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* แดชบอร์ดสรุป 4 การ์ดสถิติความปลอดภัย (2x2 บนมือถือ, 4 คอลัมน์บนจอใหญ่) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-card border border-hairline bg-white p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs text-ink-muted font-medium">รายการที่ตรวจจับทั้งหมด</span>
            <div className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-bold text-ink">
              {(alerts?.[0]?.systemStats?.totalChecksCount ?? 1420).toLocaleString('th-TH')} รายการ
            </div>
            <span className="text-[10px] sm:text-[11px] text-brand-blue font-medium block mt-1">
              ครอบคลุมทุกธุรกรรม Co-pay (รัศมี 2 กม.)
            </span>
          </div>

          <div className="rounded-card border border-hairline bg-white p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs text-emerald-700 font-medium flex items-center space-x-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-status-success shrink-0" />
              <span className="truncate">อนุมัติอัตโนมัติ (ปกติ)</span>
            </span>
            <div className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-bold text-status-success">
              {alerts?.[0]?.systemStats?.approvalRate ?? 98.2}%
            </div>
            <span className="text-[10px] sm:text-[11px] text-ink-muted block mt-1">
              พิกัดในรัศมี &le; 2 กม. และไม่พบพฤติกรรมซ้ำผิดปกติ
            </span>
          </div>

          <div className="rounded-card border border-amber-200 bg-amber-50/50 p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs text-amber-800 font-medium flex items-center space-x-1">
              <AlertTriangle className="h-3.5 w-3.5 text-status-warning shrink-0" />
              <span className="truncate">รอ Admin ตรวจสอบ (Flagged)</span>
            </span>
            <div className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-bold text-status-warning">
              {isLoading ? '...' : alerts?.length ?? 0} เคส
            </div>
            <span className="text-[10px] sm:text-[11px] text-amber-700 block mt-1">
              AI ตรวจพบความน่าสงสัยซ้ำๆ (ไม่บล็อกอัตโนมัติ)
            </span>
          </div>

          <div className="rounded-card border border-hairline bg-white p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs text-ink-muted font-medium flex items-center space-x-1">
              <Cpu className="h-3.5 w-3.5 text-brand-blue shrink-0" />
              <span className="truncate">มาตรการคุ้มครองผู้ค้า &amp; รัฐ</span>
            </span>
            <div className="mt-1.5 sm:mt-2">
              <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-pill inline-block border border-emerald-200">
                ● ไม่ดึงเงินคืนอัตโนมัติ
              </span>
            </div>
            <span className="text-[10px] text-ink-muted block mt-1">
              เน้นตรวจสอบร้านค้า/ระงับสิทธิ์ผู้ต้องสงสัยรายบุคคล
            </span>
          </div>
        </div>

        {/* รายการแจ้งเตือนการทุจริต */}
        <div className="rounded-card border border-hairline bg-white p-4 sm:p-5 md:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
            <h3 className="text-sm sm:text-base font-bold text-ink">
              รายการที่ AI ตรวจพบความน่าสงสัยซ้ำๆ ส่งให้ Admin ตรวจสอบ
            </h3>
            <span className="text-[11px] sm:text-xs text-ink-muted">
              เลือกตรวจสอบเชิงลึกเพื่อระงับสิทธิ์ร้านค้าหรือประชาชนที่น่าสงสัย โดยไม่กระทบยอดขายที่ส่งมอบสินค้าไปแล้ว
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-ink-muted">กำลังดึงข้อมูลการทุจริต...</div>
          ) : !alerts || alerts.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-status-success mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-ink">ไม่มีรายการทุจริตค้างในระบบ</p>
              <p className="text-xs text-ink-muted mt-0.5">
                ธุรกรรมทั้งหมดผ่านเกณฑ์ความปลอดภัยพิกัด GPS ภายในรัศมี 2 กิโลเมตร
              </p>
            </div>
          ) : (
            <>
              {/* 1. MOBILE & TABLET CARD VIEW (แสดงบนจอ < 1024px กดจัดการง่าย ไม่ต้องเลื่อนตารางซ้าย-ขวา) */}
              <div className="space-y-3 lg:hidden">
                {alerts.map((alertItem) => (
                  <div
                    key={alertItem.fraudCheckId}
                    className="rounded-2xl border border-hairline bg-surface-soft/50 p-3.5 sm:p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-ink truncate">
                          {alertItem.customerName}
                        </div>
                        <div className="text-[11px] sm:text-xs text-ink-muted truncate">
                          ร้านค้า: {alertItem.shopName}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-sm sm:text-base font-bold text-ink">
                          ฿{alertItem.totalAmount.toFixed(2)}
                        </div>
                        <div className="font-mono text-[10px] text-ink-muted">
                          {new Date(alertItem.createdAt).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          น.
                        </div>
                      </div>
                    </div>

                    {/* Badges: ระยะห่าง GPS & AI Risk Score & ความถี่ซ้ำ */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center space-x-1 rounded-pill px-2.5 py-0.5 text-[11px] font-mono font-semibold border ${
                          alertItem.distanceMeters > 2000
                            ? 'bg-red-50 text-status-error border-red-200'
                            : 'bg-amber-50 text-status-warning border-amber-200'
                        }`}
                      >
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>ห่าง {formatDistance(alertItem.distanceMeters)}</span>
                      </span>

                      <span
                        className={`inline-flex items-center space-x-1 rounded-pill px-2.5 py-0.5 text-[11px] font-mono font-bold ${
                          alertItem.riskScore >= 0.7
                            ? 'bg-red-100 text-status-error'
                            : 'bg-amber-100 text-status-warning'
                        }`}
                      >
                        <span>AI Risk: {alertItem.riskScore.toFixed(2)}</span>
                      </span>

                      {(alertItem.repeatCount ?? 1) > 1 && (
                        <span className="inline-flex items-center space-x-1 rounded-pill bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-0.5 text-[11px] font-semibold">
                          <span>พบซ้ำ {alertItem.repeatCount} ครั้ง</span>
                        </span>
                      )}
                    </div>

                    {/* เหตุผลที่ AI ตรวจพบ */}
                    <div className="rounded-xl bg-white border border-hairline/80 p-2.5 text-[11px] sm:text-xs text-ink-muted">
                      <span className="font-semibold text-ink">สาเหตุ: </span>
                      {alertItem.fraudReason || 'ตรวจพบพฤติกรรมน่าสงสัยซ้ำๆ'}
                    </div>

                    {/* ปุ่มจัดการบนมือถือ/แท็บเล็ต */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                      <button
                        onClick={() => setSelectedAlert(alertItem)}
                        className="inline-flex items-center justify-center space-x-1 rounded-pill border border-blue-200 bg-blue-50 py-2 px-2 text-xs font-semibold text-brand-blue hover:bg-blue-100 transition active:scale-95"
                      >
                        <Eye className="h-3.5 w-3.5 shrink-0" />
                        <span>ตรวจสอบเชิงลึก</span>
                      </button>
                      <button
                        disabled={resolveMutation.isPending}
                        onClick={() =>
                          resolveMutation.mutate({
                            id: alertItem.fraudCheckId,
                            action: 'APPROVE',
                            note: 'ตรวจสอบแล้ว เป็นลูกค้าและร้านค้าจริงในพื้นที่',
                          })
                        }
                        className="inline-flex items-center justify-center rounded-pill bg-emerald-50 text-status-success hover:bg-emerald-100 py-2 px-2 text-xs font-semibold border border-emerald-200 transition active:scale-95 disabled:opacity-50"
                      >
                        ยืนยันปกติ
                      </button>
                      <button
                        disabled={resolveMutation.isPending}
                        onClick={() =>
                          resolveMutation.mutate({
                            id: alertItem.fraudCheckId,
                            action: 'SUSPEND_MERCHANT',
                            note: 'ระงับสิทธิ์ร้านค้าชั่วคราวเพื่อส่งเจ้าหน้าที่เข้าตรวจสอบร้านค้า',
                          })
                        }
                        className="inline-flex items-center justify-center space-x-1 rounded-pill bg-amber-50 text-amber-800 hover:bg-amber-100 py-2 px-2 text-xs font-semibold border border-amber-200 transition active:scale-95 disabled:opacity-50"
                      >
                        <Store className="h-3.5 w-3.5 shrink-0" />
                        <span>ระงับร้านค้า</span>
                      </button>
                      <button
                        disabled={resolveMutation.isPending}
                        onClick={() =>
                          resolveMutation.mutate({
                            id: alertItem.fraudCheckId,
                            action: 'SUSPEND_USER',
                            note: 'ระงับสิทธิ์ Co-pay ของประชาชนเนื่องจากพบพฤติกรรมน่าสงสัยซ้ำๆ',
                          })
                        }
                        className="inline-flex items-center justify-center space-x-1 rounded-pill bg-red-50 text-status-error hover:bg-red-100 py-2 px-2 text-xs font-semibold border border-red-200 transition active:scale-95 disabled:opacity-50"
                      >
                        <UserX className="h-3.5 w-3.5 shrink-0" />
                        <span>ระงับสิทธิ์ผู้ใช้</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 2. DESKTOP TABLE VIEW (แสดงบนจอใหญ่ >= 1024px) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-hairline text-ink-muted">
                      <th className="pb-3 pr-3 font-medium whitespace-nowrap">วัน-เวลา</th>
                      <th className="pb-3 px-3 font-medium">ผู้ซื้อ / ร้านค้า</th>
                      <th className="pb-3 px-3 font-medium text-right whitespace-nowrap">ยอดรวม (฿)</th>
                      <th className="pb-3 px-3 font-medium text-center whitespace-nowrap">ระยะห่าง GPS</th>
                      <th className="pb-3 px-3 font-medium text-center whitespace-nowrap">AI Risk Score</th>
                      <th className="pb-3 px-3 font-medium">เหตุผลที่ AI ตรวจพบ</th>
                      <th className="pb-3 pl-3 font-medium text-center whitespace-nowrap">การจัดการของ Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {alerts.map((alertItem) => (
                      <tr key={alertItem.fraudCheckId} className="hover:bg-surface-soft/60 transition">
                        <td className="py-3.5 pr-3 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                          {new Date(alertItem.createdAt).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-ink">{alertItem.customerName}</span>
                            {(alertItem.repeatCount ?? 1) > 1 && (
                              <span className="rounded-pill bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 text-[10px] font-semibold">
                                ซ้ำ {alertItem.repeatCount} ครั้ง
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-ink-muted">{alertItem.shopName}</div>
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-ink whitespace-nowrap">
                          ฿{alertItem.totalAmount.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`rounded-pill px-2.5 py-0.5 text-[11px] font-mono font-semibold border ${
                              alertItem.distanceMeters > 2000
                                ? 'bg-red-50 text-status-error border-red-200'
                                : 'bg-amber-50 text-status-warning border-amber-200'
                            }`}
                          >
                            {formatDistance(alertItem.distanceMeters)}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`rounded-pill px-2.5 py-0.5 text-[11px] font-mono font-bold ${
                              alertItem.riskScore >= 0.7
                                ? 'bg-red-100 text-status-error'
                                : 'bg-amber-100 text-status-warning'
                            }`}
                          >
                            {alertItem.riskScore.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-[11px] text-ink-muted max-w-xs">
                          {alertItem.fraudReason || 'ตรวจพบพฤติกรรมน่าสงสัยซ้ำๆ'}
                        </td>
                        <td className="py-3.5 pl-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => setSelectedAlert(alertItem)}
                              className="inline-flex items-center space-x-1 rounded-pill bg-blue-50 text-brand-blue hover:bg-blue-100 px-2.5 py-1 text-[11px] font-semibold border border-blue-200 transition"
                              title="เปิดหน้าต่างตรวจสอบข้อมูลร้านค้าและประชาชน"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>ตรวจสอบ</span>
                            </button>
                            <button
                              disabled={resolveMutation.isPending}
                              onClick={() =>
                                resolveMutation.mutate({
                                  id: alertItem.fraudCheckId,
                                  action: 'APPROVE',
                                  note: 'ตรวจสอบแล้ว เป็นลูกค้าจริงในพื้นที่ใกล้เคียง',
                                })
                              }
                              className="rounded-pill bg-emerald-50 text-status-success hover:bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold border border-emerald-200 transition disabled:opacity-50"
                            >
                              ยืนยันปกติ
                            </button>
                            <button
                              disabled={resolveMutation.isPending}
                              onClick={() =>
                                resolveMutation.mutate({
                                  id: alertItem.fraudCheckId,
                                  action: 'SUSPEND_MERCHANT',
                                  note: 'ระงับสิทธิ์ร้านค้าชั่วคราวเพื่อส่งเจ้าหน้าที่เข้าตรวจสอบ',
                                })
                              }
                              className="rounded-pill bg-amber-50 text-amber-800 hover:bg-amber-100 px-2.5 py-1 text-[11px] font-semibold border border-amber-200 transition disabled:opacity-50"
                              title="ระงับสิทธิ์ร้านค้าชั่วคราวเพื่อเข้าตรวจสอบ"
                            >
                              ระงับร้านค้า
                            </button>
                            <button
                              disabled={resolveMutation.isPending}
                              onClick={() =>
                                resolveMutation.mutate({
                                  id: alertItem.fraudCheckId,
                                  action: 'SUSPEND_USER',
                                  note: 'ระงับสิทธิ์ Co-pay ของประชาชนที่น่าสงสัย',
                                })
                              }
                              className="rounded-pill bg-red-50 text-status-error hover:bg-red-100 px-2.5 py-1 text-[11px] font-semibold border border-red-200 transition disabled:opacity-50"
                              title="ระงับสิทธิ์การใช้จ่ายโครงการของประชาชนรายนี้"
                            >
                              ระงับสิทธิ์ผู้ใช้
                            </button>
                          </div>
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

      {/* Modal ตรวจสอบเชิงลึก: ดูข้อมูลร้านค้า, ประชาชน, แผนที่พิกัด และเลือกมาตรการจัดการ */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-card border border-hairline bg-white p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto animate-in fade-in slide-in-from-bottom duration-200">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-200 sm:hidden" />
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-hairline">
              <div className="flex items-center space-x-2 min-w-0">
                <ShieldAlert className="h-5 w-5 text-status-warning shrink-0" />
                <h3 className="text-sm sm:text-base font-bold text-ink truncate">
                  ตรวจสอบข้อมูลเชิงลึก &amp; มาตรการระงับสิทธิ์
                </h3>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="rounded-full p-1 text-ink-muted hover:bg-gray-100 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              {/* ข้อมูลผู้ซื้อและร้านค้าสำหรับให้ Admin ตรวจสอบ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <div className="rounded-2xl border border-hairline bg-surface-soft p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted text-[10px] font-semibold">ข้อมูลประชาชน (ผู้ซื้อ)</span>
                    <span
                      className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
                        selectedAlert.userWalletStatus === 'SUSPENDED'
                          ? 'bg-red-100 text-status-error'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {selectedAlert.userWalletStatus === 'SUSPENDED' ? 'ถูกระงับสิทธิ์แล้ว' : 'สถานะปกติ'}
                    </span>
                  </div>
                  <div className="font-bold text-ink text-xs sm:text-sm truncate">
                    {selectedAlert.customerName}
                  </div>
                  <div className="font-mono text-[11px] text-ink-muted break-all">
                    GPS: {selectedAlert.userLat.toFixed(6)}, {selectedAlert.userLon.toFixed(6)}
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    จ่ายจริง 40%: <span className="font-mono font-semibold text-ink">฿{selectedAlert.citizenPaidAmount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-hairline bg-surface-soft p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted text-[10px] font-semibold">ข้อมูลร้านค้า (ผู้รับเงิน)</span>
                    <span
                      className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
                        selectedAlert.isMerchantApproved === false
                          ? 'bg-red-100 text-status-error'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {selectedAlert.isMerchantApproved === false ? 'ระงับชั่วคราว' : 'อนุมัติปกติ'}
                    </span>
                  </div>
                  <div className="font-bold text-ink text-xs sm:text-sm truncate">
                    {selectedAlert.shopName}
                  </div>
                  <div className="font-mono text-[11px] text-ink-muted">
                    Tax ID: {selectedAlert.merchantTaxId || '-'}
                  </div>
                  <div className="font-mono text-[11px] text-ink-muted break-all">
                    GPS: {selectedAlert.merchantLat.toFixed(6)}, {selectedAlert.merchantLon.toFixed(6)}
                  </div>
                </div>
              </div>

              {/* แผนภาพเปรียบเทียบพิกัด */}
              <div className="rounded-2xl border border-hairline bg-slate-900 p-3.5 sm:p-4 text-white text-center">
                <div className="flex items-center justify-around py-3 sm:py-4">
                  <div className="text-center shrink-0">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-1">
                      <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <span className="text-[10px]">จุดผู้ซื้อ</span>
                  </div>

                  <div className="flex-1 px-2 sm:px-4 text-center">
                    <div className="border-t-2 border-dashed border-amber-400 relative">
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-1.5 sm:px-2 text-[10px] text-amber-400 font-mono font-bold whitespace-nowrap">
                        ห่าง {(selectedAlert.distanceMeters / 1000).toFixed(2)} กม.
                      </span>
                    </div>
                  </div>

                  <div className="text-center shrink-0">
                    <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1">
                      <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <span className="text-[10px]">จุดร้านค้า</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-brand-blue">คำอธิบายจากระบบ AI:</span>
                  {(selectedAlert.repeatCount ?? 1) > 1 && (
                    <span className="rounded-pill bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 text-[10px] font-semibold">
                      พบความน่าสงสัยซ้ำ {selectedAlert.repeatCount} ครั้ง
                    </span>
                  )}
                </div>
                <p className="mt-1 text-ink leading-relaxed">{selectedAlert.fraudReason}</p>
              </div>

              {/* คำชี้แจงเรื่องการไม่ดึงเงินคืนอัตโนมัติ */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] text-amber-900">
                <span className="font-semibold">หมายเหตุกระบวนการตรวจสอบ: </span>
                ระบบจะไม่ดึงเงินคืนอัตโนมัติเพื่อป้องกันร้านค้าสูญเสียเงินฟรีหลังส่งมอบสินค้าแล้ว โดยผู้ดูแลระบบสามารถเลือก
                <strong> ระงับสิทธิ์ร้านค้าชั่วคราว</strong> เพื่อลงพื้นที่ตรวจสอบ หรือ
                <strong> ระงับสิทธิ์การใช้จ่ายของประชาชน</strong> ที่มีพฤติกรรมน่าสงสัยซ้ำๆ ได้ทันที
              </div>

              {/* ช่องบันทึกเหตุผลของผู้ดูแลระบบ */}
              <div>
                <label className="block text-[11px] font-medium text-ink-muted mb-1">
                  บันทึกความเห็นของผู้ดูแลระบบ (Audit Note)
                </label>
                <input
                  type="text"
                  placeholder="เช่น ส่งทีมตรวจสอบหน้าร้าน / ระงับสิทธิ์ชั่วคราวเพื่อรอยืนยันตัวตน"
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  className="w-full rounded-pill border border-hairline px-4 py-2.5 text-xs focus:border-brand-blue focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-hairline">
              <button
                disabled={resolveMutation.isPending}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedAlert.fraudCheckId,
                    action: 'APPROVE',
                    note: resolveNote || 'ผู้ดูแลระบบตรวจสอบแล้วยืนยันว่าเป็นรายการปกติ',
                  })
                }
                className=" inline-flex items-center justify-center space-x-1.5 rounded-pill bg-brand-blue text-white hover:bg-brand-blue-hover px-4 py-2.5 text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>ยืนยันรายการปกติ (Approve)</span>
              </button>

              <button
                disabled={resolveMutation.isPending}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedAlert.fraudCheckId,
                    action: 'REJECT',
                    note: resolveNote || 'บันทึกส่งตรวจสอบบัญชีเบื้องหลัง (ไม่ดึงเงินคืนอัตโนมัติ)',
                  })
                }
                className="inline-flex items-center justify-center space-x-1.5 rounded-pill bg-slate-100 text-ink hover:bg-slate-200 px-4 py-2.5 text-xs font-semibold border border-hairline transition disabled:opacity-50"
              >
                <FileSearch className="h-4 w-4 shrink-0" />
                <span>ส่งตรวจสอบเบื้องหลัง (ไม่คืนเงิน Auto)</span>
              </button>

              <button
                disabled={resolveMutation.isPending}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedAlert.fraudCheckId,
                    action: 'SUSPEND_MERCHANT',
                    note: resolveNote || 'ระงับสิทธิ์ร้านค้าชั่วคราวเพื่อส่งเจ้าหน้าที่เข้าตรวจสอบร้านค้า',
                  })
                }
                className="inline-flex items-center justify-center space-x-1.5 rounded-pill bg-amber-50 text-amber-800 hover:bg-amber-100 px-4 py-2.5 text-xs font-semibold border border-amber-200 transition disabled:opacity-50"
              >
                <Store className="h-4 w-4 shrink-0" />
                <span>ระงับ/ตรวจสอบร้านค้านี้</span>
              </button>

              <button
                disabled={resolveMutation.isPending}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedAlert.fraudCheckId,
                    action: 'SUSPEND_USER',
                    note: resolveNote || 'ระงับสิทธิ์ Co-pay ของประชาชนเนื่องจากมีพฤติกรรมน่าสงสัยซ้ำๆ',
                  })
                }
                className="inline-flex items-center justify-center space-x-1.5 rounded-pill bg-red-50 text-status-error hover:bg-red-100 px-4 py-2.5 text-xs font-semibold border border-red-200 transition disabled:opacity-50"
              >
                <UserX className="h-4 w-4 shrink-0" />
                <span>ระงับสิทธิ์ประชาชนรายนี้</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

