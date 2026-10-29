import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImagePlus, Store } from 'lucide-react';
import { MerchantOnboardingDraft, merchantOnboardingMock } from '../../services/merchantOnboardingMock';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const MerchantStoreOnboarding: React.FC<{ merchantId: string }> = ({ merchantId }) => {
  const [draft, setDraft] = useState<MerchantOnboardingDraft>(() => merchantOnboardingMock.load(merchantId));
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    merchantOnboardingMock.save(merchantId, draft);
  }, [draft, merchantId]);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const checklist = useMemo(() => [
    { label: 'รูปหน้าร้าน', complete: Boolean(draft.photoName) },
    { label: 'คำอธิบายร้าน', complete: draft.description.trim().length >= 10 },
    { label: 'เวลาเปิด–ปิด', complete: Boolean(draft.openingTime && draft.closingTime) },
    { label: 'ช่องทางติดต่อ', complete: Boolean(draft.contact.trim()) },
  ], [draft]);
  const completeCount = checklist.filter((item) => item.complete).length;
  const progress = Math.round((completeCount / checklist.length) * 100);

  const selectPhoto = (file?: File) => {
    setPhotoError(null);
    if (!file) return;
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      setPhotoError('เลือกรูป JPG, PNG หรือ WebP');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('รูปต้องมีขนาดไม่เกิน 5 MB');
      return;
    }
    setPhotoPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
    setDraft((current) => ({ ...current, photoName: file.name }));
  };

  if (isDismissed) return <button type="button" onClick={() => setIsDismissed(false)} className="min-h-11 rounded-xl border border-brand-blue px-4 text-base font-semibold text-brand-blue">เปิด checklist แต่งร้าน ({progress}%)</button>;

  return <section className="space-y-4 rounded-2xl border border-brand-blue/20 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="store-onboarding-title">
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue"><Store aria-hidden="true" className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 id="store-onboarding-title" className="text-lg font-bold text-ink">แต่งร้านของคุณ</h2>
        <p className="mt-1 text-sm text-ink-muted">เติมข้อมูลให้ลูกค้ารู้จักร้านได้ง่ายขึ้น · ข้อความบันทึกในอุปกรณ์ รูปเป็นตัวอย่างและยังไม่อัปโหลด</p>
      </div>
        {progress < 100 && <span className="text-base font-bold text-brand-blue">{progress}%</span>}
    </div>
    {progress < 100 && <div role="progressbar" aria-label="ความคืบหน้าการแต่งร้าน" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-3 overflow-hidden rounded-full bg-surface-soft"><div className="h-full rounded-full bg-brand-blue transition-all" style={{ width: `${progress}%` }} /></div>}
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="รายการแต่งร้าน">
      {checklist.map((item) => <li key={item.label} className="flex items-center gap-2 text-sm text-ink-body">{item.complete ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-status-success" /> : <span aria-hidden="true" className="h-5 w-5 rounded-full border border-hairline" />}{item.label}</li>)}
    </ul>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <label htmlFor="store-photo" className="block text-base font-semibold text-ink">รูปหน้าร้าน</label>
        <label htmlFor="store-photo" className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-brand-blue px-4 text-base font-semibold text-brand-blue hover:bg-brand-blue-light focus-within:outline focus-within:outline-2 focus-within:outline-brand-blue"><ImagePlus aria-hidden="true" className="h-5 w-5" />{draft.photoName || 'เลือกรูป JPG, PNG หรือ WebP (ไม่เกิน 5 MB)'}</label>
        <input id="store-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { selectPhoto(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        {photoError && <p role="alert" className="text-sm text-status-error">{photoError}</p>}
        {photoPreview && <div className="relative mt-2 w-fit"><img src={photoPreview} alt="ตัวอย่างรูปหน้าร้าน" className="h-40 max-w-full rounded-xl border border-hairline object-cover" /><button type="button" onClick={() => { setDraft((current) => ({ ...current, photoName: '' })); setPhotoPreview(null); }} className="mt-2 min-h-11 rounded-lg px-3 text-base font-semibold text-status-error hover:bg-red-50">ลบรูป</button></div>}
      </div>
      <div className="space-y-1"><label htmlFor="store-description" className="block text-base font-semibold text-ink">คำอธิบายร้าน</label><textarea id="store-description" rows={3} maxLength={500} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-xl border border-hairline px-3 py-2 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue" placeholder="เล่าเกี่ยวกับสินค้าและบริการของร้าน" /></div>
      <fieldset className="space-y-1"><legend className="text-base font-semibold text-ink">เวลาเปิด–ปิด</legend><div className="grid grid-cols-2 gap-2"><label className="text-sm text-ink-body">เปิด<input aria-label="เวลาเปิดร้าน" type="time" value={draft.openingTime} onChange={(event) => setDraft((current) => ({ ...current, openingTime: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-hairline px-3 text-base" /></label><label className="text-sm text-ink-body">ปิด<input aria-label="เวลาปิดร้าน" type="time" value={draft.closingTime} onChange={(event) => setDraft((current) => ({ ...current, closingTime: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-hairline px-3 text-base" /></label></div></fieldset>
      <div className="space-y-1 md:col-span-2"><label htmlFor="store-contact" className="block text-base font-semibold text-ink">ช่องทางติดต่อ</label><input id="store-contact" value={draft.contact} onChange={(event) => setDraft((current) => ({ ...current, contact: event.target.value }))} className="min-h-11 w-full rounded-xl border border-hairline px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue" placeholder="โทรศัพท์, LINE หรือ Facebook" /></div>
    </div>
    {progress === 100 && <p role="status" className="text-sm font-semibold text-status-success">ข้อมูลแต่งร้านครบแล้ว</p>}
    <div className="flex justify-end"><button type="button" onClick={() => setIsDismissed(true)} className="min-h-11 rounded-xl px-4 text-base font-semibold text-ink-muted hover:bg-surface-soft">ข้ามไปทำทีหลัง</button></div>
  </section>;
};
