import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, RefreshCw } from 'lucide-react';
import { setPaymentPin, resetPaymentPin } from '../../services/paymentApi';
import { usePaymentPinStatus } from '../../hooks/usePaymentPinStatus';
import { useAuthStore } from '../../stores/authStore';

export const PaymentPinSettings = ({ setupOnly = false, autoFocus = false, startEditing = false, resetMode = false, onPendingChange, onForgot, onResetDone }: {
  setupOnly?: boolean; autoFocus?: boolean; startEditing?: boolean;
  /** Forgot-PIN flow: set a new PIN without the current one (server requires a fresh sign-in). */
  resetMode?: boolean;
  onPendingChange?: (pending: boolean) => void;
  /** Shown as "ลืม PIN?" while changing PIN, and as re-login action when the reset needs re-auth. */
  onForgot?: () => void;
  onResetDone?: () => void;
}) => {
  const client = useQueryClient();
  const status = usePaymentPinStatus();
  const token = useAuthStore(state => state.token);
  const [editing, setEditing] = useState(startEditing || resetMode);
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState('');
  const needsCurrentPin = Boolean(status.data?.isSet) && !resetMode;
  const save = useMutation({
    mutationFn: () => resetMode
      ? resetPaymentPin({ pin, confirmPin })
      : setPaymentPin({ pin, confirmPin, ...(needsCurrentPin ? { currentPin } : {}) }),
    onSuccess: async () => {
      setCurrentPin(''); setPin(''); setConfirmPin(''); setEditing(false);
      setMessage(resetMode ? 'ตั้งรหัส PIN ใหม่สำเร็จ' : 'บันทึกรหัส PIN สำเร็จ');
      await client.invalidateQueries({ queryKey: ['payment-pin-status'] });
      if (resetMode) onResetDone?.();
    },
  });
  useEffect(() => {
    setEditing(startEditing || resetMode); setCurrentPin(''); setPin(''); setConfirmPin(''); setMessage(''); save.reset();
  }, [token, startEditing, resetMode]);
  useEffect(() => { onPendingChange?.(save.isPending); }, [save.isPending, onPendingChange]);
  if (setupOnly && status.data?.isSet) return null;
  const fields = [
    ...(needsCurrentPin ? [{ label: 'PIN ปัจจุบัน', value: currentPin, set: setCurrentPin, autocomplete: 'current-password' }] : []),
    { label: 'PIN ใหม่ (6 หลัก)', value: pin, set: setPin, autocomplete: 'new-password' },
    { label: 'ยืนยัน PIN ใหม่', value: confirmPin, set: setConfirmPin, autocomplete: 'new-password' },
  ];
  const errorCode = (save.error as any)?.response?.data?.code as string | undefined;
  const showForm = resetMode ? editing : (!status.data?.isSet || editing);
  return (
    <section className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-brand-blue" />{resetMode ? 'ตั้งรหัส PIN ใหม่' : 'รหัส PIN ชำระเงิน'}</h2>
        {status.data?.isSet && !setupOnly && !resetMode && <button type="button" onClick={() => {
          setEditing(!editing); setMessage(''); save.reset(); setCurrentPin(''); setPin(''); setConfirmPin('');
        }} className="rounded-full border border-hairline px-3 py-1.5 text-xs">{editing ? 'ยกเลิก' : 'เปลี่ยน PIN'}</button>}
      </div>
      {status.isPending ? <p className="text-xs text-ink-muted">กำลังตรวจสอบรหัส PIN...</p> : status.isError ? (
        <div role="alert" className="text-xs text-status-error">ตรวจสอบรหัส PIN ไม่สำเร็จ <button type="button" onClick={() => status.refetch()} className="underline">ลองใหม่</button></div>
      ) : <>
        <p className="text-xs text-ink-muted">{resetMode
          ? 'ยืนยันตัวตนด้วยการเข้าสู่ระบบแล้ว ตั้งรหัส PIN 6 หลักใหม่ได้เลย (ไม่ต้องใช้ PIN เดิม)'
          : status.data.isSet ? 'ตั้งรหัส PIN แล้ว ใช้ยืนยันก่อนชำระเงินทุกครั้ง' : 'ตั้งรหัส PIN 6 หลักก่อนชำระเงินครั้งแรก'}</p>
        {showForm && <form className="space-y-3" onSubmit={event => {
          event.preventDefault(); setMessage(''); save.mutate();
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field, index) => <label key={field.label} className="block text-xs font-medium">{field.label}
              <input aria-label={field.label} type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete={field.autocomplete}
                value={field.value} onChange={event => field.set(event.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={save.isPending} autoFocus={autoFocus && index === 0} className="mt-1 block w-full rounded-full border border-hairline px-4 py-2 font-mono tracking-widest" />
            </label>)}
          </div>
          {pin.length === 6 && confirmPin.length === 6 && pin !== confirmPin && <p role="alert" className="text-xs text-status-error">รหัส PIN ทั้งสองช่องไม่ตรงกัน</p>}
          {save.isError && <p role="alert" className="text-xs text-status-error">{(save.error as any).response?.data?.message || 'บันทึก PIN ไม่สำเร็จ กรุณาลองใหม่'}
            {errorCode === 'REAUTH_REQUIRED' && onForgot && <> <button type="button" onClick={onForgot} className="underline">เข้าสู่ระบบใหม่</button></>}
          </p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="submit" disabled={save.isPending || pin.length !== 6 || pin !== confirmPin || (needsCurrentPin && currentPin.length !== 6)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-5 py-2 text-sm text-white disabled:opacity-50">
              {save.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}บันทึก PIN
            </button>
            {needsCurrentPin && !setupOnly && onForgot && <button type="button" id="btn-forgot-pin" onClick={onForgot} disabled={save.isPending}
              className="text-xs text-brand-blue underline disabled:opacity-50">ลืม PIN?</button>}
          </div>
        </form>}
      </>}
      {message && <p role="status" className="text-xs text-status-success">{message}</p>}
    </section>
  );
};
