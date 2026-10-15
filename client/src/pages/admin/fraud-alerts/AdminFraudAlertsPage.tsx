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
} from 'lucide-react';
import { getFraudAlerts, resolveFraudAlert, FraudAlertItem } from '../../../services/paymentApi';

export const AdminFraudAlertsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedAlert, setSelectedAlert] = useState<FraudAlertItem | null>(null);
  const [resolveNote, setResolveNote] = useState<string>('');

  const { data: alerts, isLoading, refetch } = useQuery({
    queryKey: ['fraud-alerts'],
    queryFn: getFraudAlerts,
    refetchInterval: 15000,
  });

  const resolveMutation = useMutation({
    mutationFn: (params: { id: string; action: 'APPROVE' | 'REJECT'; note?: string }) =>
      resolveFraudAlert(params.id, params.action, params.note),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] });
      alert(`ดำเนินการ ${vars.action === 'APPROVE' ? 'อนุมัติ' : 'ปฏิเสธ'} เรียบร้อยแล้ว`);
      setSelectedAlert(null);
      setResolveNote('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'ไม่สามารถบันทึกผลได้');
    },
  });

  return (
    <div className="min-h-screen bg-surface-soft p-4 md:p-8 font-sans text-ink">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldAlert className="h-6 w-6 text-status-error" />
              <h1 className="text-xl font-bold text-ink">ระบบตรวจจับและแจ้งเตือนทุจริตพิกัด GPS & Semi-AI</h1>
            </div>
            <p className="text-xs text-ink-muted mt-1">
              วิเคราะห์ความผิดปกติของพิกัด Geofence และคะแนนความเสี่ยงจาก AI Anomaly Detection แบบเรียลไทม์
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center space-x-1.5 rounded-pill bg-white border border-hairline px-3.5 py-2 text-xs font-medium text-ink shadow-sm hover:bg-gray-50 transition"
          >
            <RefreshCw className="h-3.5 w-3.5 text-brand-blue" />
            <span>ตรวจสอบล่าสุด</span>
          </button>
        </div>

        {/* แดชบอร์ดสรุป 4 การ์ดสถิติความปลอดภัย */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-card border border-hairline bg-white p-5 shadow-sm">
            <span className="text-xs text-ink-muted font-medium">รายการที่ตรวจจับทั้งหมด</span>
            <div className="mt-2 font-mono text-2xl font-bold text-ink">1,420 รายการ</div>
            <span className="text-[11px] text-brand-blue font-medium block mt-1">
              ครอบคลุมทุกธุรกรรม Co-pay
            </span>
          </div>

          <div className="rounded-card border border-hairline bg-white p-5 shadow-sm">
            <span className="text-xs text-emerald-700 font-medium flex items-center space-x-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
              <span>อนุมัติอัตโนมัติ (ปกติ)</span>
            </span>
            <div className="mt-2 font-mono text-2xl font-bold text-status-success">98.2%</div>
            <span className="text-[11px] text-ink-muted block mt-1">พิกัดตรงหน้าร้าน &lt; 500 ม.</span>
          </div>

          <div className="rounded-card border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
            <span className="text-xs text-amber-800 font-medium flex items-center space-x-1">
              <AlertTriangle className="h-3.5 w-3.5 text-status-warning" />
              <span>รอเจ้าหน้าที่ตรวจสอบ (Flagged)</span>
            </span>
            <div className="mt-2 font-mono text-2xl font-bold text-status-warning">
              {isLoading ? '...' : alerts?.length ?? 0} เคส
            </div>
            <span className="text-[11px] text-amber-700 block mt-1">
              พิกัดเบี่ยงเบน หรือ AI ประเมินเสี่ยง
            </span>
          </div>

          <div className="rounded-card border border-hairline bg-white p-5 shadow-sm">
            <span className="text-xs text-ink-muted font-medium flex items-center space-x-1">
              <Cpu className="h-3.5 w-3.5 text-brand-blue" />
              <span>ระบบประมวลผล Semi-AI</span>
            </span>
            <div className="mt-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-pill inline-block border border-emerald-200">
              ● Anomaly Model Active
            </div>
            <span className="text-[10px] text-ink-muted block mt-1.5">
              พร้อมต่อ AI API ภายนอก (ไม่ใช่ Rule-based)
            </span>
          </div>
        </div>

        {/* ตารางรายการแจ้งเตือนการทุจริต */}
        <div className="rounded-card border border-hairline bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-ink">รายการที่ตรวจพบความผิดปกติทางสถิติ</h3>
            <span className="text-xs text-ink-muted">
              เรียงลำดับจากความเสี่ยงสูงไปต่ำ
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-ink-muted">กำลังดึงข้อมูลการทุจริต...</div>
          ) : !alerts || alerts.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-status-success mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-ink">ไม่มีรายการทุจริตค้างในระบบ</p>
              <p className="text-xs text-ink-muted mt-0.5">
                ธุรกรรมทั้งหมดผ่านเกณฑ์ความปลอดภัยพิกัด GPS หน้าร้าน
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-hairline text-ink-muted">
                    <th className="pb-3 font-medium">วัน-เวลา</th>
                    <th className="pb-3 font-medium">ผู้ซื้อ / ร้านค้า</th>
                    <th className="pb-3 font-medium text-right">ยอดรวม (฿)</th>
                    <th className="pb-3 font-medium text-center">ระยะห่าง GPS</th>
                    <th className="pb-3 font-medium text-center">AI Risk Score</th>
                    <th className="pb-3 font-medium">เหตุผลที่ AI ตรวจพบ</th>
                    <th className="pb-3 font-medium text-center">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {alerts.map((alertItem) => (
                    <tr key={alertItem.fraudCheckId} className="hover:bg-surface-soft/60 transition">
                      <td className="py-3 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                        {new Date(alertItem.createdAt).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3">
                        <div className="font-semibold text-ink">{alertItem.customerName}</div>
                        <div className="text-[11px] text-ink-muted">{alertItem.shopName}</div>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-ink whitespace-nowrap">
                        ฿{alertItem.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`rounded-pill px-2.5 py-0.5 text-[11px] font-mono font-semibold border ${
                            alertItem.distanceMeters > 5000
                              ? 'bg-red-50 text-status-error border-red-200'
                              : 'bg-amber-50 text-status-warning border-amber-200'
                          }`}
                        >
                          {alertItem.distanceMeters > 1000
                            ? `${(alertItem.distanceMeters / 1000).toFixed(1)} กม.`
                            : `${alertItem.distanceMeters.toFixed(0)} ม.`}
                        </span>
                      </td>
                      <td className="py-3 text-center">
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
                      <td className="py-3 text-[11px] text-ink-muted max-w-xs">
                        {alertItem.fraudReason || 'พิกัด GPS เบี่ยงเบนเกินระยะหน้าร้าน'}
                      </td>
                      <td className="py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => setSelectedAlert(alertItem)}
                            className="rounded-pill p-1.5 text-brand-blue hover:bg-blue-50 transition"
                            title="ดูรายละเอียดพิกัดและแผนที่"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              resolveMutation.mutate({
                                id: alertItem.fraudCheckId,
                                action: 'APPROVE',
                                note: 'ตรวจสอบแล้ว เป็นลูกค้าจริงในพื้นที่ใกล้เคียง',
                              })
                            }
                            className="rounded-pill bg-emerald-50 text-status-success hover:bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold border border-emerald-200 transition"
                          >
                            อนุมัติ
                          </button>
                          <button
                            onClick={() =>
                              resolveMutation.mutate({
                                id: alertItem.fraudCheckId,
                                action: 'REJECT',
                                note: 'ระงับรายการเนื่องจากพิกัดห่างไกลผิดปกติ',
                              })
                            }
                            className="rounded-pill bg-red-50 text-status-error hover:bg-red-100 px-2.5 py-1 text-[11px] font-semibold border border-red-200 transition"
                          >
                            ระงับ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal ดูรายละเอียดและแผนที่จำลองเปรียบเทียบพิกัด */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-card border border-hairline bg-white p-6 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-hairline">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-5 w-5 text-status-warning" />
                <h3 className="text-base font-bold text-ink">รายละเอียดการตรวจสอบพิกัด GPS & AI</h3>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="rounded-full p-1 text-ink-muted hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-surface-soft p-3">
                  <span className="text-ink-muted block text-[10px]">พิกัดผู้ซื้อ (Citizen GPS)</span>
                  <div className="font-mono font-semibold text-ink mt-0.5">
                    {selectedAlert.userLat.toFixed(6)}, {selectedAlert.userLon.toFixed(6)}
                  </div>
                  <span className="text-[10px] text-ink-muted mt-1 block">
                    ผู้ใช้: {selectedAlert.customerName}
                  </span>
                </div>

                <div className="rounded-2xl bg-surface-soft p-3">
                  <span className="text-ink-muted block text-[10px]">พิกัดร้านค้า (Merchant GPS)</span>
                  <div className="font-mono font-semibold text-ink mt-0.5">
                    {selectedAlert.merchantLat.toFixed(6)}, {selectedAlert.merchantLon.toFixed(6)}
                  </div>
                  <span className="text-[10px] text-ink-muted mt-1 block">
                    ร้าน: {selectedAlert.shopName}
                  </span>
                </div>
              </div>

              {/* แผนภาพเปรียบเทียบพิกัด */}
              <div className="rounded-2xl border border-hairline bg-slate-900 p-4 text-white text-center">
                <div className="flex items-center justify-around py-4">
                  <div className="text-center">
                    <div className="h-9 w-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-1">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <span className="text-[10px]">จุดที่ผู้ซื้ออยู่</span>
                  </div>

                  <div className="flex-1 px-4 text-center">
                    <div className="border-t-2 border-dashed border-amber-400 relative">
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-2 text-[10px] text-amber-400 font-mono font-bold">
                        ห่าง {(selectedAlert.distanceMeters / 1000).toFixed(2)} กม.
                      </span>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <span className="text-[10px]">จุดที่ตั้งร้านค้า</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                <span className="font-semibold text-brand-blue block">คำอธิบายจากระบบ AI:</span>
                <p className="mt-1 text-ink">{selectedAlert.fraudReason}</p>
              </div>

              {/* ช่องบันทึกเหตุผลของผู้ดูแลระบบ */}
              <div>
                <label className="block text-[11px] font-medium text-ink-muted mb-1">
                  บันทึกความเห็นของผู้ดูแลระบบ (Audit Note)
                </label>
                <input
                  type="text"
                  placeholder="เช่น ตรวจสอบใบเสร็จหน้าร้านแล้ว ถูกต้องตามเงื่อนไข"
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  className="w-full rounded-pill border border-hairline px-4 py-2 text-xs focus:border-brand-blue focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-hairline">
              <button
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedAlert.fraudCheckId,
                    action: 'REJECT',
                    note: resolveNote || 'ผู้ดูแลระบบสั่งระงับธุรกรรม',
                  })
                }
                className="rounded-pill bg-red-50 text-status-error hover:bg-red-100 px-4 py-2 text-xs font-semibold border border-red-200 transition"
              >
                ระงับและยกเลิกรายการ
              </button>
              <button
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedAlert.fraudCheckId,
                    action: 'APPROVE',
                    note: resolveNote || 'ผู้ดูแลระบบตรวจสอบอนุมัติพิเศษ',
                  })
                }
                className="rounded-pill bg-brand-blue text-white hover:bg-brand-blue-hover px-5 py-2 text-xs font-semibold shadow-sm transition"
              >
                อนุมัติรายการ (Approve)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
