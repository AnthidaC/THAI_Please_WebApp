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
  Users,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckCheck,
  Calendar,
  Clock,
  XCircle,
} from 'lucide-react';
import {
  getFraudAlerts,
  getFraudDossiers,
  resolveFraudAlert,
  resolveFraudDossier,
  FraudAlertItem,
  FraudResolveAction,
  DossierResolveAction,
  UserFraudDossier,
  MerchantFraudDossier,
} from '../../../services/paymentApi';
import { FraudLocationMap } from '../../../components/admin/FraudLocationMap';

const formatDistance = (meters: number) =>
  meters > 1000 ? `${(meters / 1000).toFixed(1)} กม.` : `${meters.toFixed(0)} ม.`;

const formatThaiDate = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
};

const formatThaiTime = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  })} น.`;
};

const formatThaiDateTime = (dateStr?: string) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const dateFormatted = d.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
  const timeFormatted = d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateFormatted} • ${timeFormatted} น.`;
};

const renderTransactionStatusBadge = (txStatus?: string, decision?: string) => {
  const isRejected = txStatus === 'REJECTED' || decision === 'REJECTED';
  if (isRejected) {
    return (
      <span className="inline-flex items-center space-x-1 rounded-pill bg-red-50 text-status-error border border-red-200 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold">
        <XCircle className="h-3 w-3 shrink-0 text-status-error" />
        <span>ถูกบล็อก (ไม่สำเร็จ)</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center space-x-1 rounded-pill bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold">
      <CheckCircle2 className="h-3 w-3 shrink-0 text-status-success" />
      <span>ชำระสำเร็จ (ตัดเงินแล้ว)</span>
    </span>
  );
};

interface SubBillsViewerProps {
  transactions: FraudAlertItem[];
  type: 'USER' | 'MERCHANT';
  onSelectAlert: (alert: FraudAlertItem) => void;
}

const SubBillsViewer: React.FC<SubBillsViewerProps> = ({
  transactions,
  type,
  onSelectAlert,
}) => {
  const completedCount = transactions.filter(
    (tx) => tx.transactionStatus !== 'REJECTED' && tx.decision !== 'REJECTED'
  ).length;
  const rejectedCount = transactions.length - completedCount;

  return (
    <div className="border-t border-hairline bg-surface-soft/60 p-3 sm:p-4 md:p-5 space-y-3 animate-in fade-in duration-200">
      {/* สรุปภาพรวมและตัวนับบิลย่อย */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white border border-hairline rounded-2xl p-3 sm:px-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-ink">
            <FileSearch className="h-4 w-4 text-brand-blue shrink-0" />
            <span>
              {type === 'USER' ? 'รายการบิลย่อยในแฟ้มคดีนี้' : 'รายการบิลลูกค้าที่สแกนกับร้านนี้'}
            </span>
          </div>
          <span className="bg-brand-blue/10 text-brand-blue font-mono font-bold px-2 py-0.5 rounded-pill text-[11px]">
            {transactions.length} รายการ
          </span>
        </div>

        {/* Breakdown สรุปสถานะความสำเร็จของบิล */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center space-x-1 rounded-pill bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-status-success shrink-0" />
            <span>
              ชำระสำเร็จ: <strong className="font-mono">{completedCount}</strong> บิล
            </span>
          </span>
          {rejectedCount > 0 && (
            <span className="inline-flex items-center space-x-1 rounded-pill bg-red-50 text-status-error border border-red-200 px-2.5 py-0.5 font-medium">
              <XCircle className="h-3.5 w-3.5 text-status-error shrink-0" />
              <span>
                ถูกบล็อก: <strong className="font-mono">{rejectedCount}</strong> บิล
              </span>
            </span>
          )}
        </div>
      </div>

      {/* รายการบิลย่อยแบบ Scrollable สะอาดตา อ่านง่าย ไม่ทำให้หน้ารวมยืดยาว */}
      <div className="max-h-[520px] overflow-y-auto pr-1 space-y-2.5">
        {transactions.map((tx) => {
          const txDate = tx.transactionCreatedAt || tx.createdAt;
          const isRejected = tx.transactionStatus === 'REJECTED' || tx.decision === 'REJECTED';

          return (
            <div
              key={tx.fraudCheckId}
              className={`rounded-2xl border bg-white p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition duration-150 ${
                isRejected ? 'border-red-200 bg-red-50/20' : 'border-hairline hover:border-brand-blue/30'
              }`}
            >
              {/* แถวด้านบน: วันที่ & เวลา + สถานะสำเร็จไหม + ยอดเงิน Co-pay */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-hairline/60">
                <div className="flex flex-wrap items-center gap-2">
                  {/* วันที่ และ เวลา ที่ทำรายการบิลนี้ */}
                  <span className="inline-flex items-center space-x-1.5 font-mono text-[11px] font-semibold text-ink bg-surface-soft px-2.5 py-1 rounded-lg border border-hairline">
                    <Calendar className="h-3.5 w-3.5 text-brand-blue shrink-0" />
                    <span>{formatThaiDate(txDate)}</span>
                    <span className="text-ink-muted font-normal">•</span>
                    <Clock className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                    <span>{formatThaiTime(txDate)}</span>
                  </span>

                  {/* ป้ายสถานะว่าบิลนั้นสำเร็จไหม */}
                  {renderTransactionStatusBadge(tx.transactionStatus, tx.decision)}
                </div>

                {/* ยอดเงิน Co-pay */}
                <div className="flex items-baseline space-x-2 sm:text-right shrink-0">
                  <span className="text-[11px] text-ink-muted sm:hidden">ยอดบิล:</span>
                  <span className="font-mono text-sm sm:text-base font-bold text-ink">
                    ฿{tx.totalAmount.toFixed(2)}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-status-error bg-red-50 border border-red-100 px-2 py-0.5 rounded-md">
                    (รัฐ 60%: ฿{tx.copayAmount.toFixed(2)})
                  </span>
                </div>
              </div>

              {/* แถวด้านล่าง: คู่ค้า + ระยะทาง + ข้อสงสัย AI + ปุ่มดูแผนที่ */}
              <div className="pt-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
                <div className="space-y-1.5 min-w-0">
                  <div className="font-semibold text-ink flex flex-wrap items-center gap-2">
                    {type === 'USER' ? (
                      <span className="flex items-center space-x-1.5 text-ink">
                        <Store className="h-3.5 w-3.5 text-brand-blue shrink-0" />
                        <span className="truncate">ร้าน: {tx.shopName}</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1.5 text-ink">
                        <Users className="h-3.5 w-3.5 text-brand-blue shrink-0" />
                        <span className="truncate">ลูกค้า: {tx.customerName}</span>
                      </span>
                    )}

                    <span className="text-[10px] text-ink-muted bg-surface-soft border border-hairline px-2 py-0.5 rounded-pill font-mono">
                      ห่าง {formatDistance(tx.distanceMeters)}
                    </span>
                  </div>

                  {/* ข้อสังเกตจาก AI */}
                  <div className="text-[11px] text-ink-muted flex items-start space-x-1.5 leading-relaxed bg-surface-soft/60 rounded-xl px-2.5 py-1 border border-hairline/40">
                    <span className="text-brand-blue font-bold shrink-0">ข้อสังเกต:</span>
                    <span>{tx.fraudReason}</span>
                  </div>
                </div>

                {/* Action: แผนที่พิกัด */}
                <button
                  onClick={() => onSelectAlert(tx)}
                  className="inline-flex items-center justify-center space-x-1.5 rounded-pill border border-hairline bg-surface-soft hover:bg-brand-blue hover:text-white hover:border-brand-blue px-3.5 py-1.5 text-xs font-semibold text-ink transition shadow-2xs shrink-0 self-start md:self-center"
                >
                  <Eye className="h-3.5 w-3.5 text-brand-blue hover:text-inherit" />
                  <span>ดูพิกัดแผนที่</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const AdminFraudAlertsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'USER_DOSSIERS' | 'MERCHANT_DOSSIERS' | 'RAW_ALERTS'>('USER_DOSSIERS');
  const [includeNoise, setIncludeNoise] = useState<boolean>(false);
  const [expandedDossierId, setExpandedDossierId] = useState<string | null>(null);
  const [expandedMerchantsUserId, setExpandedMerchantsUserId] = useState<string | null>(null);

  const [selectedAlert, setSelectedAlert] = useState<FraudAlertItem | null>(null);
  const [resolveNote, setResolveNote] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ดึงข้อมูลแฟ้มสรุปคดีระดับบุคคลและร้านค้า (Grouped by User / Merchant + Noise Filtered)
  const {
    data: dossiersData,
    isLoading: isDossiersLoading,
    refetch: refetchDossiers,
  } = useQuery({
    queryKey: ['fraud-dossiers', includeNoise],
    queryFn: () => getFraudDossiers(includeNoise),
    refetchInterval: 15000,
  });

  // ดึงข้อมูลธุรกรรมรายบิลแบบละเอียด (Raw Alerts)
  const {
    data: rawAlerts,
    isLoading: isAlertsLoading,
    refetch: refetchAlerts,
  } = useQuery({
    queryKey: ['fraud-alerts'],
    queryFn: getFraudAlerts,
    refetchInterval: 15000,
  });

  const handleRefreshAll = () => {
    refetchDossiers();
    refetchAlerts();
  };

  const actionSuccessTextMap: Record<FraudResolveAction, string> = {
    APPROVE: 'ยืนยันรายการปกติเรียบร้อยแล้ว',
    REJECT: 'บันทึกส่งเรื่องตรวจสอบเพิ่มเติมเรียบร้อยแล้ว',
    SUSPEND_MERCHANT: 'ระงับสิทธิร้านค้าชั่วคราวเพื่อตรวจสอบเรียบร้อยแล้ว',
    SUSPEND_USER: 'ระงับสิทธิการใช้จ่ายของประชาชนรายนี้ชั่วคราวเรียบร้อยแล้ว',
  };

  // Mutation สำหรับจัดการรายธุรกรรมเดี่ยว (Single Transaction)
  const resolveMutation = useMutation({
    mutationFn: (params: { id: string; action: FraudResolveAction; note?: string }) =>
      resolveFraudAlert(params.id, params.action, params.note),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['fraud-dossiers'] });
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

  // Mutation สำหรับจัดการแฟ้มคดีระดับบุคคล/ร้านค้าแบบ Batch 1-Click
  const resolveDossierMutation = useMutation({
    mutationFn: (params: {
      targetType: 'USER' | 'MERCHANT';
      targetId: string;
      action: DossierResolveAction;
      note?: string;
    }) => resolveFraudDossier(params),
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['fraud-dossiers'] });
      queryClient.invalidateQueries({ queryKey: ['fraud-alerts'] });
      const actionLabels: Record<DossierResolveAction, string> = {
        APPROVE_ALL: 'อนุมัติทุกรายการในแฟ้มคดีนี้เรียบร้อยแล้ว',
        REJECT_ALL: 'ปฏิเสธทุกรายการในแฟ้มคดีนี้เรียบร้อยแล้ว',
        SUSPEND_USER: 'ระงับสิทธิประชาชนและเคลียร์แฟ้มคดีเรียบร้อยแล้ว',
        SUSPEND_MERCHANT: 'ระงับสิทธิร้านค้าและเคลียร์แฟ้มคดีเรียบร้อยแล้ว',
      };
      setActionFeedback({
        type: 'success',
        text: `${actionLabels[vars.action]} (จัดการสำเร็จ ${res.resolvedCount} รายการ)`,
      });
      setResolveNote('');
      setTimeout(() => setActionFeedback(null), 5000);
    },
    onError: (err: any) => {
      setActionFeedback({
        type: 'error',
        text: err.response?.data?.message || err.message || 'ไม่สามารถจัดการแฟ้มคดีได้',
      });
    },
  });

  const summary = dossiersData?.summary;
  const userDossiers = dossiersData?.userDossiers || [];
  const merchantDossiers = dossiersData?.merchantDossiers || [];

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* Header & Refresh */}
      <div className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-2">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-status-error border border-red-100 shadow-xs">
              <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-ink truncate">
                ระบบวิเคราะห์และตรวจสอบความผิดปกติ (Fraud Operations)
              </h1>
              <p className="text-[11px] sm:text-xs text-ink-muted truncate">
                AI สรุปสำนวนคดีระดับบุคคลและร้านค้า ป้องกันภาระงานล้น (Anti-Alert Fatigue)
              </p>
            </div>
          </div>
          <button
            onClick={handleRefreshAll}
            className="inline-flex shrink-0 items-center space-x-1.5 rounded-pill bg-surface-soft border border-hairline px-2.5 sm:px-3.5 py-1.5 text-xs font-medium text-ink-muted hover:bg-gray-200 hover:text-ink transition"
            title="อัปเดตข้อมูลล่าสุด"
          >
            <RefreshCw className="h-3.5 w-3.5 text-brand-blue" />
            <span className="hidden sm:inline">อัปเดตล่าสุด</span>
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

        {/* แดชบอร์ดสรุป 4 การ์ดสถิติ (Rollup Focus) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-card border border-hairline bg-white p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs text-ink-muted font-medium">แฟ้มคดีระดับบุคคลที่ต้องตรวจ</span>
            <div className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-bold text-status-error">
              {isDossiersLoading ? '...' : (summary?.actionableUserDossiersCount ?? 0)} บุคคล
            </div>
            <span className="text-[10px] sm:text-[11px] text-brand-blue font-medium block mt-1">
              ทำซ้ำสะสมหรือยอดเสี่ยงสูง
            </span>
          </div>

          <div className="rounded-card border border-hairline bg-white p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs text-amber-800 font-medium flex items-center space-x-1">
              <Store className="h-3.5 w-3.5 text-status-warning shrink-0" />
              <span className="truncate">ร้านค้าที่ถูกเฝ้าระวัง</span>
            </span>
            <div className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-bold text-status-warning">
              {isDossiersLoading ? '...' : (summary?.actionableMerchantDossiersCount ?? 0)} ร้านค้า
            </div>
            <span className="text-[10px] sm:text-[11px] text-ink-muted block mt-1">
              ส่อเจตนาซอยบิล/สมรู้ร่วมคิด
            </span>
          </div>

          <div className="rounded-card border border-emerald-200 bg-emerald-50/50 p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs text-emerald-800 font-medium flex items-center space-x-1">
              <Filter className="h-3.5 w-3.5 text-status-success shrink-0" />
              <span className="truncate">AI กรองสัญญาณรบกวน</span>
            </span>
            <div className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-bold text-status-success">
              {isDossiersLoading ? '...' : (summary?.suppressedNoiseCount ?? 0)} รายการ
            </div>
            <span className="text-[10px] sm:text-[11px] text-emerald-700 block mt-1">
              ตัดบิลย่อยครั้งเดียว ไม่ให้ Admin ล้า
            </span>
          </div>

          <div className="rounded-card border border-hairline bg-white p-3.5 sm:p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs text-ink-muted font-medium flex items-center space-x-1">
              <Cpu className="h-3.5 w-3.5 text-brand-blue shrink-0" />
              <span className="truncate">งบรัฐสมทบที่เสี่ยง (60%)</span>
            </span>
            <div className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-bold text-brand-blue">
              ฿{((summary?.totalGovernmentAtRisk ?? 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-ink-muted block mt-1">
              ยอดเงิน Co-pay จากบิลที่ถูก Flagged
            </span>
          </div>
        </div>

        {/* Tab Bar เลือกมุมมอง + ตัวกรองสัญญาณรบกวน */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-hairline rounded-2xl p-2.5 sm:p-3 shadow-2xs">
          <div className="inline-flex rounded-xl bg-surface-soft p-1 space-x-1">
            <button
              onClick={() => setActiveTab('USER_DOSSIERS')}
              className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'USER_DOSSIERS'
                  ? 'bg-white text-brand-blue shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>สรุปแฟ้มรายบุคคล ({userDossiers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('MERCHANT_DOSSIERS')}
              className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'MERCHANT_DOSSIERS'
                  ? 'bg-white text-brand-blue shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Store className="h-3.5 w-3.5" />
              <span>สรุปแฟ้มรายร้านค้า ({merchantDossiers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('RAW_ALERTS')}
              className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'RAW_ALERTS'
                  ? 'bg-white text-brand-blue shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <FileSearch className="h-3.5 w-3.5" />
              <span>ธุรกรรมรายบิล ({rawAlerts?.length ?? 0})</span>
            </button>
          </div>

          {activeTab !== 'RAW_ALERTS' && (
            <label className="flex items-center space-x-2 text-xs text-ink-muted cursor-pointer select-none px-2">
              <input
                type="checkbox"
                checked={includeNoise}
                onChange={(e) => setIncludeNoise(e.target.checked)}
                className="rounded text-brand-blue focus:ring-brand-blue"
              />
              <span>
                รวมธุรกรรมย่อยเดี่ยวๆ (แสดง {summary?.suppressedNoiseCount ?? 0} บิลที่ AI กรองออก)
              </span>
            </label>
          )}
        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* TAB 1: แฟ้มคดีระดับบุคคล (USER DOSSIERS)                                  */}
        {/* ------------------------------------------------------------------------- */}
        {activeTab === 'USER_DOSSIERS' && (
          <div className="space-y-4">
            {isDossiersLoading ? (
              <div className="bg-white rounded-card p-12 text-center text-xs text-ink-muted">
                กำลังรวบรวมแฟ้มคดีระดับบุคคลด้วย AI...
              </div>
            ) : userDossiers.length === 0 ? (
              <div className="bg-white rounded-card p-12 text-center border border-hairline">
                <CheckCircle2 className="h-12 w-12 text-status-success mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-ink">ไม่พบบุคคลที่เข้าข่ายพฤติกรรมน่าสงสัยสะสม</p>
                <p className="text-xs text-ink-muted mt-1">
                  ธุรกรรมย่อยทั้งหมดอยู่ในเกณฑ์ปกติ หรือได้รับการตรวจสอบเรียบร้อยแล้ว
                </p>
              </div>
            ) : (
              userDossiers.map((userDossier: UserFraudDossier) => {
                const isExpanded = expandedDossierId === userDossier.userId;
                const isAllMerchantsShown = expandedMerchantsUserId === userDossier.userId;
                const sortedMerchants = [...(userDossier.merchantsInvolved || [])].sort(
                  (a: any, b: any) => b.transactionCount - a.transactionCount
                );
                const visibleMerchants = isAllMerchantsShown ? sortedMerchants : sortedMerchants.slice(0, 2);
                const extraMerchantsCount = Math.max(0, sortedMerchants.length - 2);

                return (
                  <div
                    key={userDossier.userId}
                    className="rounded-card border border-hairline bg-white shadow-sm overflow-hidden transition"
                  >
                    {/* Header แฟ้มบุคคล */}
                    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-hairline/60">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm sm:text-base text-ink">
                            {userDossier.customerName}
                          </span>
                          <span className="text-[11px] font-mono bg-surface-soft border border-hairline px-2 py-0.5 rounded-pill text-ink-muted">
                            ID: {userDossier.userId.slice(0, 8)}...
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-pill ${
                              userDossier.walletStatus === 'SUSPENDED'
                                ? 'bg-red-100 text-status-error'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            กระเป๋า: {userDossier.walletStatus === 'SUSPENDED' ? 'ถูกระงับสิทธิ์' : 'ใช้งานปกติ'}
                          </span>
                          {!userDossier.isActionable && (
                            <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-pill">
                              ธุรกรรมย่อยเดี่ยว (Noise)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="inline-flex items-center space-x-1 rounded-pill bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold">
                            <AlertTriangle className="h-3 w-3" />
                            <span>{userDossier.primaryRiskPattern}</span>
                          </span>
                          <span className="text-xs text-ink-muted">
                            พบเหตุการณ์สะสม{' '}
                            <strong className="font-mono text-ink">{userDossier.flaggedCount}</strong> รายการ
                          </span>
                        </div>
                      </div>

                      {/* ยอดเงินรวมที่ส่อทุจริต */}
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-[11px] text-ink-muted">ยอดรวมที่ส่อทุจริต</div>
                          <div className="font-mono text-base sm:text-lg font-bold text-ink">
                            ฿{userDossier.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="border-l border-hairline pl-4">
                          <div className="text-[11px] text-status-error font-medium">เสี่ยงเงินรัฐ (60%)</div>
                          <div className="font-mono text-base sm:text-lg font-bold text-status-error">
                            ฿{userDossier.governmentCopayAtRisk.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Case Summary Box */}
                    <div className="bg-blue-50/50 border-b border-blue-100/60 p-3.5 sm:p-4 text-xs">
                      <div className="flex items-start space-x-2.5">
                        <div className="h-6 w-6 rounded-lg bg-blue-100 text-brand-blue flex items-center justify-center shrink-0 mt-0.5">
                          <Cpu className="h-3.5 w-3.5" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="font-bold text-brand-blue">
                            บทวิเคราะห์พฤติกรรมโดย AI (AI Case Dossier):
                          </span>
                          <p className="text-ink leading-relaxed font-sans">{userDossier.aiCaseSummary}</p>
                        </div>
                      </div>
                    </div>

                    {/* รายชื่อร้านค้าที่เกี่ยวข้อง & ปุ่ม Action Bar */}
                    <div className="p-3.5 sm:p-4 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-t border-hairline/60">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink min-w-0">
                        <span className="shrink-0 font-medium text-ink-muted flex items-center space-x-1 mr-1">
                          <Store className="h-3.5 w-3.5 text-brand-blue" />
                          <span>ร้านค้า ({sortedMerchants.length}):</span>
                        </span>
                        {visibleMerchants.map((m: any) => (
                          <span
                            key={m.merchantId}
                            title={`${m.shopName} (${m.transactionCount} บิล)`}
                            className="bg-surface-soft border border-hairline rounded-lg px-2 py-0.5 font-medium text-ink flex items-center space-x-1 shrink-0"
                          >
                            <span className="max-w-[140px] sm:max-w-[180px] truncate">{m.shopName}</span>
                            <span className="font-mono text-[10px] text-brand-blue font-bold">({m.transactionCount} บิล)</span>
                          </span>
                        ))}
                        {extraMerchantsCount > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedMerchantsUserId(
                                isAllMerchantsShown ? null : userDossier.userId
                              )
                            }
                            className="bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue border border-brand-blue/20 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition shrink-0"
                            title={
                              isAllMerchantsShown
                                ? 'คลิกเพื่อย่อแสดงเฉพาะร้านหลัก'
                                : sortedMerchants.slice(2).map((m: any) => `${m.shopName} (${m.transactionCount} บิล)`).join(', ')
                            }
                          >
                            {isAllMerchantsShown ? 'ย่อร้านค้า' : `+ อีก ${extraMerchantsCount} ร้าน`}
                          </button>
                        )}
                      </div>

                      {/* ปุ่ม Batch Actions ระดับบุคคลใน 1 คลิก */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-start lg:self-center">
                        <button
                          onClick={() => setExpandedDossierId(isExpanded ? null : userDossier.userId)}
                          className={`inline-flex items-center space-x-1.5 rounded-pill border px-3 py-1.5 text-xs font-semibold transition ${
                            isExpanded
                              ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/30 shadow-2xs'
                              : 'bg-surface-soft border-hairline text-ink hover:bg-gray-200'
                          }`}
                        >
                          <span>{isExpanded ? 'ซ่อนบิลย่อย' : `ดู ${userDossier.flaggedCount} บิลย่อย`}</span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>

                        <button
                          disabled={resolveDossierMutation.isPending}
                          onClick={() =>
                            resolveDossierMutation.mutate({
                              targetType: 'USER',
                              targetId: userDossier.userId,
                              action: 'APPROVE_ALL',
                              note: 'แอดมินตรวจสอบแล้วยืนยันให้ผ่านทุกรายการ',
                            })
                          }
                          className="inline-flex items-center space-x-1 rounded-pill bg-brand-blue text-white hover:bg-brand-blue-hover px-3 py-1.5 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          <span>อนุมัติทั้งหมด</span>
                        </button>

                        <button
                          disabled={resolveDossierMutation.isPending}
                          onClick={() =>
                            resolveDossierMutation.mutate({
                              targetType: 'USER',
                              targetId: userDossier.userId,
                              action: 'SUSPEND_USER',
                              note: 'แอดมินสั่งระงับสิทธิ Co-pay เนื่องจากพฤติกรรมทุจริตซ้ำซ้อน',
                            })
                          }
                          className="inline-flex items-center space-x-1 rounded-pill bg-red-50 text-status-error border border-red-200 hover:bg-red-100 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          <span>ระงับสิทธิประชาชน</span>
                        </button>
                      </div>
                    </div>

                    {/* รายการบิลย่อยที่ซ่อนอยู่ (Expandable Sub-transactions) */}
                    {isExpanded && (
                      <SubBillsViewer
                        transactions={userDossier.transactions}
                        type="USER"
                        onSelectAlert={setSelectedAlert}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* TAB 2: แฟ้มคดีระดับร้านค้า (MERCHANT DOSSIERS)                              */}
        {/* ------------------------------------------------------------------------- */}
        {activeTab === 'MERCHANT_DOSSIERS' && (
          <div className="space-y-4">
            {isDossiersLoading ? (
              <div className="bg-white rounded-card p-12 text-center text-xs text-ink-muted">
                กำลังรวบรวมแฟ้มคดีระดับร้านค้าด้วย AI...
              </div>
            ) : merchantDossiers.length === 0 ? (
              <div className="bg-white rounded-card p-12 text-center border border-hairline">
                <CheckCircle2 className="h-12 w-12 text-status-success mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-ink">ไม่พบร้านค้าที่มีพฤติกรรมต้องสงสัยสะสม</p>
                <p className="text-xs text-ink-muted mt-1">ร้านค้าทั้งหมดปฏิบัติตามมาตรฐานโครงการเรียบร้อยดี</p>
              </div>
            ) : (
              merchantDossiers.map((merchantDossier: MerchantFraudDossier) => {
                const isExpanded = expandedDossierId === merchantDossier.merchantId;
                return (
                  <div
                    key={merchantDossier.merchantId}
                    className="rounded-card border border-hairline bg-white shadow-sm overflow-hidden transition"
                  >
                    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-hairline/60">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm sm:text-base text-ink">
                            {merchantDossier.shopName}
                          </span>
                          <span className="text-[11px] font-mono bg-surface-soft border border-hairline px-2 py-0.5 rounded-pill text-ink-muted">
                            Tax ID: {merchantDossier.merchantTaxId}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-pill ${
                              merchantDossier.isMerchantApproved === false
                                ? 'bg-red-100 text-status-error'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            สถานะร้าน: {merchantDossier.isMerchantApproved === false ? 'ถูกระงับสิทธิ' : 'อนุมัติปกติ'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="inline-flex items-center space-x-1 rounded-pill bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-0.5 text-xs font-semibold">
                            <Store className="h-3 w-3" />
                            <span>{merchantDossier.primaryRiskPattern}</span>
                          </span>
                          <span className="text-xs text-ink-muted">
                            รับบิลต้องสงสัยสะสม{' '}
                            <strong className="font-mono text-ink">{merchantDossier.flaggedCount}</strong> บิล
                            (จากลูกค้า {merchantDossier.uniqueCustomersCount} ราย)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-[11px] text-ink-muted">ยอดขายที่ส่อทุจริต</div>
                          <div className="font-mono text-base sm:text-lg font-bold text-ink">
                            ฿{merchantDossier.totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="border-l border-hairline pl-4">
                          <div className="text-[11px] text-status-error font-medium">เงินรัฐสมทบ (60%)</div>
                          <div className="font-mono text-base sm:text-lg font-bold text-status-error">
                            ฿{merchantDossier.governmentCopayAtRisk.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50/50 border-b border-purple-100/60 p-3.5 sm:p-4 text-xs">
                      <div className="flex items-start space-x-2.5">
                        <div className="h-6 w-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Cpu className="h-3.5 w-3.5" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="font-bold text-purple-800">
                            บทวิเคราะห์พฤติกรรมร้านค้าโดย AI:
                          </span>
                          <p className="text-ink leading-relaxed font-sans">{merchantDossier.aiCaseSummary}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 sm:p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <span className="text-xs text-ink-muted">
                        การกระทำนี้จะมีผลต่อธุรกรรมที่ค้างอยู่ทั้งหมดของร้านค้านี้ทันที
                      </span>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          onClick={() => setExpandedDossierId(isExpanded ? null : merchantDossier.merchantId)}
                          className={`inline-flex items-center space-x-1.5 rounded-pill border px-3 py-1.5 text-xs font-semibold transition ${
                            isExpanded
                              ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/30 shadow-2xs'
                              : 'bg-surface-soft border-hairline text-ink hover:bg-gray-200'
                          }`}
                        >
                          <span>{isExpanded ? 'ซ่อนบิลย่อย' : `ดู ${merchantDossier.flaggedCount} บิลย่อย`}</span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>

                        <button
                          disabled={resolveDossierMutation.isPending}
                          onClick={() =>
                            resolveDossierMutation.mutate({
                              targetType: 'MERCHANT',
                              targetId: merchantDossier.merchantId,
                              action: 'APPROVE_ALL',
                              note: 'แอดมินยืนยันรายการร้านค้าปกติ',
                            })
                          }
                          className="inline-flex items-center space-x-1 rounded-pill bg-brand-blue text-white hover:bg-brand-blue-hover px-3 py-1.5 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          <span>อนุมัติทั้งหมด</span>
                        </button>

                        <button
                          disabled={resolveDossierMutation.isPending}
                          onClick={() =>
                            resolveDossierMutation.mutate({
                              targetType: 'MERCHANT',
                              targetId: merchantDossier.merchantId,
                              action: 'SUSPEND_MERCHANT',
                              note: 'แอดมินสั่งระงับสิทธิร้านค้าเพื่อเข้าตรวจสอบหน้าร้าน',
                            })
                          }
                          className="inline-flex items-center space-x-1 rounded-pill bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                        >
                          <Store className="h-3.5 w-3.5" />
                          <span>ระงับสิทธิร้านค้า</span>
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <SubBillsViewer
                        transactions={merchantDossier.transactions}
                        type="MERCHANT"
                        onSelectAlert={setSelectedAlert}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ------------------------------------------------------------------------- */}
        {/* TAB 3: รายการธุรกรรมรายบิล (RAW TRANSACTIONS)                               */}
        {/* ------------------------------------------------------------------------- */}
        {activeTab === 'RAW_ALERTS' && (
          <div className="rounded-card border border-hairline bg-white p-4 sm:p-5 md:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
              <h3 className="text-sm sm:text-base font-bold text-ink">รายการธุรกรรมรายบิลทั้งหมด</h3>
              <span className="text-[11px] sm:text-xs text-ink-muted">
                ตรวจสอบพิกัดและรายละเอียดระดับรายธุรกรรม
              </span>
            </div>

            {isAlertsLoading ? (
              <div className="py-12 text-center text-xs text-ink-muted">กำลังดึงข้อมูล...</div>
            ) : !rawAlerts || rawAlerts.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-status-success mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-ink">ไม่มีรายการทุจริตค้างในระบบ</p>
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {rawAlerts.map((alertItem: FraudAlertItem) => {
                  const txDate = alertItem.transactionCreatedAt || alertItem.createdAt;
                  return (
                    <div
                      key={alertItem.fraudCheckId}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-ink flex flex-wrap items-center gap-2">
                          <span>{alertItem.customerName}</span>
                          <span className="text-ink-muted font-normal text-[11px]">→ ร้าน {alertItem.shopName}</span>
                          {renderTransactionStatusBadge(alertItem.transactionStatus, alertItem.decision)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded-pill bg-amber-50 text-status-warning border border-amber-200 px-2 py-0.5 font-mono">
                            ห่าง {formatDistance(alertItem.distanceMeters)}
                          </span>
                          <span className="text-ink-muted">{alertItem.fraudReason}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 shrink-0">
                        <div className="text-right">
                          <div className="font-mono font-bold text-ink">฿{alertItem.totalAmount.toFixed(2)}</div>
                          <div className="font-mono text-[10px] text-ink-muted flex items-center justify-end space-x-1">
                            <Clock className="h-3 w-3 text-ink-muted" />
                            <span>{formatThaiDateTime(txDate)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedAlert(alertItem)}
                          className="inline-flex items-center space-x-1 rounded-pill bg-brand-blue text-white px-3 py-1.5 text-xs font-semibold shadow-2xs hover:bg-brand-blue-hover transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>จัดการ</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL: แผนที่พิกัดจริง OSM และจัดการรายการเดี่ยว */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto font-sans">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-xl bg-amber-50 text-status-warning flex items-center justify-center border border-amber-200">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-ink">
                    รายละเอียดพิกัดและตรวจสอบธุรกรรม
                  </h3>
                  <span className="text-[11px] font-mono text-ink-muted">
                    TxID: {selectedAlert.transactionId}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAlert(null)}
                className="rounded-full p-1.5 text-ink-muted hover:bg-surface-soft hover:text-ink transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-surface-soft p-3 sm:p-4 rounded-2xl border border-hairline">
                <div>
                  <span className="text-ink-muted block text-[10px]">ผู้ซื้อ</span>
                  <span className="font-bold text-ink truncate block">{selectedAlert.customerName}</span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px]">ร้านค้า</span>
                  <span className="font-bold text-ink truncate block">{selectedAlert.shopName}</span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px]">ยอดรวม Co-pay</span>
                  <span className="font-mono font-bold text-ink">฿{selectedAlert.totalAmount.toFixed(2)}</span>
                  <span className="font-mono text-[10px] text-status-error block">
                    (รัฐ 60%: ฿{selectedAlert.copayAmount.toFixed(2)})
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px]">วัน-เวลาที่ทำรายการ</span>
                  <span className="font-semibold text-ink flex items-center space-x-1 pt-0.5 font-mono text-[11px]">
                    <Calendar className="h-3 w-3 text-brand-blue shrink-0" />
                    <span>
                      {formatThaiDateTime(selectedAlert.transactionCreatedAt || selectedAlert.createdAt)}
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px]">สถานะการชำระเงิน</span>
                  <div className="pt-0.5">
                    {renderTransactionStatusBadge(selectedAlert.transactionStatus, selectedAlert.decision)}
                  </div>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px]">ระยะห่างระหว่างพิกัด</span>
                  <span className="font-mono font-semibold text-ink block pt-0.5">
                    {formatDistance(selectedAlert.distanceMeters)}
                  </span>
                </div>
              </div>

              {/* แผนที่จำลองพิกัดจริงด้วย OpenStreetMap */}
              <div>
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <span className="text-[11px] font-semibold text-ink flex items-center space-x-1.5">
                    <MapPin className="h-3.5 w-3.5 text-brand-blue" />
                    <span>แผนที่พิกัดจริงเปรียบเทียบตำแหน่งร้านค้าและผู้ซื้อ (OpenStreetMap)</span>
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-pill px-2 py-0.2 font-medium">
                    ● Real-Time OSM
                  </span>
                </div>
                <FraudLocationMap
                  userLat={selectedAlert.userLat}
                  userLon={selectedAlert.userLon}
                  merchantLat={selectedAlert.merchantLat}
                  merchantLon={selectedAlert.merchantLon}
                  customerName={selectedAlert.customerName}
                  shopName={selectedAlert.shopName}
                  distanceMeters={selectedAlert.distanceMeters}
                />
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                <span className="font-semibold text-brand-blue block">คำอธิบายจากระบบ AI:</span>
                <p className="mt-1 text-ink leading-relaxed">{selectedAlert.fraudReason}</p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-ink-muted mb-1">
                  บันทึกผลการตรวจสอบ
                </label>
                <input
                  type="text"
                  placeholder="ระบุข้อสังเกตหรือผลการตรวจสอบ เช่น รอเอกสารเพิ่มเติม / ตรวจสอบแล้วถูกต้อง"
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
                className="inline-flex items-center justify-center space-x-1.5 rounded-pill bg-brand-blue text-white hover:bg-brand-blue-hover px-4 py-2.5 text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>ยืนยันรายการปกติ</span>
              </button>

              <button
                disabled={resolveMutation.isPending}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedAlert.fraudCheckId,
                    action: 'REJECT',
                    note: resolveNote || 'ส่งเรื่องตรวจสอบเพิ่มเติม',
                  })
                }
                className="inline-flex items-center justify-center space-x-1.5 rounded-pill bg-slate-100 text-ink hover:bg-slate-200 px-4 py-2.5 text-xs font-semibold border border-hairline transition disabled:opacity-50"
              >
                <FileSearch className="h-4 w-4 shrink-0" />
                <span>ส่งตรวจสอบเพิ่มเติม</span>
              </button>

              <button
                disabled={resolveMutation.isPending}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedAlert.fraudCheckId,
                    action: 'SUSPEND_MERCHANT',
                    note: resolveNote || 'ระงับสิทธิร้านค้าชั่วคราวเพื่อตรวจสอบ',
                  })
                }
                className="inline-flex items-center justify-center space-x-1.5 rounded-pill bg-amber-50 text-amber-800 hover:bg-amber-100 px-4 py-2.5 text-xs font-semibold border border-amber-200 transition disabled:opacity-50"
              >
                <Store className="h-4 w-4 shrink-0" />
                <span>ระงับสิทธิร้านค้า</span>
              </button>

              <button
                disabled={resolveMutation.isPending}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedAlert.fraudCheckId,
                    action: 'SUSPEND_USER',
                    note: resolveNote || 'ระงับสิทธิการใช้จ่ายของประชาชนชั่วคราว',
                  })
                }
                className="inline-flex items-center justify-center space-x-1.5 rounded-pill bg-red-50 text-status-error hover:bg-red-100 px-4 py-2.5 text-xs font-semibold border border-red-200 transition disabled:opacity-50"
              >
                <UserX className="h-4 w-4 shrink-0" />
                <span>ระงับสิทธิประชาชน</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
