import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  X,
  Store,
  UserX,
  FileSearch,
  Users,
  CheckCheck,
  Search,
  CircleDollarSign,
  ShieldCheck,
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

type TabId = 'USER_DOSSIERS' | 'MERCHANT_DOSSIERS' | 'RAW_ALERTS';

export const AdminFraudAlertsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('USER_DOSSIERS');
  const [search, setSearch] = useState<string>('');
  const [includeNoise, setIncludeNoise] = useState<boolean>(false);

  const [selectedUserDossier, setSelectedUserDossier] = useState<UserFraudDossier | null>(null);
  const [selectedMerchantDossier, setSelectedMerchantDossier] = useState<MerchantFraudDossier | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlertItem | null>(null);
  const [resolveNote, setResolveNote] = useState<string>('');
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    data: dossiersData,
    isLoading: isDossiersLoading,
    refetch: refetchDossiers,
  } = useQuery({
    queryKey: ['fraud-dossiers', includeNoise],
    queryFn: () => getFraudDossiers(includeNoise),
    refetchInterval: 15000,
  });

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
    APPROVE: 'อนุมัติรายการปกติเรียบร้อยแล้ว',
    REJECT: 'ส่งเรื่องตรวจสอบเพิ่มเติมเรียบร้อยแล้ว',
    SUSPEND_MERCHANT: 'ระงับสิทธิ์ร้านค้าชั่วคราวเรียบร้อยแล้ว',
    SUSPEND_USER: 'ระงับสิทธิ์ประชาชนชั่วคราวเรียบร้อยแล้ว',
  };

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
      setTimeout(() => setActionFeedback(null), 4000);
    },
    onError: (err: any) => {
      setActionFeedback({
        type: 'error',
        text: err.response?.data?.message || err.message || 'ไม่สามารถบันทึกผลการตรวจสอบได้',
      });
    },
  });

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
        APPROVE_ALL: 'อนุมัติทุกรายการเรียบร้อยแล้ว',
        REJECT_ALL: 'ปฏิเสธทุกรายการเรียบร้อยแล้ว',
        SUSPEND_USER: 'ระงับสิทธิ์ประชาชนเรียบร้อยแล้ว',
        SUSPEND_MERCHANT: 'ระงับสิทธิ์ร้านค้าเรียบร้อยแล้ว',
      };
      setActionFeedback({
        type: 'success',
        text: `${actionLabels[vars.action]} (${res.resolvedCount} รายการ)`,
      });
      setSelectedUserDossier(null);
      setSelectedMerchantDossier(null);
      setResolveNote('');
      setTimeout(() => setActionFeedback(null), 4000);
    },
    onError: (err: any) => {
      setActionFeedback({
        type: 'error',
        text: err.response?.data?.message || err.message || 'ไม่สามารถจัดการรายการได้',
      });
    },
  });

  const formatDistance = (meters: number) =>
    meters >= 1000 ? `${(meters / 1000).toFixed(1)} กม.` : `${Math.round(meters)} ม.`;

  const formatBaht = (val: number) =>
    `฿${val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const summary = dossiersData?.summary;
  const userDossiers = dossiersData?.userDossiers || [];
  const merchantDossiers = dossiersData?.merchantDossiers || [];
  const alertsList = rawAlerts || [];

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return userDossiers;
    return userDossiers.filter(
      (u) =>
        u.customerName.toLowerCase().includes(q) ||
        u.primaryRiskPattern.toLowerCase().includes(q) ||
        u.merchantsInvolved.some((m) => m.shopName.toLowerCase().includes(q))
    );
  }, [userDossiers, search]);

  const filteredMerchants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return merchantDossiers;
    return merchantDossiers.filter(
      (m) =>
        m.shopName.toLowerCase().includes(q) ||
        m.merchantTaxId.toLowerCase().includes(q) ||
        m.primaryRiskPattern.toLowerCase().includes(q)
    );
  }, [merchantDossiers, search]);

  const filteredAlerts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alertsList;
    return alertsList.filter(
      (a) =>
        a.customerName.toLowerCase().includes(q) ||
        a.shopName.toLowerCase().includes(q) ||
        a.fraudReason.toLowerCase().includes(q)
    );
  }, [alertsList, search]);

  return (
    <div className="min-h-[calc(100vh-65px)] bg-surface-soft pb-16 font-sans text-ink">
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8 space-y-6">
        {/* Header เรียบง่าย ชัดเจน */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
              ตรวจสอบรายการต้องสงสัย
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-ink-muted">
              จัดการบุคคล ร้านค้า และบิลที่ระบบ AI ตรวจพบความผิดปกติในหน้าเดียว
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefreshAll}
            className="inline-flex items-center justify-center gap-2 self-start sm:self-auto rounded-pill border border-hairline bg-white px-4 py-2 text-xs font-semibold text-ink hover:bg-gray-50 shadow-2xs transition"
          >
            <RefreshCw className="h-3.5 w-3.5 text-brand-blue" />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>

        {/* แจ้งเตือนผลการดำเนินการ */}
        {actionFeedback && (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs ${
              actionFeedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-status-error'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-status-error shrink-0" />
              )}
              <span>{actionFeedback.text}</span>
            </div>
            <button onClick={() => setActionFeedback(null)} className="p-1 text-ink-muted hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* สรุปตัวเลขสำคัญ 3 การ์ดที่เข้าใจง่าย */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <button
            type="button"
            onClick={() => setActiveTab('USER_DOSSIERS')}
            className={`text-left rounded-2xl border p-4 transition shadow-2xs flex items-center justify-between ${
              activeTab === 'USER_DOSSIERS'
                ? 'border-brand-blue bg-blue-50/40 ring-2 ring-blue-100'
                : 'border-hairline bg-white hover:border-slate-300'
            }`}
          >
            <div>
              <span className="text-xs font-semibold text-ink-muted">ประชาชนที่ต้องตรวจสอบ</span>
              <div className="mt-1 font-mono text-2xl font-bold text-ink">
                {isDossiersLoading ? '...' : `${userDossiers.length} คน`}
              </div>
              <span className="mt-1 block text-[11px] text-ink-muted">คลิกเพื่อดูรายชื่อประชาชน</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-red-50 text-status-error flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MERCHANT_DOSSIERS')}
            className={`text-left rounded-2xl border p-4 transition shadow-2xs flex items-center justify-between ${
              activeTab === 'MERCHANT_DOSSIERS'
                ? 'border-brand-blue bg-blue-50/40 ring-2 ring-blue-100'
                : 'border-hairline bg-white hover:border-slate-300'
            }`}
          >
            <div>
              <span className="text-xs font-semibold text-ink-muted">ร้านค้าที่ต้องตรวจสอบ</span>
              <div className="mt-1 font-mono text-2xl font-bold text-ink">
                {isDossiersLoading ? '...' : `${merchantDossiers.length} ร้าน`}
              </div>
              <span className="mt-1 block text-[11px] text-ink-muted">คลิกเพื่อดูรายชื่อร้านค้า</span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-status-warning flex items-center justify-center shrink-0">
              <Store className="h-5 w-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RAW_ALERTS')}
            className={`text-left rounded-2xl border p-4 transition shadow-2xs flex items-center justify-between ${
              activeTab === 'RAW_ALERTS'
                ? 'border-brand-blue bg-blue-50/40 ring-2 ring-blue-100'
                : 'border-hairline bg-white hover:border-slate-300'
            }`}
          >
            <div>
              <span className="text-xs font-semibold text-ink-muted">เงินรัฐสมทบที่รอตรวจสอบ</span>
              <div className="mt-1 font-mono text-2xl font-bold text-brand-blue">
                {formatBaht(summary?.totalGovernmentAtRisk ?? 0)}
              </div>
              <span className="mt-1 block text-[11px] text-ink-muted">
                จากทั้งหมด {alertsList.length} บิลที่ถูกตั้งข้อสงสัย
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center shrink-0">
              <CircleDollarSign className="h-5 w-5" />
            </div>
          </button>
        </div>

        {/* กล่องตารางหลัก */}
        <section className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xs">
          {/* แถบเลือกหมวดหมู่ + ค้นหา */}
          <div className="border-b border-hairline px-4 pt-3 pb-3 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex w-full md:w-auto max-w-full overflow-x-auto no-scrollbar rounded-xl bg-surface-soft p-1 gap-1 self-start">
              <button
                type="button"
                onClick={() => setActiveTab('USER_DOSSIERS')}
                className={`flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 py-2 text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                  activeTab === 'USER_DOSSIERS'
                    ? 'bg-white text-brand-blue shadow-2xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>รายชื่อประชาชน ({userDossiers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('MERCHANT_DOSSIERS')}
                className={`flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 py-2 text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                  activeTab === 'MERCHANT_DOSSIERS'
                    ? 'bg-white text-brand-blue shadow-2xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <Store className="h-3.5 w-3.5 shrink-0" />
                <span>รายชื่อร้านค้า ({merchantDossiers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('RAW_ALERTS')}
                className={`flex items-center gap-1.5 rounded-lg px-3 sm:px-3.5 py-2 text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                  activeTab === 'RAW_ALERTS'
                    ? 'bg-white text-brand-blue shadow-2xs'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                <FileSearch className="h-3.5 w-3.5 shrink-0" />
                <span>ดูรายบิล ({alertsList.length})</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeTab !== 'RAW_ALERTS' && (summary?.suppressedNoiseCount ?? 0) > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-ink-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeNoise}
                    onChange={(e) => setIncludeNoise(e.target.checked)}
                    className="rounded text-brand-blue focus:ring-brand-blue"
                  />
                  <span>แสดงเคสย่อย ({summary?.suppressedNoiseCount})</span>
                </label>
              )}

              <div className="relative w-full sm:w-60">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาชื่อลูกค้า หรือร้านค้า..."
                  className="w-full rounded-pill border border-hairline bg-surface-soft/50 py-1.5 pl-8 pr-3 text-xs text-ink outline-none focus:border-brand-blue focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* เนื้อหาตารางตามแท็บ */}
          <div className="p-0">
            {/* TAB 1: ประชาชน */}
            {activeTab === 'USER_DOSSIERS' && (
              <>
                {isDossiersLoading ? (
                  <div className="py-16 text-center text-xs text-ink-muted">กำลังโหลดข้อมูล...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-16 text-center">
                    <ShieldCheck className="h-10 w-10 text-status-success mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-semibold text-ink">ไม่มีรายชื่อประชาชนที่ต้องตรวจสอบ</p>
                    <p className="text-xs text-ink-muted mt-0.5">ทุกรายการอยู่ในเกณฑ์ปกติ</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left border-collapse">
                      <thead>
                        <tr className="border-b border-hairline bg-surface-soft/60 text-[11px] font-semibold text-ink-muted">
                          <th className="py-3 pl-5 pr-3">ชื่อประชาชน</th>
                          <th className="py-3 px-3">สาเหตุที่ต้องสงสัย</th>
                          <th className="py-3 px-3">ร้านค้าที่เกี่ยวข้อง</th>
                          <th className="py-3 px-3 text-right">เงินรัฐที่เสี่ยง (ยอดรวม)</th>
                          <th className="py-3 pl-3 pr-5 text-right">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline text-xs">
                        {filteredUsers.map((u) => (
                          <tr key={u.userId} className="hover:bg-surface-soft/40 transition">
                            <td className="py-3.5 pl-5 pr-3 align-middle">
                              <div className="font-bold text-sm text-ink">{u.customerName}</div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span
                                  className={`inline-block h-2 w-2 rounded-full ${
                                    u.walletStatus === 'SUSPENDED' ? 'bg-status-error' : 'bg-status-success'
                                  }`}
                                />
                                <span className="text-[11px] text-ink-muted">
                                  {u.walletStatus === 'SUSPENDED' ? 'ระงับสิทธิ์แล้ว' : 'สถานะปกติ'}
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-3 align-middle max-w-[260px]">
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span>{u.primaryRiskPattern}</span>
                              </span>
                              <p className="mt-1 text-[11px] text-ink-muted line-clamp-1" title={u.aiCaseSummary}>
                                พบ {u.flaggedCount} บิลผิดปกติ
                              </p>
                            </td>

                            <td className="py-3.5 px-3 align-middle">
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {u.merchantsInvolved.map((m) => (
                                  <span
                                    key={m.merchantId}
                                    className="inline-flex items-center gap-1 rounded-md bg-surface-soft border border-hairline px-2 py-0.5 text-[11px] text-ink"
                                  >
                                    <span className="truncate max-w-[130px]">{m.shopName}</span>
                                    <span className="text-brand-blue font-mono font-semibold">({m.transactionCount})</span>
                                  </span>
                                ))}
                              </div>
                            </td>

                            <td className="py-3.5 px-3 align-middle text-right font-mono">
                              <div className="text-sm font-bold text-status-error">
                                {formatBaht(u.governmentCopayAtRisk)}
                              </div>
                              <div className="text-[11px] text-ink-muted">
                                จากยอดรวม {formatBaht(u.totalAmount)}
                              </div>
                            </td>

                            <td className="py-3.5 pl-3 pr-5 align-middle text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedUserDossier(u)}
                                  className="rounded-pill border border-hairline bg-white hover:bg-surface-soft px-3 py-1.5 text-xs font-semibold text-ink transition"
                                >
                                  ดูรายละเอียด ({u.flaggedCount})
                                </button>
                                <button
                                  type="button"
                                  disabled={resolveDossierMutation.isPending}
                                  onClick={() =>
                                    resolveDossierMutation.mutate({
                                      targetType: 'USER',
                                      targetId: u.userId,
                                      action: 'APPROVE_ALL',
                                      note: 'แอดมินตรวจสอบแล้วยืนยันให้ผ่านทุกรายการ',
                                    })
                                  }
                                  className="rounded-pill bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                                >
                                  อนุมัติผ่าน
                                </button>
                                <button
                                  type="button"
                                  disabled={resolveDossierMutation.isPending}
                                  onClick={() =>
                                    resolveDossierMutation.mutate({
                                      targetType: 'USER',
                                      targetId: u.userId,
                                      action: 'SUSPEND_USER',
                                      note: 'ระงับสิทธิ์เนื่องจากพบพฤติกรรมต้องสงสัยซ้ำซ้อน',
                                    })
                                  }
                                  className="rounded-pill border border-red-200 bg-red-50 text-status-error hover:bg-red-100 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                                >
                                  ระงับสิทธิ์
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: ร้านค้า */}
            {activeTab === 'MERCHANT_DOSSIERS' && (
              <>
                {isDossiersLoading ? (
                  <div className="py-16 text-center text-xs text-ink-muted">กำลังโหลดข้อมูล...</div>
                ) : filteredMerchants.length === 0 ? (
                  <div className="py-16 text-center">
                    <ShieldCheck className="h-10 w-10 text-status-success mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-semibold text-ink">ไม่มีร้านค้าที่ต้องตรวจสอบ</p>
                    <p className="text-xs text-ink-muted mt-0.5">ร้านค้าทั้งหมดอยู่ในเกณฑ์ปกติ</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left border-collapse">
                      <thead>
                        <tr className="border-b border-hairline bg-surface-soft/60 text-[11px] font-semibold text-ink-muted">
                          <th className="py-3 pl-5 pr-3">ชื่อร้านค้า</th>
                          <th className="py-3 px-3">พฤติกรรมที่ตรวจพบ</th>
                          <th className="py-3 px-3">จำนวนบิลต้องสงสัย</th>
                          <th className="py-3 px-3 text-right">เงินรัฐที่เสี่ยง (ยอดรวม)</th>
                          <th className="py-3 pl-3 pr-5 text-right">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline text-xs">
                        {filteredMerchants.map((m) => (
                          <tr key={m.merchantId} className="hover:bg-surface-soft/40 transition">
                            <td className="py-3.5 pl-5 pr-3 align-middle">
                              <div className="font-bold text-sm text-ink">{m.shopName}</div>
                              <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
                                <span
                                  className={`inline-block h-2 w-2 rounded-full ${
                                    m.isMerchantApproved === false ? 'bg-status-error' : 'bg-status-success'
                                  }`}
                                />
                                <span>{m.isMerchantApproved === false ? 'ระงับสิทธิ์แล้ว' : 'เปิดรับชำระปกติ'}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-3 align-middle max-w-[260px]">
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                                <Store className="h-3 w-3 shrink-0" />
                                <span>{m.primaryRiskPattern}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-3 align-middle">
                              <div className="font-semibold text-ink">{m.flaggedCount} บิล</div>
                              <div className="text-[11px] text-ink-muted">จากลูกค้า {m.uniqueCustomersCount} คน</div>
                            </td>

                            <td className="py-3.5 px-3 align-middle text-right font-mono">
                              <div className="text-sm font-bold text-status-error">
                                {formatBaht(m.governmentCopayAtRisk)}
                              </div>
                              <div className="text-[11px] text-ink-muted">
                                จากยอดขาย {formatBaht(m.totalAmount)}
                              </div>
                            </td>

                            <td className="py-3.5 pl-3 pr-5 align-middle text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedMerchantDossier(m)}
                                  className="rounded-pill border border-hairline bg-white hover:bg-surface-soft px-3 py-1.5 text-xs font-semibold text-ink transition"
                                >
                                  ดูรายละเอียด ({m.flaggedCount})
                                </button>
                                <button
                                  type="button"
                                  disabled={resolveDossierMutation.isPending}
                                  onClick={() =>
                                    resolveDossierMutation.mutate({
                                      targetType: 'MERCHANT',
                                      targetId: m.merchantId,
                                      action: 'APPROVE_ALL',
                                      note: 'แอดมินยืนยันรายการร้านค้าปกติ',
                                    })
                                  }
                                  className="rounded-pill bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                                >
                                  อนุมัติผ่าน
                                </button>
                                <button
                                  type="button"
                                  disabled={resolveDossierMutation.isPending}
                                  onClick={() =>
                                    resolveDossierMutation.mutate({
                                      targetType: 'MERCHANT',
                                      targetId: m.merchantId,
                                      action: 'SUSPEND_MERCHANT',
                                      note: 'ระงับสิทธิ์ร้านค้าชั่วคราวเพื่อตรวจสอบ',
                                    })
                                  }
                                  className="rounded-pill border border-red-200 bg-red-50 text-status-error hover:bg-red-100 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                                >
                                  ระงับร้านค้า
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* TAB 3: รายบิล */}
            {activeTab === 'RAW_ALERTS' && (
              <>
                {isAlertsLoading ? (
                  <div className="py-16 text-center text-xs text-ink-muted">กำลังโหลดข้อมูล...</div>
                ) : filteredAlerts.length === 0 ? (
                  <div className="py-16 text-center">
                    <ShieldCheck className="h-10 w-10 text-status-success mx-auto mb-2 opacity-80" />
                    <p className="text-sm font-semibold text-ink">ไม่มีรายการบิลค้างตรวจสอบ</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left border-collapse">
                      <thead>
                        <tr className="border-b border-hairline bg-surface-soft/60 text-[11px] font-semibold text-ink-muted">
                          <th className="py-3 pl-5 pr-3">ผู้ซื้อ → ร้านค้า</th>
                          <th className="py-3 px-3">ระยะห่าง GPS</th>
                          <th className="py-3 px-3">สาเหตุที่ตรวจพบ</th>
                          <th className="py-3 px-3 text-right">ยอดเงินรวม (รัฐสมทบ)</th>
                          <th className="py-3 pl-3 pr-5 text-right">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline text-xs">
                        {filteredAlerts.map((item) => (
                          <tr key={item.fraudCheckId} className="hover:bg-surface-soft/40 transition">
                            <td className="py-3.5 pl-5 pr-3 align-middle">
                              <div className="font-bold text-ink">{item.customerName}</div>
                              <div className="text-[11px] text-ink-muted mt-0.5">ร้าน {item.shopName}</div>
                            </td>
                            <td className="py-3.5 px-3 align-middle">
                              <span className="inline-flex items-center gap-1 rounded-pill bg-amber-50 border border-amber-200 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-800">
                                <MapPin className="h-3 w-3" />
                                {formatDistance(item.distanceMeters)}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 align-middle max-w-[280px]">
                              <p className="text-ink line-clamp-2">{item.fraudReason}</p>
                            </td>
                            <td className="py-3.5 px-3 align-middle text-right font-mono">
                              <div className="font-bold text-ink">{formatBaht(item.totalAmount)}</div>
                              <div className="text-[11px] text-status-error">รัฐ {formatBaht(item.copayAmount)}</div>
                            </td>
                            <td className="py-3.5 pl-3 pr-5 align-middle text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedAlert(item)}
                                  className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-white hover:bg-surface-soft px-3 py-1.5 text-xs font-semibold text-ink transition"
                                >
                                  <MapPin className="h-3.5 w-3.5 text-brand-blue" />
                                  <span>ดูแผนที่ / จัดการ</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={resolveMutation.isPending}
                                  onClick={() =>
                                    resolveMutation.mutate({
                                      id: item.fraudCheckId,
                                      action: 'APPROVE',
                                      note: 'แอดมินอนุมัติรายการปกติ',
                                    })
                                  }
                                  className="rounded-pill bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                                >
                                  อนุมัติ
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* MODAL 1: ดูรายละเอียดแฟ้มประชาชนหรือร้านค้า */}
      {(selectedUserDossier || selectedMerchantDossier) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-hairline pb-3">
              <div>
                <span className="text-[11px] font-semibold text-brand-blue uppercase">
                  {selectedUserDossier ? 'สรุปพฤติกรรมรายบุคคล' : 'สรุปพฤติกรรมร้านค้า'}
                </span>
                <h3 className="text-lg font-bold text-ink mt-0.5">
                  {selectedUserDossier ? selectedUserDossier.customerName : selectedMerchantDossier?.shopName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedUserDossier(null);
                  setSelectedMerchantDossier(null);
                }}
                className="rounded-full p-1.5 text-ink-muted hover:bg-surface-soft hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* กล่องสรุป AI อ่านง่าย */}
            <div className="rounded-2xl bg-blue-50/70 border border-blue-100 p-4 text-xs space-y-1.5">
              <div className="font-bold text-brand-blue">
                สาเหตุที่ระบบตรวจพบ: {selectedUserDossier?.primaryRiskPattern || selectedMerchantDossier?.primaryRiskPattern}
              </div>
              <p className="text-ink leading-relaxed">
                {selectedUserDossier?.aiCaseSummary || selectedMerchantDossier?.aiCaseSummary}
              </p>
            </div>

            {/* รายการบิลย่อย */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-ink">
                รายการบิลที่เกี่ยวข้อง ({selectedUserDossier?.flaggedCount || selectedMerchantDossier?.flaggedCount} บิล)
              </h4>
              <div className="divide-y divide-hairline rounded-2xl border border-hairline overflow-hidden">
                {(selectedUserDossier?.transactions || selectedMerchantDossier?.transactions || []).map((tx) => (
                  <div
                    key={tx.fraudCheckId}
                    className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold text-ink">
                        {selectedUserDossier ? `ร้าน ${tx.shopName}` : `ลูกค้า: ${tx.customerName}`}
                        <span className="ml-2 font-mono text-[11px] text-amber-700">
                          (ห่าง {formatDistance(tx.distanceMeters)})
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-muted mt-0.5">{tx.fraudReason}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right font-mono">
                        <div className="font-bold text-ink">{formatBaht(tx.totalAmount)}</div>
                        <div className="text-[10px] text-status-error">รัฐ {formatBaht(tx.copayAmount)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedAlert(tx)}
                        className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-surface-soft hover:bg-gray-200 px-2.5 py-1 text-[11px] font-semibold text-ink"
                      >
                        <Eye className="h-3 w-3 text-brand-blue" />
                        <span>ดูแผนที่</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ปุ่มตัดสินใจด้านล่าง Modal */}
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline pt-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedUserDossier(null);
                  setSelectedMerchantDossier(null);
                }}
                className="rounded-pill border border-hairline px-4 py-2 text-xs font-semibold text-ink-muted hover:text-ink"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                disabled={resolveDossierMutation.isPending}
                onClick={() => {
                  if (selectedUserDossier) {
                    resolveDossierMutation.mutate({
                      targetType: 'USER',
                      targetId: selectedUserDossier.userId,
                      action: 'APPROVE_ALL',
                      note: 'แอดมินตรวจสอบแล้วยืนยันให้ผ่านทุกรายการ',
                    });
                  } else if (selectedMerchantDossier) {
                    resolveDossierMutation.mutate({
                      targetType: 'MERCHANT',
                      targetId: selectedMerchantDossier.merchantId,
                      action: 'APPROVE_ALL',
                      note: 'แอดมินยืนยันรายการร้านค้าปกติ',
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-pill bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 text-xs font-semibold"
              >
                <CheckCheck className="h-4 w-4" />
                <span>อนุมัติผ่านทั้งหมด</span>
              </button>
              <button
                type="button"
                disabled={resolveDossierMutation.isPending}
                onClick={() => {
                  if (selectedUserDossier) {
                    resolveDossierMutation.mutate({
                      targetType: 'USER',
                      targetId: selectedUserDossier.userId,
                      action: 'SUSPEND_USER',
                      note: 'แอดมินสั่งระงับสิทธิ์ Co-pay',
                    });
                  } else if (selectedMerchantDossier) {
                    resolveDossierMutation.mutate({
                      targetType: 'MERCHANT',
                      targetId: selectedMerchantDossier.merchantId,
                      action: 'SUSPEND_MERCHANT',
                      note: 'แอดมินสั่งระงับสิทธิ์ร้านค้า',
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-pill bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-xs font-semibold"
              >
                <UserX className="h-4 w-4" />
                <span>{selectedUserDossier ? 'ระงับสิทธิ์ประชาชน' : 'ระงับสิทธิ์ร้านค้า'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: แผนที่พิกัดจริง OSM สำหรับบิลเดี่ยว */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-50 text-status-warning flex items-center justify-center border border-amber-200">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink">ตรวจสอบพิกัดธุรกรรม</h3>
                  <span className="text-[11px] text-ink-muted">
                    ผู้ซื้อ: {selectedAlert.customerName} • ร้าน: {selectedAlert.shopName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="rounded-full p-1.5 text-ink-muted hover:bg-surface-soft hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2 bg-surface-soft p-3 rounded-2xl">
                <div>
                  <span className="text-ink-muted block text-[10px]">ระยะห่าง GPS</span>
                  <span className="font-mono font-bold text-amber-700">
                    {formatDistance(selectedAlert.distanceMeters)}
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px]">ยอดรวม</span>
                  <span className="font-mono font-bold text-ink">{formatBaht(selectedAlert.totalAmount)}</span>
                </div>
                <div>
                  <span className="text-ink-muted block text-[10px]">เงินรัฐสมทบ (60%)</span>
                  <span className="font-mono font-bold text-status-error">{formatBaht(selectedAlert.copayAmount)}</span>
                </div>
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

              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                <span className="font-semibold text-brand-blue block">สาเหตุที่แจ้งเตือน:</span>
                <p className="mt-0.5 text-ink">{selectedAlert.fraudReason}</p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-ink-muted mb-1">
                  หมายเหตุ (ไม่บังคับ)
                </label>
                <input
                  type="text"
                  placeholder="ระบุบันทึกเพิ่มเติม เช่น ตรวจสอบแล้วเป็นออเดอร์สั่งกลับบ้าน"
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  className="w-full rounded-pill border border-hairline px-4 py-2 text-xs focus:border-brand-blue focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-hairline">
              <button
                type="button"
                disabled={resolveMutation.isPending}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedAlert.fraudCheckId,
                    action: 'APPROVE',
                    note: resolveNote || 'ยืนยันว่าเป็นรายการปกติ',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-pill bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 text-xs font-semibold transition disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>อนุมัติรายการนี้</span>
              </button>

              <button
                type="button"
                disabled={resolveMutation.isPending}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedAlert.fraudCheckId,
                    action: 'SUSPEND_MERCHANT',
                    note: resolveNote || 'ระงับสิทธิ์ร้านค้าชั่วคราว',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-pill bg-amber-50 text-amber-800 hover:bg-amber-100 px-4 py-2 text-xs font-semibold border border-amber-200 transition disabled:opacity-50"
              >
                <Store className="h-4 w-4" />
                <span>ระงับร้านค้า</span>
              </button>

              <button
                type="button"
                disabled={resolveMutation.isPending}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedAlert.fraudCheckId,
                    action: 'SUSPEND_USER',
                    note: resolveNote || 'ระงับสิทธิ์ประชาชนชั่วคราว',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-pill bg-red-50 text-status-error hover:bg-red-100 px-4 py-2 text-xs font-semibold border border-red-200 transition disabled:opacity-50"
              >
                <UserX className="h-4 w-4" />
                <span>ระงับประชาชน</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
