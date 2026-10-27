import React, { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, LoaderCircle, Pencil, Plus, Tags, X } from 'lucide-react';
import {
  ConditionTypeRecord,
  ConditionTypeStatus,
  ConditionTypeUnit,
  gamificationApi,
} from '../../../services/admin/gamificationApi';
import { adminGamificationErrorMessage } from './adminGamificationError';

interface Props {
  onClose: () => void;
}

const conditionTypeQueryKey = ['admin', 'gamification', 'condition-types'];
const statusLabels: Record<ConditionTypeStatus, string> = {
  pending: 'รอพัฒนา',
  in_progress: 'กำลังพัฒนา',
  ready: 'พร้อมใช้งาน',
};
const unitLabels: Record<ConditionTypeUnit, string> = {
  count: 'จำนวนครั้ง',
  amount: 'จำนวนเงิน',
  other: 'อื่น ๆ',
};
const statusStyles: Record<ConditionTypeStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-800',
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};
const inputClass = 'w-full rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-brand-blue focus:ring-4 focus:ring-blue-100 disabled:bg-surface-soft';

const emptyForm = () => ({
  conditionKey: '',
  displayName: '',
  description: '',
  measurementUnit: 'count' as ConditionTypeUnit,
  implementationStatus: 'pending' as ConditionTypeStatus,
});

export const ConditionTypeManagementPanel: React.FC<Props> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const panelRef = useRef<HTMLElement>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ConditionTypeStatus>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: conditionTypeQueryKey,
    queryFn: () => gamificationApi.conditionTypes(),
  });
  const records = query.data ?? [];
  const filteredRecords = statusFilter === 'all'
    ? records
    : records.filter((condition) => condition.implementationStatus === statusFilter);
  const editingRecord = records.find((condition) => condition.id === editingId) ?? null;

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => editingId
      ? gamificationApi.updateConditionType(editingId, payload)
      : gamificationApi.createConditionType(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: conditionTypeQueryKey });
      setNotice(editingId ? 'บันทึกการแก้ไขประเภทเงื่อนไขแล้ว' : 'เพิ่มประเภทเงื่อนไขแล้ว โดยตั้งสถานะรอพัฒนา');
      setError('');
      if (!editingId) setForm(emptyForm());
    },
    onError: (failure) => {
      setError(adminGamificationErrorMessage(failure, 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง'));
      setNotice('');
    },
  });

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), button:not([disabled])')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const beginCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setNotice('');
  };

  const beginEdit = (condition: ConditionTypeRecord) => {
    setEditingId(condition.id);
    setForm({
      conditionKey: condition.key,
      displayName: condition.displayName,
      description: condition.description ?? '',
      measurementUnit: condition.measurementUnit,
      implementationStatus: condition.implementationStatus,
    });
    setError('');
    setNotice('');
    panelRef.current?.querySelector<HTMLElement>('#condition-display-name')?.focus();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const payload: Record<string, unknown> = {
      displayName: form.displayName.trim(),
      description: form.description.trim() || null,
      measurementUnit: form.measurementUnit,
    };
    if (editingId) {
      payload.implementationStatus = form.implementationStatus;
    } else {
      payload.conditionKey = form.conditionKey.trim();
    }
    mutation.mutate(payload);
  };

  const trapKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    event.stopPropagation();
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? []);
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

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/45 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="condition-types-title"
        onKeyDownCapture={trapKeyboard}
        className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-hairline bg-surface-soft shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-hairline bg-white px-5 py-4 sm:px-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-pill border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold text-brand-blue"><Tags className="h-3.5 w-3.5" /> ระบบเหรียญตรา</div>
            <h2 id="condition-types-title" className="mt-2 text-xl font-bold text-ink">จัดการประเภทเงื่อนไข</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">บันทึกชื่อและรายละเอียดของเงื่อนไข ส่วนตัวประมวลผลต้องพัฒนาและลงทะเบียนในระบบหลังบ้านโดยนักพัฒนา</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิดหน้าจัดการประเภทเงื่อนไข" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline text-ink-muted hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"><X className="h-4 w-4" aria-hidden="true" /></button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-labelledby="condition-list-title" className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 id="condition-list-title" className="text-base font-bold text-ink">ประเภทเงื่อนไขทั้งหมด</h3>
                <p className="mt-1 text-xs text-ink-muted">{records.length.toLocaleString('th-TH')} รายการ</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="sr-only" htmlFor="condition-status-filter">กรองตามสถานะการพัฒนา</label>
                <select id="condition-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ConditionTypeStatus)} className={`${inputClass} min-h-10 w-auto min-w-40`}>
                  <option value="all">ทุกสถานะการพัฒนา</option>
                  <option value="pending">รอพัฒนา</option>
                  <option value="in_progress">กำลังพัฒนา</option>
                  <option value="ready">พร้อมใช้งาน</option>
                </select>
                <button type="button" onClick={beginCreate} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-pill bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"><Plus className="h-4 w-4" />เพิ่มประเภทเงื่อนไข</button>
              </div>
            </div>

            {notice && <p role="status" aria-live="polite" className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm font-medium text-emerald-800"><Check className="h-4 w-4 shrink-0" />{notice}</p>}
            {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-status-error">{error}</p>}

            {query.isLoading ? (
              <div role="status" aria-live="polite" className="flex min-h-48 items-center justify-center gap-2 text-sm text-ink-muted"><LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />กำลังโหลดประเภทเงื่อนไข</div>
            ) : query.isError ? (
              <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
                <p className="text-sm font-semibold text-status-error">โหลดข้อมูลไม่สำเร็จ</p>
                <button type="button" onClick={() => void query.refetch()} className="mt-3 min-h-10 rounded-pill border border-red-200 bg-white px-4 text-sm font-semibold text-status-error hover:bg-red-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100">ลองอีกครั้ง</button>
              </div>
            ) : filteredRecords.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-dashed border-hairline bg-white px-4 py-12 text-center text-sm text-ink-muted">ไม่พบประเภทเงื่อนไขในสถานะนี้</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {filteredRecords.map((condition) => (
                  <li key={condition.id} className={`rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] ${editingId === condition.id ? 'border-brand-blue ring-2 ring-blue-100' : 'border-hairline'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-bold text-ink">{condition.displayName}</h4>
                        <code translate="no" className="mt-1 inline-block break-all rounded-md bg-surface-soft px-2 py-1 text-xs text-ink-body">{condition.key}</code>
                      </div>
                      <button type="button" onClick={() => beginEdit(condition)} aria-label={`แก้ไข ${condition.displayName}`} className="inline-flex min-h-10 items-center gap-2 rounded-pill border border-hairline px-3 text-xs font-semibold text-ink-body hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />แก้ไข</button>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink-muted">{condition.description || 'ยังไม่มีคำอธิบาย'}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-pill border px-2.5 py-1 text-[11px] font-semibold ${statusStyles[condition.implementationStatus]}`}>{statusLabels[condition.implementationStatus]}</span>
                      <span className={`rounded-pill border px-2.5 py-1 text-[11px] font-semibold ${condition.handlerRegistered ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{condition.handlerRegistered ? 'ระบบหลังบ้านรองรับแล้ว' : 'รอพัฒนาระบบหลังบ้าน'}</span>
                      <span className="rounded-pill border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-ink-muted">หน่วยวัด: {unitLabels[condition.measurementUnit]}</span>
                    </div>
                    <p className="mt-3 border-t border-hairline pt-3 text-xs text-ink-muted">{condition.badge ? <>ใช้กับเหรียญตรา: <span className="font-semibold text-ink-body">{condition.badge.name}</span></> : 'ยังไม่มีเหรียญตราที่ใช้เงื่อนไขนี้'}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="border-t border-hairline bg-white p-4 sm:p-6 lg:border-l lg:border-t-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-ink">{editingRecord ? 'แก้ไขประเภทเงื่อนไข' : 'เพิ่มประเภทเงื่อนไข'}</h3>
                <p className="mt-1 text-xs leading-5 text-ink-muted">การเพิ่มข้อมูลจะไม่สร้างหรือเรียกใช้โค้ดระบบหลังบ้าน</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="condition-key" className="block text-sm font-semibold text-ink">รหัสเงื่อนไข</label>
                <input id="condition-key" autoComplete="off" required minLength={2} maxLength={50} pattern="[a-z][a-z0-9_]{1,49}" disabled={Boolean(editingId) || mutation.isPending} value={form.conditionKey} onChange={(event) => setForm((current) => ({ ...current, conditionKey: event.target.value }))} className={inputClass} placeholder="เช่น merchant_visit_count" />
                <p className="text-xs leading-5 text-ink-muted">ใช้ตัวพิมพ์เล็ก ตัวเลข และขีดล่าง รหัสเปลี่ยนไม่ได้หลังสร้าง</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="condition-display-name" className="block text-sm font-semibold text-ink">ชื่อเงื่อนไข</label>
                <input id="condition-display-name" required minLength={2} maxLength={100} disabled={mutation.isPending} value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} className={inputClass} placeholder="เช่น จำนวนครั้งที่ใช้บริการร้านค้า" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="condition-description" className="block text-sm font-semibold text-ink">คำอธิบาย</label>
                <textarea id="condition-description" rows={3} maxLength={1000} disabled={mutation.isPending} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={`${inputClass} resize-y`} placeholder="อธิบายข้อมูลที่ใช้วัดเงื่อนไขนี้" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="condition-unit" className="block text-sm font-semibold text-ink">หน่วยวัด</label>
                <select id="condition-unit" disabled={mutation.isPending} value={form.measurementUnit} onChange={(event) => setForm((current) => ({ ...current, measurementUnit: event.target.value as ConditionTypeUnit }))} className={inputClass}>
                  <option value="count">จำนวนครั้ง</option>
                  <option value="amount">จำนวนเงิน</option>
                  <option value="other">อื่น ๆ</option>
                </select>
              </div>
              {editingRecord && (
                <div className="space-y-1.5">
                  <label htmlFor="condition-implementation-status" className="block text-sm font-semibold text-ink">สถานะการพัฒนา</label>
                  <select id="condition-implementation-status" disabled={mutation.isPending} value={form.implementationStatus} onChange={(event) => setForm((current) => ({ ...current, implementationStatus: event.target.value as ConditionTypeStatus }))} className={inputClass}>
                    <option value="pending">รอพัฒนา</option>
                    <option value="in_progress">กำลังพัฒนา</option>
                    <option value="ready" disabled={!editingRecord.handlerRegistered}>พร้อมใช้งาน</option>
                  </select>
                  {!editingRecord.handlerRegistered && <p className="text-xs leading-5 text-amber-800">ยังไม่มีตัวประมวลผลที่ลงทะเบียนไว้ จึงตั้งสถานะพร้อมใช้งานไม่ได้</p>}
                </div>
              )}
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-status-error">{error}</p>}
              <div className="flex flex-col gap-2 pt-1">
                <button type="submit" disabled={mutation.isPending || (Boolean(editingId) && form.implementationStatus === 'ready' && !editingRecord?.handlerRegistered)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-pill bg-brand-blue px-4 text-sm font-semibold text-white hover:bg-brand-blue-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-wait disabled:opacity-50">
                  {mutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                  {mutation.isPending ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มประเภทเงื่อนไข'}
                </button>
                {editingId && <button type="button" onClick={beginCreate} disabled={mutation.isPending} className="min-h-10 rounded-pill border border-hairline px-4 text-sm font-semibold text-ink-body hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">ยกเลิกการแก้ไข</button>}
              </div>
            </form>
          </aside>
        </div>
      </section>
    </div>
  );
};
