import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownUp,
  BadgeCheck,
  CalendarDays,
  Check,
  CircleDollarSign,
  ClipboardList,
  Gift,
  LoaderCircle,
  Megaphone,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Tags,
  Target,
} from 'lucide-react';
import {
  BadgeRecord,
  BadgeImplementationStatus,
  CampaignRecord,
  MissionRecord,
  RewardRecord,
  gamificationApi,
} from '../../../services/admin/gamificationApi';
import { ManagedResource, RecordEditorDialog } from './RecordEditorDialog';
import { ConditionTypeManagementPanel } from './ConditionTypeManagementPanel';
import { adminGamificationErrorMessage } from './adminGamificationError';

type ManagedRecord = CampaignRecord | MissionRecord | RewardRecord | BadgeRecord;
type StatusFilter = 'all' | 'active' | 'inactive' | 'paused' | 'draft' | 'completed' | 'archived';
type ImplementationFilter = 'all' | BadgeImplementationStatus;

interface EditorState {
  resource: ManagedResource;
  record: ManagedRecord | null;
}

const tabs: { id: ManagedResource; label: string; icon: typeof Megaphone; descriptor: string }[] = [
  { id: 'campaigns', label: 'แคมเปญ', icon: Megaphone, descriptor: 'บริหารงบประมาณและโครงการร่วมจ่าย' },
  { id: 'missions', label: 'ภารกิจ', icon: Target, descriptor: 'ตั้งเป้าหมายการมีส่วนร่วมของประชาชน' },
  { id: 'rewards', label: 'รางวัล', icon: Gift, descriptor: 'สร้างคูปองและส่วนลดสำหรับผู้ใช้' },
  { id: 'badges', label: 'เหรียญตรา', icon: BadgeCheck, descriptor: 'จัดการระดับและเงื่อนไขความสำเร็จ' },
];

const statusFilters: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'active', label: 'เปิดใช้งาน' },
  { id: 'inactive', label: 'ปิดใช้งาน' },
  { id: 'paused', label: 'หยุดชั่วคราว' },
  { id: 'draft', label: 'ฉบับร่าง' },
  { id: 'completed', label: 'สิ้นสุดแล้ว' },
  { id: 'archived', label: 'เก็บถาวร' },
];

const badgeStatusFilters: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'active', label: 'เปิดใช้งาน' },
  { id: 'inactive', label: 'ปิดใช้งาน' },
];

const implementationFilters: { id: ImplementationFilter; label: string }[] = [
  { id: 'all', label: 'ทุกสถานะการพัฒนา' },
  { id: 'pending', label: 'รอพัฒนา' },
  { id: 'in_progress', label: 'กำลังพัฒนา' },
  { id: 'ready', label: 'พร้อมใช้งาน' },
];

const normalizeStatus = (status: string) => status.toLowerCase();
const isActive = (status: string) => normalizeStatus(status) === 'active';
const formatNumber = (value: number | string) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(Number(value));
const formatBaht = (value: number | string) => `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(Number(value))} บาท`;
const formatDate = (value: string) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(value));

const statusLabel = (status: string) => {
  switch (normalizeStatus(status)) {
    case 'active': return 'เปิดใช้งาน';
    case 'inactive': return 'ปิดใช้งาน';
    case 'paused': return 'หยุดชั่วคราว';
    case 'draft': return 'ฉบับร่าง';
    case 'completed': return 'สิ้นสุดแล้ว';
    case 'archived': return 'เก็บถาวร';
    default: return status;
  }
};

const statusClass = (status: string) => {
  switch (normalizeStatus(status)) {
    case 'active': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'inactive': return 'border-slate-200 bg-slate-100 text-slate-600';
    case 'paused': return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'draft': return 'border-slate-200 bg-slate-100 text-slate-600';
    case 'completed': return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'archived': return 'border-slate-200 bg-white text-slate-500';
    default: return 'border-hairline bg-surface-soft text-ink-body';
  }
};

const statusForToggle = (resource: ManagedResource, current: string): string | null => {
  const status = normalizeStatus(current);
  if (status === 'completed') return null;
  if (resource === 'campaigns') return status === 'active' ? 'PAUSED' : 'ACTIVE';
  if (resource === 'missions') return status === 'active' ? 'paused' : 'active';
  return status === 'active' ? 'paused' : 'active';
};

const responseError = (error: unknown) => {
  return adminGamificationErrorMessage(error, 'เชื่อมต่อข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
};

const TabButton: React.FC<{ active: boolean; label: string; icon: typeof Megaphone; onClick: () => void }> = ({ active, label, icon: Icon, onClick }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`group flex shrink-0 items-center gap-2.5 border-b-2 px-4 py-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-blue-100 sm:px-5 ${active ? 'border-brand-blue text-brand-blue' : 'border-transparent text-ink-muted hover:border-slate-300 hover:text-ink'}`}
  >
    <Icon className={`h-4 w-4 ${active ? 'text-brand-blue' : 'text-ink-muted group-hover:text-ink'}`} />
    {label}
  </button>
);

const StatCard: React.FC<{ label: string; value: string | number; footnote: string; icon: typeof Megaphone; tone: 'blue' | 'violet' | 'green' | 'amber' }> = ({ label, value, footnote, icon: Icon, tone }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  };
  return (
    <article className="rounded-card border border-hairline bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-ink-muted">{label}</p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-ink">{value}</p>
        </div>
        <div className={`rounded-2xl p-2.5 ring-1 ${tones[tone]}`}><Icon className="h-4 w-4" /></div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">{footnote}</p>
    </article>
  );
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 py-1 text-[11px] font-semibold ${statusClass(status)}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${isActive(status) ? 'bg-emerald-500' : normalizeStatus(status) === 'paused' ? 'bg-amber-500' : 'bg-current opacity-60'}`} />
    {statusLabel(status)}
  </span>
);

const ImplementationPill: React.FC<{ status: BadgeImplementationStatus }> = ({ status }) => {
  const labels: Record<BadgeImplementationStatus, string> = {
    pending: 'รอพัฒนา',
    in_progress: 'กำลังพัฒนา',
    ready: 'พร้อมใช้งาน',
  };
  const styles: Record<BadgeImplementationStatus, string> = {
    pending: 'border-amber-200 bg-amber-50 text-amber-800',
    in_progress: 'border-blue-200 bg-blue-50 text-blue-800',
    ready: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  return <span className={`inline-flex rounded-pill border px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}>{labels[status]}</span>;
};

const EmptyState: React.FC<{ resource: ManagedResource; search: string; onCreate: () => void }> = ({ resource, search, onCreate }) => {
const labels: Record<ManagedResource, string> = { campaigns: 'แคมเปญ', missions: 'ภารกิจ', rewards: 'รางวัล', badges: 'เหรียญตรา' };
  return (
    <div className="flex flex-col items-center px-5 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-soft text-ink-muted"><ClipboardList className="h-6 w-6" /></div>
      <h3 className="mt-4 text-base font-bold text-ink">{search ? 'ไม่พบรายการที่ตรงกัน' : `ยังไม่มี${labels[resource]}`}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-ink-muted">{search ? 'ลองเปลี่ยนคำค้นหา หรือปรับตัวกรองสถานะ' : `สร้าง${labels[resource]}แรกเพื่อเริ่มจัดการโปรแกรมสิทธิประโยชน์`}</p>
      {!search && <button type="button" onClick={onCreate} className="mt-5 inline-flex items-center gap-2 rounded-pill bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-blue-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"><Plus className="h-4 w-4" />สร้าง{labels[resource]}</button>}
    </div>
  );
};

export const AdminCampaignsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const resource: ManagedResource = tabs.some((tab) => tab.id === sectionParam) ? sectionParam as ManagedResource : 'campaigns';
  const search = searchParams.get('q') ?? '';
  const requestedStatus = searchParams.get('status');
  const statusFilter: StatusFilter = statusFilters.some((item) => item.id === requestedStatus) ? requestedStatus as StatusFilter : 'all';
  const requestedImplementation = searchParams.get('implementation');
  const implementationFilter: ImplementationFilter = implementationFilters.some((item) => item.id === requestedImplementation) ? requestedImplementation as ImplementationFilter : 'all';
  const updateSearchParam = (key: string, value: string) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    return next;
  }, { replace: true });
  const setSearch = (value: string) => updateSearchParam('q', value);
  const setStatusFilter = (value: StatusFilter) => updateSearchParam('status', value);
  const setImplementationFilter = (value: ImplementationFilter) => updateSearchParam('implementation', value);
  const setResource = (value: ManagedResource) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.set('section', value);
    next.delete('q');
    next.delete('status');
    next.delete('implementation');
    return next;
  }, { replace: true });
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [conditionTypesOpen, setConditionTypesOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const campaignsQuery = useQuery({ queryKey: ['admin', 'gamification', 'campaigns'], queryFn: gamificationApi.campaigns });
  const missionsQuery = useQuery({ queryKey: ['admin', 'gamification', 'missions'], queryFn: gamificationApi.missions });
  const rewardsQuery = useQuery({ queryKey: ['admin', 'gamification', 'rewards'], queryFn: gamificationApi.rewards });
  const badgesQuery = useQuery({ queryKey: ['admin', 'gamification', 'badges'], queryFn: () => gamificationApi.badges() });
  const conditionTypesQuery = useQuery({
    queryKey: ['admin', 'gamification', 'condition-types'],
    queryFn: () => gamificationApi.conditionTypes(),
    enabled: resource === 'badges' || resource === 'missions' || conditionTypesOpen,
  });

  const campaigns = campaignsQuery.data ?? [];
  const missions = missionsQuery.data ?? [];
  const rewards = rewardsQuery.data ?? [];
  const badges = badgesQuery.data ?? [];
  const activeCampaigns = campaigns.filter((item) => isActive(item.status)).length;
  const activeMissions = missions.filter((item) => isActive(item.status)).length;
  const activeRewards = rewards.filter((item) => isActive(item.status)).length;
  const issuedRewards = rewards.reduce((total, item) => total + item.issuedCount, 0);

  const mutation = useMutation({
    mutationFn: async (input: { resource: ManagedResource; id?: string; values: Record<string, unknown> }) => {
      const { resource: type, id, values } = input;
      if (type === 'campaigns') return id ? gamificationApi.updateCampaign(id, values) : gamificationApi.createCampaign(values);
      if (type === 'missions') return id ? gamificationApi.updateMission(id, values) : gamificationApi.createMission(values);
      if (type === 'rewards') return id ? gamificationApi.updateReward(id, values) : gamificationApi.createReward(values);
      return id ? gamificationApi.updateBadge(id, values) : gamificationApi.createBadge(values);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'gamification'] }),
  });

  const badgeWorkflowMutation = useMutation({
    mutationFn: async (input: { id: string; action: 'activate' | 'deactivate' | 'implementation'; implementationStatus?: BadgeImplementationStatus }) => {
      if (input.action === 'activate') return gamificationApi.activateBadge(input.id);
      if (input.action === 'deactivate') return gamificationApi.deactivateBadge(input.id);
      return gamificationApi.updateBadgeImplementationStatus(input.id, input.implementationStatus!);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'gamification', 'badges'] }),
  });

  const allQueries = [campaignsQuery, missionsQuery, rewardsQuery, badgesQuery];
  const anyLoading = allQueries.some((query) => query.isLoading);
  const failedQuery = allQueries.find((query) => query.isError);

  const rows: ManagedRecord[] = useMemo(() => {
    switch (resource) {
      case 'campaigns': return campaigns;
      case 'missions': return missions;
      case 'rewards': return rewards;
      case 'badges': return badges;
    }
  }, [resource, campaigns, missions, rewards, badges]);

  const filteredRows = useMemo(() => rows.filter((record) => {
    const searchable = resource === 'campaigns'
      ? `${(record as CampaignRecord).name}`
      : resource === 'missions'
        ? `${(record as MissionRecord).name} ${(record as MissionRecord).campaignName ?? ''} ${(record as MissionRecord).conditionType}`
        : resource === 'rewards'
          ? `${(record as RewardRecord).name} ${(record as RewardRecord).type}`
          : `${(record as BadgeRecord).name} ${(record as BadgeRecord).conditionType}`;
    const matchesText = searchable.toLocaleLowerCase('th').includes(search.trim().toLocaleLowerCase('th'));
    const matchesStatus = statusFilter === 'all' || normalizeStatus(record.status) === statusFilter;
    const matchesImplementation = resource !== 'badges' || implementationFilter === 'all'
      || (record as BadgeRecord).implementationStatus === implementationFilter;
    return matchesText && matchesStatus && matchesImplementation;
  }), [rows, resource, search, statusFilter, implementationFilter]);

  const selectedTab = tabs.find((item) => item.id === resource)!;

  const handleSave = async (values: Record<string, unknown>) => {
    if (!editor) return;
    await mutation.mutateAsync({ resource: editor.resource, id: editor.record?.id, values });
    setEditor(null);
    setNotice(editor.record ? 'บันทึกการแก้ไขแล้ว' : 'สร้างรายการแล้ว');
    window.setTimeout(() => setNotice(''), 3500);
  };

  const changeStatus = async (record: ManagedRecord) => {
    if (resource === 'badges') {
      const badge = record as BadgeRecord;
      const action = badge.status === 'active' ? 'deactivate' : 'activate';
      if (action === 'activate' && !badge.activationEligible) return;
      try {
        await badgeWorkflowMutation.mutateAsync({ id: badge.id, action });
        setNotice(action === 'activate' ? 'เปิดใช้งานเหรียญตราแล้ว' : 'ปิดใช้งานเหรียญตราแล้ว');
        window.setTimeout(() => setNotice(''), 3500);
      } catch {
        setNotice(responseError(badgeWorkflowMutation.error));
        window.setTimeout(() => setNotice(''), 5000);
      }
      return;
    }
    const nextStatus = statusForToggle(resource, record.status);
    if (!nextStatus) return;
    try {
      await mutation.mutateAsync({ resource, id: record.id, values: { status: nextStatus } });
      setNotice(nextStatus.toLowerCase() === 'paused' ? 'หยุดรายการชั่วคราวแล้ว' : 'เปิดใช้งานรายการแล้ว');
      window.setTimeout(() => setNotice(''), 3500);
    } catch {
      setNotice(responseError(mutation.error));
      window.setTimeout(() => setNotice(''), 5000);
    }
  };

  const updateBadgeImplementationStatus = async (badge: BadgeRecord, implementationStatus: BadgeImplementationStatus) => {
    try {
      await badgeWorkflowMutation.mutateAsync({ id: badge.id, action: 'implementation', implementationStatus });
      setNotice('อัปเดตสถานะการพัฒนาแล้ว');
      window.setTimeout(() => setNotice(''), 3500);
    } catch {
      setNotice(responseError(badgeWorkflowMutation.error));
      window.setTimeout(() => setNotice(''), 5000);
    }
  };

  const renderMainCell = (record: ManagedRecord): React.ReactNode[] => {
    if (resource === 'campaigns') {
      const item = record as CampaignRecord;
      return [
        <div key="primary" className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-blue-50 p-2 text-brand-blue"><Megaphone className="h-4 w-4" /></div>
          <div><p className="font-semibold text-ink">{item.name}</p><p className="mt-1 text-xs text-ink-muted">{item.missionCount} ภารกิจ · {item.periods.length ? `${item.periods.length} ช่วงเวลา` : 'ไม่แบ่งช่วง'}</p></div>
        </div>,
        <div key="share" className="min-w-[130px]"><p className="font-mono text-xs font-medium text-ink">รัฐ {formatNumber(item.governmentCopayRatePercent)}% / ประชาชน {formatNumber(item.citizenPaymentRatePercent)}%</p><p className="mt-1 text-xs text-ink-muted">สัดส่วนร่วมจ่าย</p></div>,
        <div key="date" className="min-w-[145px]"><p className="text-sm text-ink">{formatDate(item.startDate)}</p><p className="mt-1 text-xs text-ink-muted">ถึง {formatDate(item.endDate)}</p></div>,
        <div key="quota" className="min-w-[130px]"><p className="font-mono text-sm font-medium text-ink">{formatBaht(item.totalQuotaLimit)}</p><p className="mt-1 text-xs text-ink-muted">{formatBaht(item.dailyQuotaLimit)} / วัน</p>{item.periods.length > 0 && <p className="mt-1 text-xs text-ink-muted">ช่วงรวม {formatBaht(item.periods.reduce((sum, period) => sum + Number(period.quotaLimit), 0))}</p>}</div>,
        <div key="status"><StatusPill status={item.status} /></div>,
      ];
    }
    if (resource === 'missions') {
      const item = record as MissionRecord;
      return [
        <div key="primary" className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-violet-50 p-2 text-violet-700"><Target className="h-4 w-4" /></div><div><p className="font-semibold text-ink">{item.name}</p><p className="mt-1 max-w-[260px] truncate text-xs text-ink-muted">{item.description || item.conditionType}</p></div></div>,
        <div key="links" className="min-w-[145px]"><p className="text-sm text-ink">{item.campaignName || 'ไม่ผูกแคมเปญ'}</p><p className="mt-1 text-xs text-ink-muted">รางวัล: {item.rewardName || 'ยังไม่กำหนด'}</p></div>,
        <div key="target" className="min-w-[100px]"><p className="font-mono text-sm font-medium text-ink">{formatNumber(item.targetValue)}</p><p className="mt-1 text-xs text-ink-muted">เป้าหมาย · {item.participantCount} คน</p></div>,
        <div key="date" className="min-w-[145px]"><p className="text-sm text-ink">{formatDate(item.startsAt)}</p><p className="mt-1 text-xs text-ink-muted">ถึง {formatDate(item.endsAt)}</p></div>,
        <div key="status"><StatusPill status={item.status} /></div>,
      ];
    }
    if (resource === 'rewards') {
      const item = record as RewardRecord;
      const valueLabel = item.type === 'discount' && item.discountValue != null
        ? item.discountType === 'percent' ? `${formatNumber(item.discountValue)}%` : formatBaht(item.discountValue)
        : item.type === 'coupon' ? 'คูปอง' : '—';
      return [
        <div key="primary" className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-emerald-50 p-2 text-emerald-700"><Gift className="h-4 w-4" /></div><div><p className="font-semibold text-ink">{item.name}</p><p className="mt-1 max-w-[250px] truncate text-xs text-ink-muted">{item.description || (item.type === 'coupon' ? 'คูปองสิทธิประโยชน์' : 'ส่วนลด')}</p></div></div>,
        <div key="type" className="min-w-[100px]"><p className="text-sm font-semibold text-ink">{item.type === 'coupon' ? 'คูปอง' : 'ส่วนลด'}</p><p className="mt-1 text-xs text-ink-muted">อายุ {item.validDays} วัน</p></div>,
        <div key="value" className="min-w-[100px]"><p className="font-mono text-sm font-semibold text-ink">{valueLabel}</p><p className="mt-1 text-xs text-ink-muted">มูลค่ารางวัล</p></div>,
        <div key="count" className="min-w-[112px]"><p className="font-mono text-sm font-medium text-ink">{item.quotaLimit === null ? formatNumber(item.issuedCount) : `${formatNumber(item.redeemedCount)} / ${formatNumber(item.quotaLimit)}`}</p><p className="mt-1 text-xs text-ink-muted">{item.quotaLimit === null ? 'มอบให้ผู้ใช้' : 'ใช้แล้ว / โควตา'}</p>{item.quotaLimit !== null && <p className="mt-1 text-[11px] text-ink-muted">เหลือ {formatNumber(Math.max(0, item.quotaLimit - item.redeemedCount))} · ออกแล้ว {formatNumber(item.issuedCount)}</p>}</div>,
        <div key="status"><StatusPill status={item.status} /></div>,
      ];
    }
    const item = record as BadgeRecord;
    return [
      <div key="primary" className="flex items-start gap-3"><div className="mt-0.5 rounded-xl bg-amber-50 p-2 text-amber-700"><BadgeCheck className="h-4 w-4" /></div><div><p className="font-semibold text-ink">{item.name}</p><p className="mt-1 max-w-[250px] truncate text-xs text-ink-muted">{item.description || 'เหรียญตราความสำเร็จสำหรับประชาชน'}</p></div></div>,
      <div key="condition" className="min-w-[150px]"><p className="text-sm font-semibold text-ink">{item.conditionDisplayName}</p><code translate="no" className="mt-1 inline-block break-all rounded-lg bg-surface-soft px-2 py-1 text-xs font-semibold text-ink-body">{item.conditionType}</code><p className="mt-2 text-xs text-ink-muted">{item.handlerRegistered ? 'มีตัวประมวลผลในระบบ' : 'รอพัฒนาระบบหลังบ้าน'}</p></div>,
      <div key="tiers" className="min-w-[145px]"><p className="text-sm font-semibold text-ink">{item.tierCount} ระดับ</p><div className="mt-1 flex flex-wrap gap-1">{item.tiers.slice(0, 3).map((tier) => <span key={tier.id} className="rounded-pill border border-amber-100 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">{tier.name}: {formatNumber(tier.requiredCount)}</span>)}{item.tierCount > 3 && <span className="self-center text-[10px] text-ink-muted">+{item.tierCount - 3}</span>}</div>{!item.tierStructureCompatible && <p className="mt-2 text-xs font-semibold text-status-error">โครงสร้างระดับเดิมต้องตรวจสอบก่อนแก้ไข</p>}</div>,
      <div key="implementation" className="min-w-[140px]"><ImplementationPill status={item.implementationStatus} /><p className="mt-2 text-xs text-ink-muted">{formatNumber(item.awardedCount)} คนปลดล็อกแล้ว</p></div>,
      <div key="status"><StatusPill status={item.status} /></div>,
    ];
  };

  return (
    <div className="min-h-[calc(100vh-65px)] bg-surface-soft pb-10">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-7 sm:px-6 sm:pt-9 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-pill border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-bold tracking-wide text-brand-blue">
              <Sparkles className="h-3.5 w-3.5" /> เครื่องมือส่งเสริมการใช้จ่ายชุมชน
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">แคมเปญและสิทธิประโยชน์</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">จัดการโครงการร่วมจ่าย ภารกิจ คูปอง และเหรียญตราสำหรับประชาชนในหน้าเดียว</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {resource === 'badges' && <button type="button" onClick={() => setConditionTypesOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-pill border border-blue-200 bg-white px-4 text-sm font-semibold text-brand-blue hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"><Tags className="h-4 w-4" />จัดการประเภทเงื่อนไข</button>}
            <button
              type="button"
              onClick={() => { setNotice(''); setEditor({ resource, record: null }); }}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-pill bg-brand-blue px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-blue-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
            >
              <Plus className="h-4 w-4" /> สร้าง{tabs.find((item) => item.id === resource)?.label}
            </button>
          </div>
        </div>

        <section aria-label="ภาพรวม gamification" className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="แคมเปญที่เปิดใช้" value={campaignsQuery.isLoading ? '—' : activeCampaigns} footnote={`จากทั้งหมด ${campaigns.length} แคมเปญ`} icon={Megaphone} tone="blue" />
          <StatCard label="ภารกิจที่เปิดใช้" value={missionsQuery.isLoading ? '—' : activeMissions} footnote={`จากทั้งหมด ${missions.length} ภารกิจ`} icon={Target} tone="violet" />
          <StatCard label="รางวัลที่เปิดใช้" value={rewardsQuery.isLoading ? '—' : activeRewards} footnote={`${issuedRewards.toLocaleString('th-TH')} ครั้งที่มอบให้แล้ว`} icon={Gift} tone="green" />
          <StatCard label="เหรียญตรา" value={badgesQuery.isLoading ? '—' : badges.length} footnote={`${badges.reduce((sum, item) => sum + item.awardedCount, 0).toLocaleString('th-TH')} ครั้งที่ปลดล็อกแล้ว`} icon={BadgeCheck} tone="amber" />
        </section>

        <section className="mt-7 overflow-hidden rounded-card border border-hairline bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
          <div className="border-b border-hairline px-4 pt-2 sm:px-6">
            <div role="group" aria-label="ประเภทการจัดการ" className="flex -mb-px overflow-x-auto">
              {tabs.map((tab) => <TabButton key={tab.id} active={resource === tab.id} label={tab.label} icon={tab.icon} onClick={() => { setResource(tab.id); setNotice(''); }} />)}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2.5"><selectedTab.icon className="h-5 w-5 text-brand-blue" /><h2 className="text-lg font-bold text-ink">{selectedTab.label}</h2></div>
                <p className="mt-1 text-sm text-ink-muted">{selectedTab.descriptor}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative block sm:w-64">
                  <span className="sr-only">ค้นหา{selectedTab.label}</span>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  <input type="search" name="recordSearch" autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อหรือรายละเอียด" className="w-full rounded-pill border border-hairline bg-white py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-brand-blue focus:ring-4 focus:ring-blue-100" />
                </label>
                <label className="flex items-center gap-2 rounded-pill border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink-body sm:min-w-[165px]">
                  <ArrowDownUp className="h-3.5 w-3.5 text-ink-muted" /><span className="sr-only">กรองตามสถานะ</span>
                  <select name="activationStatus" autoComplete="off" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="w-full bg-white text-sm text-ink-body outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
                    {(resource === 'badges' ? badgeStatusFilters : statusFilters).map((filter) => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
                  </select>
                </label>
                {resource === 'badges' && <label className="flex items-center gap-2 rounded-pill border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink-body sm:min-w-[205px]">
                  <span className="sr-only">กรองตามสถานะการพัฒนา</span>
                  <select name="implementationStatus" autoComplete="off" value={implementationFilter} onChange={(event) => setImplementationFilter(event.target.value as ImplementationFilter)} className="w-full bg-white text-sm text-ink-body outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
                    {implementationFilters.map((filter) => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
                  </select>
                </label>}
              </div>
            </div>

            {notice && <div role="status" className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"><Check className="h-4 w-4 shrink-0" />{notice}</div>}
            {failedQuery && (
              <div role="alert" className="mt-5 flex flex-col justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center">
                <p className="text-sm font-medium text-status-error">{responseError(failedQuery.error)}</p>
                <button type="button" onClick={() => allQueries.forEach((query) => void query.refetch())} className="rounded-pill border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-status-error hover:bg-red-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100">ลองอีกครั้ง</button>
              </div>
            )}

            {anyLoading ? (
              <div role="status" className="flex min-h-64 flex-col items-center justify-center text-ink-muted"><LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-brand-blue" /><p className="mt-3 text-sm">กำลังโหลดข้อมูล...</p></div>
            ) : !failedQuery && filteredRows.length === 0 ? (
              <EmptyState resource={resource} search={search} onCreate={() => setEditor({ resource, record: null })} />
            ) : !failedQuery && (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3 text-xs text-ink-muted">
                  <span>แสดง <strong className="font-mono text-ink">{filteredRows.length}</strong> จาก <strong className="font-mono text-ink">{rows.length}</strong> รายการ</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />อัปเดตจากฐานข้อมูล</span>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[950px] border-separate border-spacing-0 text-left">
                    <thead>
                      <tr className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
                        <th scope="col" className="w-[28%] px-3 py-3">รายละเอียด</th>
                        <th scope="col" className="px-3 py-3">{resource === 'badges' ? 'ประเภทเงื่อนไข' : resource === 'campaigns' ? 'สัดส่วนร่วมจ่าย' : resource === 'missions' ? 'แคมเปญ / รางวัล' : 'ประเภท / อายุ'}</th>
                        <th scope="col" className="px-3 py-3">{resource === 'badges' ? 'ระดับและเกณฑ์' : resource === 'campaigns' ? 'ระยะเวลา' : resource === 'missions' ? 'เป้าหมาย' : 'มูลค่า'}</th>
                        <th scope="col" className="px-3 py-3">{resource === 'badges' ? 'สถานะการพัฒนา' : resource === 'campaigns' ? 'วงเงิน' : resource === 'missions' ? 'ช่วงเวลา' : 'มอบแล้ว'}</th>
                        <th scope="col" className="px-3 py-3">{resource === 'badges' ? 'การเปิดใช้งาน' : 'สถานะ'}</th>
                        <th scope="col" className="px-3 py-3 text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((record) => {
                        const cells = renderMainCell(record);
                        return <tr key={record.id} className="group transition hover:bg-surface-soft/70">
                          <td className="border-t border-hairline-soft px-3 py-4 align-middle">{cells[0]}</td>
                          <td className="border-t border-hairline-soft px-3 py-4 align-middle">{cells[1]}</td>
                          <td className="border-t border-hairline-soft px-3 py-4 align-middle">{cells[2]}</td>
                          <td className="border-t border-hairline-soft px-3 py-4 align-middle">{cells[3]}</td>
                          <td className="border-t border-hairline-soft px-3 py-4 align-middle">{cells[4]}</td>
                          <td className="border-t border-hairline-soft px-3 py-4 text-right align-middle">
                            <div className="inline-flex items-center gap-1">
                              {resource === 'badges' ? (() => {
                                const badge = record as BadgeRecord;
                                const isEnabled = badge.status === 'active';
                                return <>
                                  <button type="button" onClick={() => void changeStatus(record)} disabled={badgeWorkflowMutation.isPending || (!isEnabled && !badge.activationEligible)} aria-label={`${isEnabled ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}เหรียญตรา ${badge.name}`} title={isEnabled ? 'ปิดใช้งานเหรียญตรา' : badge.activationEligible ? 'เปิดใช้งานเหรียญตรา' : 'ต้องพร้อมใช้งานและมีตัวประมวลผลในระบบก่อน'} className={`rounded-xl p-2 text-ink-muted transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-40 ${isEnabled ? 'hover:bg-amber-50 hover:text-amber-700' : 'hover:bg-emerald-50 hover:text-emerald-700'}`}>{isEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
                                  <select aria-label={`สถานะการพัฒนาของเหรียญตรา ${badge.name}`} value={badge.implementationStatus} disabled={badgeWorkflowMutation.isPending} onChange={(event) => void updateBadgeImplementationStatus(badge, event.target.value as BadgeImplementationStatus)} className="max-w-[122px] rounded-lg border border-hairline bg-white px-2 py-2 text-[11px] font-semibold text-ink-body focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-50">
                                    <option value="pending">รอพัฒนา</option><option value="in_progress">กำลังพัฒนา</option><option value="ready">พร้อมใช้งาน</option>
                                  </select>
                                </>;
                              })() : statusForToggle(resource, record.status) && <button type="button" onClick={() => void changeStatus(record)} disabled={mutation.isPending} aria-label={isActive(record.status) ? 'หยุดรายการชั่วคราว' : 'เปิดใช้งานรายการ'} title={isActive(record.status) ? 'หยุดชั่วคราว' : 'เปิดใช้งาน'} className={`rounded-xl p-2 text-ink-muted transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-40 ${isActive(record.status) ? 'hover:bg-amber-50 hover:text-amber-700' : 'hover:bg-emerald-50 hover:text-emerald-700'}`}>{isActive(record.status) ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>}
                              <button type="button" onClick={() => { setNotice(''); setEditor({ resource, record }); }} aria-label="แก้ไขรายการ" title="แก้ไข" className="rounded-xl p-2 text-ink-muted transition hover:bg-blue-50 hover:text-brand-blue focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"><Pencil className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-muted"><CircleDollarSign className="h-3.5 w-3.5" />การแก้ไขสถานะจะไม่ลบคูปองที่ออกให้หรือเหรียญตราที่ประชาชนได้รับแล้ว</p>
      </div>

      {editor && <RecordEditorDialog resource={editor.resource} record={editor.record} campaigns={campaigns} rewards={rewards} conditionTypes={conditionTypesQuery.data ?? []} conditionTypesError={conditionTypesQuery.isError} saving={mutation.isPending} onManageConditionTypes={() => setConditionTypesOpen(true)} onClose={() => setEditor(null)} onSave={handleSave} />}
      {conditionTypesOpen && <ConditionTypeManagementPanel onClose={() => setConditionTypesOpen(false)} />}
    </div>
  );
};
