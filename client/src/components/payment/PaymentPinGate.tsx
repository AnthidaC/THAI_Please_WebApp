import { useEffect, useRef } from 'react';
import { LockKeyhole } from 'lucide-react';
import { usePaymentPinStatus } from '../../hooks/usePaymentPinStatus';
import { useAuthStore } from '../../stores/authStore';
import { PaymentPinSettings } from './PaymentPinSettings';

/** Runs after any successful sign-in without changing the login/register flows. */
export const PaymentPinGate = () => {
  const dialog = useRef<HTMLDialogElement>(null);
  const status = usePaymentPinStatus();
  const { token, clearAuth } = useAuthStore();
  const mustOpen = status.isPaymentCitizen && (status.data?.isSet === false || status.isError);
  useEffect(() => {
    const element = dialog.current;
    if (mustOpen && element && !element.open) element.showModal();
    else if (!mustOpen && element?.open) element.close();
    if (!mustOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mustOpen]);
  return <dialog ref={dialog} aria-labelledby="payment-pin-gate-title" aria-describedby="payment-pin-gate-description"
    onCancel={event => event.preventDefault()}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-3xl border-0 bg-white p-5 text-ink shadow-2xl backdrop:bg-slate-950/50 sm:p-6">
    <div className="mb-4 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue"><LockKeyhole className="h-6 w-6" /></div>
      <h1 id="payment-pin-gate-title" className="text-lg font-bold">{status.isError ? 'ตรวจสอบรหัส PIN ไม่สำเร็จ' : 'ตั้งรหัส PIN ก่อนเริ่มใช้งาน'}</h1>
      <p id="payment-pin-gate-description" className="mt-2 text-sm leading-relaxed text-ink-muted">{status.isError ? 'กรุณาลองตรวจสอบอีกครั้ง หรือเข้าสู่ระบบใหม่' : 'บัญชีของคุณยังไม่มีรหัส PIN กรุณาตั้งรหัส 6 หลักเพื่อใช้ยืนยันการชำระเงิน'}</p>
    </div>
    <PaymentPinSettings key={token} setupOnly autoFocus />
    <button type="button" onClick={clearAuth} className="mx-auto mt-4 block rounded-full px-4 py-2 text-xs text-ink-muted underline">ออกจากระบบ</button>
  </dialog>;
};
