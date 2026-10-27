import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, RefreshCw } from 'lucide-react';
import { setPaymentPin } from '../../services/paymentApi';
import { usePaymentPinStatus } from '../../hooks/usePaymentPinStatus';
import { useAuthStore } from '../../stores/authStore';

export const PaymentPinSettings = ({ setupOnly = false, autoFocus = false }: { setupOnly?: boolean; autoFocus?: boolean }) => {
  const client = useQueryClient();
  const status = usePaymentPinStatus();
  const token = useAuthStore(state => state.token);
  const [editing, setEditing] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState('');
  const save = useMutation({
    mutationFn: () => setPaymentPin({ pin, confirmPin, ...(status.data?.isSet ? { currentPin } : {}) }),
    onSuccess: async () => {
      setCurrentPin(''); setPin(''); setConfirmPin(''); setEditing(false);
      setMessage('บันทึกรหัส PIN สำเร็จ');
      await client.invalidateQueries({ queryKey: ['payment-pin-status'] });
    },
  });
  useEffect(() => {
    setEditing(false); setCurrentPin(''); setPin(''); setConfirmPin(''); setMessage(''); save.reset();
  }, [token]);
  if (setupOnly && status.data?.isSet) return null;
  const fields = [
    ...(status.data?.isSet ? [{ label: 'PIN ปัจจุบัน', value: currentPin, set: setCurrentPin, autocomplete: 'current-password' }] : []),
    { label: 'PIN ใหม่ (6 หลัก)', value: pin, set: setPin, autocomplete: 'new-password' },
    { label: 'ยืนยัน PIN ใหม่', value: confirmPin, set: setConfirmPin, autocomplete: 'new-password' },
  ];
  return (
    <section className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4 text-brand-blue" />รหัส PIN ชำระเงิน</h2>
        {status.data?.isSet && !setupOnly && <button type="button" onClick={() => {
          setEditing(!editing); setMessage(''); save.reset(); setCurrentPin(''); setPin(''); setConfirmPin('');
        }} className="rounded-full border border-hairline px-3 py-1.5 text-xs">{editing ? 'ยกเลิก' : 'เปลี่ยน PIN'}</button>}
      </div>
      {status.isPending ? <p className="text-xs text-ink-muted">กำลังตรวจสอบรหัส PIN...</p> : status.isError ? (
        <div role="alert" className="text-xs text-status-error">ตรวจสอบรหัส PIN ไม่สำเร็จ <button type="button" onClick={() => status.refetch()} className="underline">ลองใหม่</button></div>
      ) : <>
        <p className="text-xs text-ink-muted">{status.data.isSet ? 'ตั้งรหัส PIN แล้ว ใช้ยืนยันก่อนชำระเงินทุกครั้ง' : 'ตั้งรหัส PIN 6 หลักก่อนชำระเงินครั้งแรก'}</p>
        {(!status.data.isSet || editing) && <form className="space-y-3" onSubmit={event => {
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
          {save.isError && <p role="alert" className="text-xs text-status-error">{(save.error as any).response?.data?.message || 'บันทึก PIN ไม่สำเร็จ กรุณาลองใหม่'}</p>}
          <button type="submit" disabled={save.isPending || pin.length !== 6 || pin !== confirmPin || (status.data.isSet && currentPin.length !== 6)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-5 py-2 text-sm text-white disabled:opacity-50">
            {save.isPending && <RefreshCw className="h-4 w-4 animate-spin" />}บันทึก PIN
          </button>
        </form>}
      </>}
      {message && <p role="status" className="text-xs text-status-success">{message}</p>}
    </section>
  );
};
