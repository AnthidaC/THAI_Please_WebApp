import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  BadgeRecord,
  CampaignRecord,
  CampaignPeriodRecord,
  ConditionTypeRecord,
  MissionRecord,
  RewardRecord,
  BadgeTierRecord,
} from '../../../services/admin/gamificationApi';
import { bangkokDateTimeToIso, generateMonthlyCampaignPeriods, isoToBangkokDateTime } from './campaignPeriodDates';
import { adminGamificationErrorMessage } from './adminGamificationError';
import { moneyToCents, periodQuotasMatchCampaignTotal, sumMoneyCents } from './campaignQuota';
import BadgeTierThresholdSlider from '../../../components/badges/BadgeTierThresholdSlider';
import {
  BADGE_TIER_IDENTITIES,
  getDefaultBadgeThresholds,
  hasCanonicalBadgeTierStructure,
  validateBadgeThresholds,
} from '../../../components/badges/badgeTierThresholds';

export type ManagedResource = 'campaigns' | 'missions' | 'rewards' | 'badges';
type ManagedRecord = CampaignRecord | MissionRecord | RewardRecord | BadgeRecord;

interface Props {
  resource: ManagedResource;
  record: ManagedRecord | null;
  campaigns: CampaignRecord[];
  rewards: RewardRecord[];
  saving: boolean;
  conditionTypes: ConditionTypeRecord[];
  conditionTypesError?: boolean;
  onManageConditionTypes: () => void;
  onClose: () => void;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}

const localDateTime = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const plusDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateTime(date);
};

const initialValues = (resource: ManagedResource, record: ManagedRecord | null): Record<string, string> => {
  if (resource === 'campaigns') {
    const item = record as CampaignRecord | null;
    return {
      name: item?.name ?? '',
      governmentCopayRatePercent: item?.governmentCopayRatePercent ?? '60',
      citizenPaymentRatePercent: item?.citizenPaymentRatePercent ?? '40',
      dailyQuotaLimit: item?.dailyQuotaLimit ?? '150',
      totalQuotaLimit: item?.totalQuotaLimit ?? '3000',
      startDate: isoToBangkokDateTime(item?.startDate ?? new Date()),
      endDate: isoToBangkokDateTime(item?.endDate ?? plusDays(30)),
      status: item?.status ?? 'ACTIVE',
    };
  }
  if (resource === 'missions') {
    const item = record as MissionRecord | null;
    return {
      name: item?.name ?? '',
      description: item?.description ?? '',
      type: item?.conditionType ?? '',
      targetValue: item?.targetValue ?? '1',
      campaignId: item?.campaignId ?? '',
      rewardId: item?.rewardId ?? '',
      startsAt: localDateTime(item?.startsAt ?? new Date()),
      endsAt: localDateTime(item?.endsAt ?? plusDays(7)),
      status: item?.status ?? 'draft',
    };
  }
  if (resource === 'rewards') {
    const item = record as RewardRecord | null;
    return {
      name: item?.name ?? '',
      description: item?.description ?? '',
      type: item?.type ?? 'discount',
      discountType: item?.discountType ?? 'percent',
      discountValue: item?.discountValue ?? '10',
      quotaLimit: item?.quotaLimit == null ? '' : String(item.quotaLimit),
      validDays: String(item?.validDays ?? 30),
      status: item?.status ?? 'active',
    };
  }
  const item = record as BadgeRecord | null;
  return {
    name: item?.name ?? '',
    description: item?.description ?? '',
      conditionType: item?.conditionType ?? '',
  };
};

interface CampaignPeriodDraft {
  key: string;
  periodId?: string;
  periodName: string;
  periodQuotaLimit: string;
  startDate: string;
  endDate: string;
  status: CampaignPeriodRecord['status'];
  allocationCount: number;
  usedAmount: number;
  isEditable: boolean;
}

const initialCampaignPeriods = (record: ManagedRecord | null): CampaignPeriodDraft[] => {
  const item = record as CampaignRecord | null;
  return (item?.periods ?? []).map((period) => ({
    key: period.id,
    periodId: period.id,
    periodName: period.name,
    periodQuotaLimit: period.quotaLimit,
    startDate: isoToBangkokDateTime(period.startDate),
    endDate: isoToBangkokDateTime(period.endDate),
    status: period.status,
    allocationCount: period.allocationCount,
    usedAmount: Number(period.usedAmount),
    isEditable: period.isEditable,
  }));
};

interface BadgeTierDraft {
  key: string;
  tierId?: string;
  requiredCount: string;
  iconUrl: string;
  earnedCount: number;
}

const initialBadgeTiers = (
  record: ManagedRecord | null,
  measurementUnit: ConditionTypeRecord['measurementUnit'] | undefined,
  conditionKey: string | undefined
): BadgeTierDraft[] => {
  const item = record as BadgeRecord | null;
  const defaults = getDefaultBadgeThresholds(measurementUnit, conditionKey);
  return BADGE_TIER_IDENTITIES.map((identity, index) => {
    const tier: BadgeTierRecord | undefined = item?.tiers.find((stored) => stored.level === identity.level);
    return {
      key: tier?.id ?? `new-badge-tier-${identity.level}`,
      ...(tier?.id && { tierId: tier.id }),
      requiredCount: tier ? String(tier.requiredCount) : String(defaults[index]),
      iconUrl: tier?.iconUrl ?? '',
      earnedCount: tier?.earnedCount ?? 0,
    };
  });
};

const titles: Record<ManagedResource, { create: string; edit: string; description: string }> = {
  campaigns: { create: 'สร้างแคมเปญใหม่', edit: 'แก้ไขแคมเปญ', description: 'กำหนดสัดส่วนร่วมจ่ายและวงเงินของโครงการ' },
  missions: { create: 'สร้างภารกิจใหม่', edit: 'แก้ไขภารกิจ', description: 'ตั้งเป้าหมายและกำหนดรางวัลสำหรับประชาชน' },
  rewards: { create: 'สร้างรางวัลใหม่', edit: 'แก้ไขรางวัล', description: 'กำหนดคูปองหรือส่วนลดที่มอบให้ผู้ใช้' },
  badges: { create: 'สร้างเหรียญตราใหม่', edit: 'แก้ไขเหรียญตรา', description: 'กำหนดระดับและเงื่อนไขการได้รับเหรียญตรา' },
};

const Field: React.FC<{ label: string; htmlFor: string; hint?: string; children: React.ReactNode }> = ({ label, htmlFor, hint, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">{label}</label>
    {children}
    {hint && <p id={`${htmlFor}-hint`} className="text-xs leading-5 text-ink-muted">{hint}</p>}
  </div>
);

const inputClass = 'w-full rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand-blue focus:ring-4 focus:ring-blue-100 disabled:bg-surface-soft';

const formatCents = (cents: bigint | null) => cents === null
  ? '—'
  : new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(cents) / 100);

export const RecordEditorDialog: React.FC<Props> = ({ resource, record, campaigns, rewards, saving, conditionTypes, conditionTypesError, onManageConditionTypes, onClose, onSave }) => {
  const initialFormValues = initialValues(resource, record);
  const initialBadgeCondition = conditionTypes.find((condition) => condition.key === initialFormValues.conditionType);
  const [values, setValues] = useState(initialFormValues);
  const [periods, setPeriods] = useState(() => initialCampaignPeriods(record));
  const [periodsEnabled, setPeriodsEnabled] = useState(() => Boolean((record as CampaignRecord | null)?.periods?.length));
  const [monthCount, setMonthCount] = useState('');
  const [monthlyQuota, setMonthlyQuota] = useState('');
  const [badgeTiers, setBadgeTiers] = useState(() => initialBadgeTiers(record, initialBadgeCondition?.measurementUnit, initialBadgeCondition?.key));
  const [badgeThresholdsEdited, setBadgeThresholdsEdited] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const content = titles[resource];
  const selectedConditionType = conditionTypes.find((condition) => condition.key === values.conditionType);
  const selectedMissionConditionType = conditionTypes.find((condition) => condition.key === values.type);
  const badgeRecord = resource === 'badges' ? record as BadgeRecord | null : null;
  const badgeTierStructureCompatible = !badgeRecord || (
    badgeRecord.tierStructureCompatible && hasCanonicalBadgeTierStructure(badgeRecord.tiers)
  );
  const badgeTiersActive = badgeRecord?.status === 'active';
  const badgeThresholdValidation = validateBadgeThresholds(badgeTiers.map((tier) => tier.requiredCount));
  const hasPersistedPeriod = periods.some((period) => Boolean(period.periodId));
  const hasLockedPeriod = periods.some((period) => !period.isEditable);
  const configuredPeriodQuotaCents = sumMoneyCents(periods.map((period) => period.periodQuotaLimit));
  const campaignQuotaCents = moneyToCents(values.totalQuotaLimit);
  const periodQuotaDifferenceCents = campaignQuotaCents === null ? null : configuredPeriodQuotaCents - campaignQuotaCents;
  const periodQuotaMatches = periodsEnabled && periodQuotasMatchCampaignTotal(
    values.totalQuotaLimit,
    periods.map((period) => period.periodQuotaLimit)
  );
  const money = (amount: number) => new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(amount);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    dialog?.querySelector<HTMLElement>(focusableSelector)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose, saving]);

  const set = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (resource === 'badges' && key === 'conditionType' && !record && !badgeThresholdsEdited) {
      const condition = conditionTypes.find((item) => item.key === value);
      const defaults = getDefaultBadgeThresholds(condition?.measurementUnit, condition?.key);
      setBadgeTiers((current) => current.map((tier, index) => ({ ...tier, requiredCount: String(defaults[index]) })));
    }
  };
  const updateBadgeThresholds = (thresholds: string[]) => {
    setBadgeThresholdsEdited(true);
    setBadgeTiers((current) => current.map((tier, index) => ({
      ...tier,
      requiredCount: thresholds[index] ?? tier.requiredCount,
    })));
  };
  const showValidationError = (message: string, fieldId?: string) => {
    setError(message);
    requestAnimationFrame(() => document.getElementById(fieldId ?? 'record-dialog-error')?.focus());
  };
  const updatePeriod = (key: string, field: 'periodName' | 'periodQuotaLimit' | 'startDate' | 'endDate', value: string) => {
    setPeriods((current) => current.map((period) => period.key === key ? { ...period, [field]: value } : period));
  };
  const addPeriod = () => {
    const startDate = periods[periods.length - 1]?.endDate ?? values.startDate;
    setPeriods((current) => [...current, {
      key: crypto.randomUUID(),
      periodName: `ช่วงที่ ${current.length + 1}`,
      periodQuotaLimit: '0',
      startDate,
      endDate: values.endDate,
      status: 'UPCOMING',
      allocationCount: 0,
      usedAmount: 0,
      isEditable: true,
    }]);
  };
  const generatePeriods = () => {
    const generated = generateMonthlyCampaignPeriods(values.startDate, values.endDate, Number(monthCount), Number(monthlyQuota));
    if (!generated.length) {
      showValidationError('ระบุวันเริ่ม วันสิ้นสุด จำนวนเดือน และวงเงินต่อเดือนให้ถูกต้องก่อนสร้างช่วงเวลา', 'period-month-count');
      return;
    }
    if (periods.length && !window.confirm('การสร้างช่วงรายเดือนจะแทนที่รายการช่วงที่แก้ไขได้ทั้งหมด ต้องการดำเนินการต่อหรือไม่?')) return;
    setPeriods(generated.map((period) => ({
      key: crypto.randomUUID(),
      ...period,
      periodQuotaLimit: String(period.periodQuotaLimit),
      status: 'UPCOMING',
      allocationCount: 0,
      usedAmount: 0,
      isEditable: true,
    })));
    setPeriodsEnabled(true);
    setError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (resource === 'missions') {
      const isRegisteredCondition = conditionTypes.some((condition) => condition.key === values.type);
      const isUnchangedLegacyCondition = Boolean(record) && (record as MissionRecord).conditionType === values.type;
      if (!isRegisteredCondition && !isUnchangedLegacyCondition) {
        showValidationError('กรุณาเลือกประเภทเงื่อนไขจากรายการ หรือเพิ่มประเภทใหม่ในหน้าจัดการประเภทเงื่อนไข', 'mission-type');
        return;
      }
    }
    if (resource === 'badges') {
      if (!badgeTierStructureCompatible) {
        showValidationError('เหรียญตรานี้มีระดับเดิมที่ไม่ตรงกับ 4 ระดับมาตรฐาน จึงป้องกันการบันทึกไว้ก่อน กรุณาตรวจสอบแผนปรับข้อมูลโดยรักษาประวัติเดิม');
        return;
      }
      if (!conditionTypes.some((condition) => condition.key === values.conditionType)) {
        showValidationError('กรุณาเลือกประเภทเงื่อนไขจากรายการ หรือเพิ่มประเภทใหม่ในหน้าจัดการประเภทเงื่อนไข', 'badge-condition');
        return;
      }
      if (!badgeThresholdValidation.valid) {
        const invalidIndex = badgeThresholdValidation.errors.findIndex(Boolean);
        const tier = BADGE_TIER_IDENTITIES[Math.max(0, invalidIndex)];
        showValidationError(
          badgeThresholdValidation.message ?? 'ตรวจสอบเกณฑ์ทั้ง 4 ระดับอีกครั้ง',
          `badge-tier-thresholds-${tier.name.toLowerCase()}`
        );
        return;
      }
    }
    try {
      let payload: Record<string, unknown>;
      if (resource === 'campaigns') {
        const campaignStart = bangkokDateTimeToIso(values.startDate);
        const campaignEnd = bangkokDateTimeToIso(values.endDate);
        const campaignStartTime = Date.parse(campaignStart);
        const campaignEndTime = Date.parse(campaignEnd);
        if (campaignStartTime >= campaignEndTime) {
          showValidationError('วันสิ้นสุดแคมเปญต้องอยู่หลังวันเริ่มต้น', 'campaign-end');
          return;
        }
        if (periodsEnabled && periods.length === 0) {
          showValidationError('เพิ่มอย่างน้อย 1 ช่วง หรือปิดการแบ่งช่วงเวลา', 'campaign-period-add');
          return;
        }
        if (periodsEnabled) {
          const normalized = periods.map((period) => ({
            ...period,
            startTime: Date.parse(bangkokDateTimeToIso(period.startDate)),
            endTime: Date.parse(bangkokDateTimeToIso(period.endDate)),
            quotaCents: moneyToCents(period.periodQuotaLimit),
          }));
          const invalid = normalized.find((period) => !period.periodName.trim() || period.quotaCents === null || period.quotaCents < 0n);
          if (invalid) {
            showValidationError('กรอกชื่อช่วงและวงเงินที่ไม่ติดลบ (ทศนิยมได้ไม่เกิน 2 ตำแหน่ง)', `campaign-period-${invalid.key}-quota`);
            return;
          }
          const invalidRange = normalized.find((period) => period.startTime >= period.endTime);
          if (invalidRange) {
            showValidationError('วันสิ้นสุดช่วงเวลาต้องอยู่หลังวันเริ่มต้น', `campaign-period-${invalidRange.key}-end`);
            return;
          }
          const outside = normalized.find((period) => period.startTime < campaignStartTime || period.endTime > campaignEndTime);
          if (outside) {
            showValidationError('ช่วงเวลาทั้งหมดต้องอยู่ภายในวันเริ่มต้นและสิ้นสุดของแคมเปญ', `campaign-period-${outside.key}-start`);
            return;
          }
          for (let index = 0; index < normalized.length; index += 1) {
            const overlaps = normalized.slice(index + 1).find((period) => normalized[index].startTime < period.endTime && period.startTime < normalized[index].endTime);
            if (overlaps) {
              showValidationError('ช่วงเวลาห้ามซ้อนทับกัน โดยช่วงถัดไปเริ่มได้ตรงกับเวลาสิ้นสุดของช่วงก่อนหน้า', `campaign-period-${overlaps.key}-start`);
              return;
            }
          }
          const configuredQuotaCents = normalized.reduce<bigint>((total, period) => total + (period.quotaCents ?? 0n), 0n);
          const campaignQuotaCents = moneyToCents(values.totalQuotaLimit);
          if (campaignQuotaCents === null || configuredQuotaCents !== campaignQuotaCents) {
            showValidationError(`ยอดวงเงินรวมทุกช่วงต้องเท่ากับวงเงินรวมแคมเปญ (${formatCents(campaignQuotaCents)} บาท)`, 'total-limit');
            return;
          }
        }
        payload = {
          campaignName: values.name.trim(),
          governmentCopayRatePercent: Number(values.governmentCopayRatePercent),
          citizenPaymentRatePercent: Number(values.citizenPaymentRatePercent),
          dailyQuotaLimit: Number(values.dailyQuotaLimit),
          totalQuotaLimit: Number(values.totalQuotaLimit),
          startDate: campaignStart,
          endDate: campaignEnd,
          status: values.status,
          periods: periodsEnabled ? periods.map((period) => ({
            ...(period.periodId && { periodId: period.periodId }),
            periodName: period.periodName.trim(),
            periodQuotaLimit: Number(period.periodQuotaLimit),
            startDate: bangkokDateTimeToIso(period.startDate),
            endDate: bangkokDateTimeToIso(period.endDate),
          })) : [],
        };
      } else if (resource === 'missions') {
        payload = {
          questName: values.name.trim(),
          description: values.description.trim() || null,
          conditionType: values.type.trim(),
          targetValue: Number(values.targetValue),
          campaignId: values.campaignId || null,
          rewardId: values.rewardId || null,
          startsAt: new Date(values.startsAt).toISOString(),
          endsAt: new Date(values.endsAt).toISOString(),
          status: values.status,
        };
      } else if (resource === 'rewards') {
        payload = {
          rewardName: values.name.trim(),
          description: values.description.trim() || null,
          rewardType: values.type,
          discountType: values.type === 'discount' ? values.discountType : null,
          discountValue: values.type === 'discount' ? Number(values.discountValue) : null,
          quotaLimit: values.quotaLimit === '' ? null : Number(values.quotaLimit),
          validDays: Number(values.validDays),
          status: values.status,
        };
      } else {
        payload = {
          badgeName: values.name.trim(),
          description: values.description.trim() || null,
          ...(!record && { conditionType: values.conditionType.trim() }),
          tiers: badgeTiers.map((tier, index) => ({
            ...(tier.tierId && { tierId: tier.tierId }),
            tierName: BADGE_TIER_IDENTITIES[index].name,
            tierLevel: BADGE_TIER_IDENTITIES[index].level,
            requiredCount: Number(tier.requiredCount),
            iconUrl: tier.iconUrl.trim() || null,
          })),
        };
      }
      await onSave(payload);
    } catch (saveError) {
      setError(adminGamificationErrorMessage(saveError, 'บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง'));
      requestAnimationFrame(() => document.getElementById('record-dialog-error')?.focus());
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}
    >
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="record-dialog-title" className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:rounded-[24px]">
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-blue">THAI Please · Admin</p>
            <h2 id="record-dialog-title" className="mt-1 text-xl font-bold tracking-tight text-ink">{record ? content.edit : content.create}</h2>
            <p className="mt-1 text-sm text-ink-muted">{content.description}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="ปิดหน้าต่าง" className="rounded-pill p-2 text-ink-muted transition hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
            {error && <p id="record-dialog-error" tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-error focus:outline-none focus-visible:ring-4 focus-visible:ring-red-100">{error}</p>}
            {resource === 'campaigns' && (
              <>
                <Field label="ชื่อแคมเปญ" htmlFor="campaign-name">
                  <input id="campaign-name" autoFocus required maxLength={150} value={values.name} onChange={(event) => set('name', event.target.value)} className={inputClass} placeholder="เช่น ไทยช่วยไทย เที่ยวเมืองรอง" />
                </Field>
                <div className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:grid-cols-2">
                  <Field label="ภาครัฐร่วมจ่าย (%)" htmlFor="government-share">
                    <input id="government-share" required type="number" min="0" max="100" step="0.01" value={values.governmentCopayRatePercent} onChange={(event) => set('governmentCopayRatePercent', event.target.value)} className={inputClass} />
                  </Field>
                  <Field label="ประชาชนร่วมจ่าย (%)" htmlFor="citizen-share">
                    <input id="citizen-share" required type="number" min="0" max="100" step="0.01" value={values.citizenPaymentRatePercent} onChange={(event) => set('citizenPaymentRatePercent', event.target.value)} className={inputClass} />
                  </Field>
                  <p className="text-xs text-ink-muted sm:col-span-2">สัดส่วนทั้งสองฝั่งต้องรวมกันเท่ากับ 100%</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="วงเงินต่อวัน (บาท)" htmlFor="daily-limit"><input id="daily-limit" required type="number" min="0.01" step="0.01" value={values.dailyQuotaLimit} onChange={(event) => set('dailyQuotaLimit', event.target.value)} className={inputClass} /></Field>
                  <Field label="วงเงินรวม (บาท)" htmlFor="total-limit"><input id="total-limit" required type="number" min="0.01" step="0.01" value={values.totalQuotaLimit} onChange={(event) => set('totalQuotaLimit', event.target.value)} className={inputClass} /></Field>
                  <Field label="เริ่มแคมเปญ" htmlFor="campaign-start"><input id="campaign-start" name="campaign_start_date" autoComplete="off" required type="datetime-local" value={values.startDate} onChange={(event) => set('startDate', event.target.value)} className={inputClass} /></Field>
                  <Field label="สิ้นสุดแคมเปญ" htmlFor="campaign-end"><input id="campaign-end" name="campaign_end_date" autoComplete="off" required type="datetime-local" value={values.endDate} onChange={(event) => set('endDate', event.target.value)} className={inputClass} /></Field>
                </div>
                <section aria-labelledby="campaign-period-heading" className="space-y-4 rounded-2xl border border-hairline bg-surface-soft/70 p-4 sm:p-5">
                  <div>
                    <h3 id="campaign-period-heading" className="text-base font-bold text-ink">ช่วงเวลาโครงการ</h3>
                    <p className="mt-1 text-xs leading-5 text-ink-muted">วงเงินรัฐของแต่ละช่วงแยกจากกันและไม่ยกยอดที่เหลือไปช่วงถัดไป ช่วงใช้เวลาเริ่มต้นแบบรวมและเวลาสิ้นสุดแบบไม่รวม</p>
                  </div>
                  <label htmlFor="campaign-period-toggle" className="flex min-h-11 items-start gap-3 rounded-xl border border-hairline bg-white p-3 text-sm font-semibold text-ink">
                    <input
                      id="campaign-period-toggle"
                      name="campaign_period_enabled"
                      type="checkbox"
                      checked={periodsEnabled}
                      disabled={hasPersistedPeriod}
                      onChange={(event) => setPeriodsEnabled(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-brand-blue focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-60"
                    />
                    <span>
                      เปิดใช้งานการแบ่งช่วง
                      {hasPersistedPeriod && <span className="mt-0.5 block text-xs font-normal text-ink-muted">เมื่อบันทึกช่วงแรกแล้ว จะปิดการแบ่งช่วงไม่ได้</span>}
                    </span>
                  </label>

                  {periodsEnabled && (
                    <>
                      <div className="grid gap-3 rounded-xl border border-blue-100 bg-white p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <Field label="จำนวนเดือน" htmlFor="period-month-count">
                          <input id="period-month-count" name="period_month_count" autoComplete="off" type="number" min="1" max="120" step="1" value={monthCount} onChange={(event) => setMonthCount(event.target.value)} className={inputClass} placeholder="เช่น 4" />
                        </Field>
                        <Field label="วงเงินรัฐต่อเดือน (บาท)" htmlFor="period-month-quota">
                          <input id="period-month-quota" name="period_month_quota" autoComplete="off" type="number" min="0" step="0.01" value={monthlyQuota} onChange={(event) => setMonthlyQuota(event.target.value)} className={inputClass} placeholder="เช่น 1,000" />
                        </Field>
                        <button type="button" disabled={hasLockedPeriod} onClick={generatePeriods} className="min-h-11 rounded-pill border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-brand-blue transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                          สร้างช่วงรายเดือน
                        </button>
                      </div>
                      {hasLockedPeriod && <p className="text-xs text-amber-800">สร้างรายการใหม่ไม่ได้ เพราะแคมเปญมีช่วงที่เริ่มแล้วหรือมีการใช้วงเงิน</p>}

                      <div className="space-y-3">
                        {periods.map((period, index) => (
                          <article key={period.key} className="space-y-3 rounded-xl border border-hairline bg-white p-3 sm:p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-sm font-bold text-ink">ช่วงที่ {index + 1}</h4>
                              <div className="flex items-center gap-2">
                                {period.periodId && <span className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold ${period.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : period.status === 'ENDED' ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-800'}`}>{period.status === 'ACTIVE' ? 'กำลังใช้งาน' : period.status === 'ENDED' ? 'สิ้นสุดแล้ว' : 'กำลังจะมาถึง'}</span>}
                                {period.periodId && <button type="button" disabled={!period.isEditable} onClick={() => setPeriods((current) => current.filter((item) => item.key !== period.key))} aria-label={`ลบช่วงเวลา ${period.periodName}`} className="min-h-10 rounded-pill px-3 text-sm font-semibold text-status-error transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-40">ลบช่วง</button>}
                                {!period.periodId && <button type="button" onClick={() => setPeriods((current) => current.filter((item) => item.key !== period.key))} aria-label={`ลบช่วงเวลา ${period.periodName}`} className="min-h-10 rounded-pill px-3 text-sm font-semibold text-status-error transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100">ลบช่วง</button>}
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="ชื่อช่วง" htmlFor={`campaign-period-${period.key}-name`}>
                                <input id={`campaign-period-${period.key}-name`} name={`period_${index}_name`} autoComplete="off" required maxLength={100} disabled={!period.isEditable} value={period.periodName} onChange={(event) => updatePeriod(period.key, 'periodName', event.target.value)} className={inputClass} placeholder="เช่น เดือนที่ 1" />
                              </Field>
                              <Field label="วงเงินรัฐต่อช่วง (บาท)" htmlFor={`campaign-period-${period.key}-quota`}>
                                <input id={`campaign-period-${period.key}-quota`} name={`period_${index}_quota`} autoComplete="off" required type="number" min="0" step="0.01" disabled={!period.isEditable} value={period.periodQuotaLimit} onChange={(event) => updatePeriod(period.key, 'periodQuotaLimit', event.target.value)} className={inputClass} />
                              </Field>
                              <Field label="เริ่มช่วง (เวลาไทย)" htmlFor={`campaign-period-${period.key}-start`}>
                                <input id={`campaign-period-${period.key}-start`} name={`period_${index}_start`} autoComplete="off" required type="datetime-local" disabled={!period.isEditable} value={period.startDate} onChange={(event) => updatePeriod(period.key, 'startDate', event.target.value)} className={inputClass} />
                              </Field>
                              <Field label="สิ้นสุดช่วง (ไม่รวมเวลานี้)" htmlFor={`campaign-period-${period.key}-end`}>
                                <input id={`campaign-period-${period.key}-end`} name={`period_${index}_end`} autoComplete="off" required type="datetime-local" disabled={!period.isEditable} value={period.endDate} onChange={(event) => updatePeriod(period.key, 'endDate', event.target.value)} className={inputClass} />
                              </Field>
                            </div>
                            {period.periodId && <p className="text-xs leading-5 text-ink-muted">จัดสรรแล้ว {period.allocationCount.toLocaleString('th-TH')} กระเป๋า · ใช้ไป {money(period.usedAmount)} บาท{!period.isEditable ? ' · ช่วงที่เริ่มแล้วหรือมีการใช้วงเงินจะไม่แก้ไขได้' : ''}</p>}
                          </article>
                        ))}
                        {!periods.length && <p className="rounded-xl border border-dashed border-hairline bg-white px-4 py-5 text-center text-sm text-ink-muted">ยังไม่มีช่วงเวลา เพิ่มช่วงเองหรือสร้างช่วงรายเดือน</p>}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button id="campaign-period-add" type="button" onClick={addPeriod} className="min-h-11 rounded-pill border border-hairline bg-white px-4 text-sm font-semibold text-ink transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">+ เพิ่มช่วง</button>
                        <div aria-live="polite" className={`rounded-xl px-4 py-3 text-sm sm:text-right ${periodQuotaMatches ? 'bg-blue-50' : 'border border-amber-200 bg-amber-50'}`}>
                          <p className="font-semibold text-ink">วงเงินรวมแคมเปญ: <span className="font-mono tabular-nums">{formatCents(campaignQuotaCents)} บาท</span></p>
                          <p className="mt-1 font-semibold text-ink">วงเงินรวมทุกช่วง: <span className="font-mono tabular-nums">{formatCents(configuredPeriodQuotaCents)} บาท</span></p>
                          <p className="mt-1 text-xs text-ink-muted">ส่วนต่าง: {periodQuotaDifferenceCents === null ? '—' : periodQuotaDifferenceCents === 0n ? '0.00' : `${periodQuotaDifferenceCents < 0n ? 'ขาด' : 'เกิน'} ${formatCents(periodQuotaDifferenceCents < 0n ? -periodQuotaDifferenceCents : periodQuotaDifferenceCents)}`} บาท</p>
                          {!periodQuotaMatches && <p role="alert" className="mt-2 text-xs font-semibold text-amber-900">ยอดวงเงินรวมทุกช่วงต้องเท่ากับวงเงินรวมแคมเปญ ({formatCents(campaignQuotaCents)} บาท)</p>}
                        </div>
                      </div>
                    </>
                  )}
                </section>
                <Field label="สถานะ" htmlFor="campaign-status">
                  <select id="campaign-status" value={values.status} onChange={(event) => set('status', event.target.value)} className={inputClass}>
                    <option value="ACTIVE">กำลังดำเนินการ</option><option value="PAUSED">หยุดชั่วคราว</option><option value="COMPLETED">สิ้นสุดแล้ว</option>
                  </select>
                </Field>
              </>
            )}

            {resource === 'missions' && (
              <>
                <Field label="ชื่อภารกิจ" htmlFor="mission-name"><input id="mission-name" autoFocus required maxLength={150} value={values.name} onChange={(event) => set('name', event.target.value)} className={inputClass} placeholder="เช่น แวะร้านค้าในชุมชน 3 แห่ง" /></Field>
                <Field label="รายละเอียด" htmlFor="mission-description"><textarea id="mission-description" rows={3} maxLength={1000} value={values.description} onChange={(event) => set('description', event.target.value)} className={`${inputClass} resize-y`} placeholder="อธิบายสิ่งที่ผู้ใช้ต้องทำ" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="ประเภทเงื่อนไข" htmlFor="mission-type" hint="ใช้รายการประเภทเงื่อนไขเดียวกับเหรียญตรา">
                    <select id="mission-type" required disabled={conditionTypesError} aria-describedby={conditionTypesError ? 'mission-type-hint mission-type-error' : selectedMissionConditionType?.description ? 'mission-type-hint mission-type-description' : 'mission-type-hint'} value={values.type} onChange={(event) => set('type', event.target.value)} className={`${inputClass} min-h-11`}>
                      <option value="">เลือกประเภทเงื่อนไข</option>
                      {record && !conditionTypes.some((condition) => condition.key === values.type) && <option value={values.type}>ประเภทเดิม: {values.type}</option>}
                      {conditionTypes.map((condition) => <option key={condition.id} value={condition.key}>{condition.displayName} ({condition.key})</option>)}
                    </select>
                    {conditionTypesError ? (
                      <p id="mission-type-error" role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-status-error">โหลดรายการประเภทเงื่อนไขไม่สำเร็จ กรุณาลองใหม่ก่อนสร้างภารกิจ</p>
                    ) : selectedMissionConditionType?.description ? (
                      <p id="mission-type-description" className="mt-2 text-xs leading-5 text-ink-muted">{selectedMissionConditionType.description}</p>
                    ) : null}
                    <button type="button" onClick={onManageConditionTypes} className="mt-2 min-h-11 rounded-pill border border-blue-200 bg-white px-3.5 text-xs font-semibold text-brand-blue hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">จัดการประเภทเงื่อนไข</button>
                  </Field>
                  <Field label="เป้าหมาย" htmlFor="mission-target"><input id="mission-target" required type="number" min="0.01" step="0.01" value={values.targetValue} onChange={(event) => set('targetValue', event.target.value)} className={inputClass} /></Field>
                  <Field label="แคมเปญ" htmlFor="mission-campaign">
                    <select id="mission-campaign" value={values.campaignId} onChange={(event) => set('campaignId', event.target.value)} className={inputClass}>
                      <option value="">ไม่ผูกกับแคมเปญ</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
                    </select>
                  </Field>
                  <Field label="รางวัลที่ได้รับ" htmlFor="mission-reward">
                    <select id="mission-reward" value={values.rewardId} onChange={(event) => set('rewardId', event.target.value)} className={inputClass}>
                      <option value="">ยังไม่กำหนดรางวัล</option>{rewards.map((reward) => <option key={reward.id} value={reward.id}>{reward.name}</option>)}
                    </select>
                  </Field>
                  <Field label="เริ่มภารกิจ" htmlFor="mission-start"><input id="mission-start" required type="datetime-local" value={values.startsAt} onChange={(event) => set('startsAt', event.target.value)} className={inputClass} /></Field>
                  <Field label="สิ้นสุดภารกิจ" htmlFor="mission-end"><input id="mission-end" required type="datetime-local" value={values.endsAt} onChange={(event) => set('endsAt', event.target.value)} className={inputClass} /></Field>
                </div>
                <Field label="สถานะ" htmlFor="mission-status"><select id="mission-status" value={values.status} onChange={(event) => set('status', event.target.value)} className={inputClass}><option value="draft">ฉบับร่าง</option><option value="active">เปิดใช้งาน</option><option value="paused">หยุดชั่วคราว</option><option value="completed">สิ้นสุดแล้ว</option></select></Field>
              </>
            )}

            {resource === 'rewards' && (
              <>
                <Field label="ชื่อรางวัล" htmlFor="reward-name"><input id="reward-name" autoFocus required maxLength={150} value={values.name} onChange={(event) => set('name', event.target.value)} className={inputClass} placeholder="เช่น ส่วนลดร้านค้าชุมชน 10%" /></Field>
                <Field label="รายละเอียด" htmlFor="reward-description"><textarea id="reward-description" rows={3} maxLength={1000} value={values.description} onChange={(event) => set('description', event.target.value)} className={`${inputClass} resize-y`} placeholder="เงื่อนไขและวิธีใช้รางวัล" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="ประเภทรางวัล" htmlFor="reward-type"><select id="reward-type" value={values.type} onChange={(event) => set('type', event.target.value)} className={inputClass}><option value="discount">ส่วนลด</option><option value="coupon">คูปอง</option></select></Field>
                  {values.type === 'discount' && <>
                    <Field label="รูปแบบส่วนลด" htmlFor="discount-type"><select id="discount-type" value={values.discountType} onChange={(event) => set('discountType', event.target.value)} className={inputClass}><option value="percent">เปอร์เซ็นต์</option><option value="fixed">จำนวนเงิน (บาท)</option></select></Field>
                    <Field label={values.discountType === 'percent' ? 'ส่วนลด (%)' : 'ส่วนลด (บาท)'} htmlFor="discount-value"><input id="discount-value" required type="number" min="0.01" max={values.discountType === 'percent' ? 100 : undefined} step="0.01" value={values.discountValue} onChange={(event) => set('discountValue', event.target.value)} className={inputClass} /></Field>
                  </>}
                  <Field label="อายุรางวัล (วัน)" htmlFor="reward-validity"><input id="reward-validity" required type="number" min="1" max="3650" value={values.validDays} onChange={(event) => set('validDays', event.target.value)} className={inputClass} /></Field>
                </div>
                <Field label="โควตาใช้รวม (ครั้ง)" htmlFor="reward-quota-limit" hint="นับรวมทุกผู้ใช้ · เว้นว่างเพื่อไม่จำกัด · 0 คือปิดการใช้">
                  <input id="reward-quota-limit" name="quotaLimit" aria-describedby="reward-quota-limit-hint" autoComplete="off" type="number" min="0" max="2147483647" step="1" inputMode="numeric" value={values.quotaLimit} onChange={(event) => set('quotaLimit', event.target.value)} className={inputClass} placeholder="เช่น 100…" />
                </Field>
                <Field label="สถานะ" htmlFor="reward-status"><select id="reward-status" value={values.status} onChange={(event) => set('status', event.target.value)} className={inputClass}><option value="active">เปิดใช้งาน</option><option value="paused">หยุดชั่วคราว</option><option value="archived">เก็บถาวร</option></select></Field>
              </>
            )}

            {resource === 'badges' && (
              <>
                <Field label="ชื่อเหรียญตรา" htmlFor="badge-name">
                  <input id="badge-name" name="badgeName" autoComplete="off" required maxLength={100} value={values.name} onChange={(event) => set('name', event.target.value)} className={inputClass} placeholder="เช่น นักช้อปชุมชน" />
                </Field>
                <Field label="คำอธิบาย" htmlFor="badge-description">
                  <textarea id="badge-description" name="badgeDescription" autoComplete="off" rows={3} maxLength={1000} value={values.description} onChange={(event) => set('description', event.target.value)} className={`${inputClass} resize-y`} placeholder="อธิบายความสำเร็จที่เหรียญตรานี้มอบให้" />
                </Field>
                <Field label="ประเภทเงื่อนไข" htmlFor="badge-condition" hint={record ? 'รหัสประเภทเงื่อนไขเปลี่ยนหลังสร้างเหรียญตราไม่ได้' : 'เลือกเงื่อนไขจากรายการที่ผู้ดูแลระบบลงทะเบียนไว้'}>
                  <select id="badge-condition" name="conditionType" required disabled={Boolean(record) || conditionTypesError} value={values.conditionType} onChange={(event) => set('conditionType', event.target.value)} className={inputClass}>
                    <option value="">เลือกประเภทเงื่อนไข</option>
                    {record && !conditionTypes.some((condition) => condition.key === values.conditionType) && <option value={values.conditionType}>{values.conditionType}</option>}
                    {conditionTypes.map((condition) => <option key={condition.id} value={condition.key}>{condition.displayName} ({condition.key})</option>)}
                  </select>
                  {conditionTypesError ? (
                    <p role="alert" className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-status-error">โหลดรายการประเภทเงื่อนไขไม่สำเร็จ กรุณาลองใหม่ก่อนสร้างเหรียญตรา</p>
                  ) : selectedConditionType?.handlerRegistered ? (
                    selectedConditionType.implementationStatus === 'ready' ? (
                      <p className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">ระบบหลังบ้านรองรับเงื่อนไขนี้และพร้อมใช้งานแล้ว</p>
                    ) : (
                      <p className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">ระบบหลังบ้านรองรับเงื่อนไขนี้แล้ว แต่ต้องตั้งสถานะเป็นพร้อมใช้งานก่อนเปิดเหรียญตรา</p>
                    )
                  ) : selectedConditionType ? (
                    <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">ต้องพัฒนาระบบหลังบ้านสำหรับเงื่อนไขนี้ก่อนเปิดใช้งาน</p>
                  ) : null}
                  <button type="button" onClick={onManageConditionTypes} className="mt-2 min-h-10 rounded-pill border border-blue-200 bg-white px-3.5 text-xs font-semibold text-brand-blue hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">จัดการประเภทเงื่อนไข</button>
                </Field>

                <section aria-labelledby="badge-tiers-heading" className="space-y-3 rounded-2xl border border-hairline bg-surface-soft/60 p-4">
                  <div>
                    <h3 id="badge-tiers-heading" className="text-sm font-semibold text-ink">เกณฑ์ปลดล็อกเหรียญตรา 4 ระดับ</h3>
                    <p className="mt-1 text-xs leading-5 text-ink-muted">ลำดับและชื่อระดับเป็นมาตรฐานเดียวกัน ปรับได้เฉพาะเกณฑ์และรูปไอคอน</p>
                  </div>

                  {badgeRecord && !badgeTierStructureCompatible && (
                    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                      <p className="font-semibold">เหรียญตรานี้มีโครงสร้างระดับเดิมที่ไม่ครบหรือไม่ตรงกับมาตรฐาน 4 ระดับ ระบบจึงปิดการแก้ไขและไม่ลบข้อมูลเดิม</p>
                      <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-5">
                        {badgeRecord.tiers.map((tier) => <li key={tier.id}>{tier.name} · ระดับ {tier.level} · เกณฑ์ {tier.requiredCount.toLocaleString('th-TH')}</li>)}
                      </ul>
                      <p className="mt-2 text-xs leading-5">ต้องตรวจสอบรหัสระดับและประวัติการปลดล็อก แล้วจัดทำแผนปรับข้อมูลแบบรักษารายการเดิมก่อนแก้เหรียญตรานี้</p>
                    </div>
                  )}

                  {badgeTiersActive && badgeTierStructureCompatible && (
                    <p role="status" className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
                      ปิดใช้งานเหรียญตราก่อนแก้เกณฑ์หรือรูปไอคอน
                    </p>
                  )}

                  <BadgeTierThresholdSlider
                    id="badge-tier-thresholds"
                    values={badgeTiers.map((tier) => tier.requiredCount)}
                    onChange={updateBadgeThresholds}
                    measurementUnit={selectedConditionType?.measurementUnit}
                    conditionKey={values.conditionType}
                    conditionName={selectedConditionType?.displayName}
                    disabled={!badgeTierStructureCompatible || badgeTiersActive}
                    lockedTiers={badgeTiers.map((tier) => tier.earnedCount > 0)}
                  />

                  <fieldset disabled={!badgeTierStructureCompatible || badgeTiersActive} className="space-y-2">
                    <legend className="text-xs font-semibold text-ink-body">รูปไอคอนของแต่ละระดับ (ไม่บังคับ)</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {BADGE_TIER_IDENTITIES.map((identity, index) => {
                        const tier = badgeTiers[index];
                        const iconId = `badge-tier-${identity.level}-icon`;
                        return (
                          <Field key={identity.level} label={`ไอคอนระดับ${identity.label}`} htmlFor={iconId}>
                            <input
                              id={iconId}
                              name={`badgeTier${identity.level}IconUrl`}
                              autoComplete="off"
                              type="url"
                              maxLength={2048}
                              disabled={tier.earnedCount > 0}
                              value={tier.iconUrl}
                              onChange={(event) => setBadgeTiers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, iconUrl: event.target.value } : item))}
                              className={inputClass}
                              placeholder="https://…"
                            />
                          </Field>
                        );
                      })}
                    </div>
                  </fieldset>
                </section>
                <p role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-ink-body">เหรียญตราใหม่จะมีสถานะรอพัฒนาและปิดใช้งาน ต้องมีตัวประมวลผลในระบบหลังบ้านและพร้อมใช้งานก่อนเปิดให้ประชาชน</p>
              </>
            )}
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-hairline bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-pill border border-hairline px-5 py-2.5 text-sm font-semibold text-ink-body transition hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-50">ยกเลิก</button>
            <button
              type="submit"
              disabled={saving
                || (resource === 'campaigns' && periodsEnabled && !periodQuotaMatches)
                || (resource === 'badges' && (!badgeThresholdValidation.valid || !badgeTierStructureCompatible))}
              className="rounded-pill bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-blue-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? 'กำลังบันทึก…' : record ? 'บันทึกการแก้ไข' : 'สร้างรายการ'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};
