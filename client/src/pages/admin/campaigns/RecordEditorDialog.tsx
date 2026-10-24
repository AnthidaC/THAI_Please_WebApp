import React, { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  BadgeRecord,
  CampaignRecord,
  MissionRecord,
  RewardRecord,
} from '../../../services/admin/gamificationApi';

export type ManagedResource = 'campaigns' | 'missions' | 'rewards' | 'badges';
type ManagedRecord = CampaignRecord | MissionRecord | RewardRecord | BadgeRecord;

interface Props {
  resource: ManagedResource;
  record: ManagedRecord | null;
  campaigns: CampaignRecord[];
  rewards: RewardRecord[];
  saving: boolean;
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
      startDate: localDateTime(item?.startDate ?? new Date()),
      endDate: localDateTime(item?.endDate ?? plusDays(30)),
      status: item?.status ?? 'ACTIVE',
    };
  }
  if (resource === 'missions') {
    const item = record as MissionRecord | null;
    return {
      name: item?.name ?? '',
      description: item?.description ?? '',
      type: item?.type ?? 'weekly_shop_visits',
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
      validDays: String(item?.validDays ?? 30),
      status: item?.status ?? 'active',
    };
  }
  const item = record as BadgeRecord | null;
  return {
    name: item?.name ?? '',
    level: item?.level ?? 'Bronze',
    description: item?.description ?? '',
    conditionType: item?.conditionType ?? 'shop_visits',
    requiredCount: String(item?.requiredCount ?? 1),
    status: item?.status ?? 'active',
  };
};

const titles: Record<ManagedResource, { create: string; edit: string; description: string }> = {
  campaigns: { create: 'สร้างแคมเปญใหม่', edit: 'แก้ไขแคมเปญ', description: 'กำหนดสัดส่วนร่วมจ่ายและวงเงินของโครงการ' },
  missions: { create: 'สร้างภารกิจใหม่', edit: 'แก้ไขภารกิจ', description: 'ตั้งเป้าหมายและกำหนดรางวัลสำหรับประชาชน' },
  rewards: { create: 'สร้างรางวัลใหม่', edit: 'แก้ไขรางวัล', description: 'กำหนดคูปองหรือส่วนลดที่มอบให้ผู้ใช้' },
  badges: { create: 'สร้างแบดจ์ใหม่', edit: 'แก้ไขแบดจ์', description: 'กำหนดระดับและเงื่อนไขการได้รับแบดจ์' },
};

const Field: React.FC<{ label: string; htmlFor: string; hint?: string; children: React.ReactNode }> = ({ label, htmlFor, hint, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">{label}</label>
    {children}
    {hint && <p className="text-xs leading-5 text-ink-muted">{hint}</p>}
  </div>
);

const inputClass = 'w-full rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand-blue focus:ring-4 focus:ring-blue-100 disabled:bg-surface-soft';

const missionTypeOptions = [
  { value: 'weekly_shop_visits', label: 'เยี่ยมชมร้านค้าให้ครบตามจำนวนครั้งต่อสัปดาห์' },
  { value: 'referral', label: 'แนะนำเพื่อนให้เข้าร่วมโครงการ' },
  { value: 'visit_diverse_shops', label: 'ใช้สิทธิ์กับร้านค้าหลายแห่ง' },
];

const badgeConditionOptions = [
  { value: 'shop_visits', label: 'เยี่ยมชมร้านค้าครบตามจำนวนครั้ง' },
  { value: 'successful_referrals', label: 'แนะนำเพื่อนให้สมัครสำเร็จครบตามจำนวน' },
];

export const RecordEditorDialog: React.FC<Props> = ({ resource, record, campaigns, rewards, saving, onClose, onSave }) => {
  const [values, setValues] = useState(() => initialValues(resource, record));
  const [error, setError] = useState('');
  const content = titles[resource];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, saving]);

  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      let payload: Record<string, unknown>;
      if (resource === 'campaigns') {
        payload = {
          campaignName: values.name.trim(),
          governmentCopayRatePercent: Number(values.governmentCopayRatePercent),
          citizenPaymentRatePercent: Number(values.citizenPaymentRatePercent),
          dailyQuotaLimit: Number(values.dailyQuotaLimit),
          totalQuotaLimit: Number(values.totalQuotaLimit),
          startDate: new Date(values.startDate).toISOString(),
          endDate: new Date(values.endDate).toISOString(),
          status: values.status,
        };
      } else if (resource === 'missions') {
        payload = {
          questName: values.name.trim(),
          description: values.description.trim() || null,
          questType: values.type.trim(),
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
          validDays: Number(values.validDays),
          status: values.status,
        };
      } else {
        payload = {
          badgeName: values.name.trim(),
          badgeLevel: values.level,
          description: values.description.trim() || null,
          conditionType: values.conditionType.trim(),
          requiredCount: Number(values.requiredCount),
          status: values.status,
        };
      }
      await onSave(payload);
    } catch (saveError) {
      const responseMessage = (saveError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(responseMessage ?? 'บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="record-dialog-title" className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:rounded-[24px]">
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-blue">THAI Please · Admin</p>
            <h2 id="record-dialog-title" className="mt-1 text-xl font-bold tracking-tight text-ink">{record ? content.edit : content.create}</h2>
            <p className="mt-1 text-sm text-ink-muted">{content.description}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="ปิดหน้าต่าง" className="rounded-pill p-2 text-ink-muted transition hover:bg-surface-soft hover:text-ink disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
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
                  <Field label="เริ่มแคมเปญ" htmlFor="campaign-start"><input id="campaign-start" required type="datetime-local" value={values.startDate} onChange={(event) => set('startDate', event.target.value)} className={inputClass} /></Field>
                  <Field label="สิ้นสุดแคมเปญ" htmlFor="campaign-end"><input id="campaign-end" required type="datetime-local" value={values.endDate} onChange={(event) => set('endDate', event.target.value)} className={inputClass} /></Field>
                </div>
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
                  <Field label="ประเภทภารกิจ" htmlFor="mission-type" hint="เลือกกิจกรรมที่ใช้วัดความคืบหน้าของภารกิจ">
                    <select id="mission-type" required value={values.type} onChange={(event) => set('type', event.target.value)} className={inputClass}>
                      {!missionTypeOptions.some((option) => option.value === values.type) && <option value={values.type}>ประเภทเดิม: {values.type}</option>}
                      {missionTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
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
                <Field label="สถานะ" htmlFor="reward-status"><select id="reward-status" value={values.status} onChange={(event) => set('status', event.target.value)} className={inputClass}><option value="active">เปิดใช้งาน</option><option value="paused">หยุดชั่วคราว</option><option value="archived">เก็บถาวร</option></select></Field>
              </>
            )}

            {resource === 'badges' && (
              <>
                <Field label="ชื่อแบดจ์" htmlFor="badge-name"><input id="badge-name" autoFocus required maxLength={100} value={values.name} onChange={(event) => set('name', event.target.value)} className={inputClass} placeholder="เช่น นักช้อปชุมชน" /></Field>
                <Field label="รายละเอียด" htmlFor="badge-description"><textarea id="badge-description" rows={3} maxLength={1000} value={values.description} onChange={(event) => set('description', event.target.value)} className={`${inputClass} resize-y`} placeholder="รายละเอียดที่แสดงให้ผู้ใช้เห็น" /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="ระดับแบดจ์" htmlFor="badge-level"><select id="badge-level" value={values.level} onChange={(event) => set('level', event.target.value)} className={inputClass}><option>Bronze</option><option>Silver</option><option>Gold</option><option>Rainbow</option></select></Field>
                  <Field label="ประเภทเงื่อนไข" htmlFor="badge-condition" hint="เลือกสิ่งที่ผู้ใช้ต้องทำให้ครบเพื่อรับแบดจ์">
                    <select id="badge-condition" required value={values.conditionType} onChange={(event) => set('conditionType', event.target.value)} className={inputClass}>
                      {!badgeConditionOptions.some((option) => option.value === values.conditionType) && <option value={values.conditionType}>ประเภทเดิม: {values.conditionType}</option>}
                      {badgeConditionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </Field>
                  <Field label="จำนวนที่ต้องทำ" htmlFor="badge-count"><input id="badge-count" required type="number" min="1" step="1" value={values.requiredCount} onChange={(event) => set('requiredCount', event.target.value)} className={inputClass} /></Field>
                  <Field label="สถานะ" htmlFor="badge-status"><select id="badge-status" value={values.status} onChange={(event) => set('status', event.target.value)} className={inputClass}><option value="active">เปิดใช้งาน</option><option value="paused">หยุดชั่วคราว</option><option value="archived">เก็บถาวร</option></select></Field>
                </div>
              </>
            )}

            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-error">{error}</p>}
          </div>
          <footer className="flex flex-col-reverse gap-2 border-t border-hairline bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-pill border border-hairline px-5 py-2.5 text-sm font-semibold text-ink-body transition hover:bg-surface-soft disabled:opacity-50">ยกเลิก</button>
            <button type="submit" disabled={saving} className="rounded-pill bg-brand-blue px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-blue-hover disabled:cursor-wait disabled:opacity-60">
              {saving ? 'กำลังบันทึก…' : record ? 'บันทึกการแก้ไข' : 'สร้างรายการ'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};
