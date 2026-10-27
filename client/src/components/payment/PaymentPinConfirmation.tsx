import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Delete, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';

interface Props {
  open: boolean;
  amount: number;
  shopName: string;
  isPending: boolean;
  error: string | null;
  lockedUntil?: string | null;
  onConfirm: (pin: string) => void;
  onClose: () => void;
  onEdit: () => void;
}

/** Separate, full-screen payment authorization; the six digits never enter the review form. */
export const PaymentPinConfirmation = ({ open, amount, shopName, isPending, error, lockedUntil, onConfirm, onClose, onEdit }: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitted = useRef(false);
  const [digits, setDigits] = useState('');
  const [now, setNow] = useState(Date.now());
  const secondsLocked = Math.max(0, Math.ceil(((lockedUntil ? new Date(lockedUntil).getTime() : 0) - now) / 1000));
  const disabled = isPending || secondsLocked > 0;

  useEffect(() => {
    const element = dialog.current;
    setDigits(''); submitted.current = false; setNow(Date.now());
    if (!open) { element?.close(); return; }
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (!isPending && error) { setDigits(''); submitted.current = false; }
  }, [isPending, error]);

  useEffect(() => {
    if (!open || !lockedUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open, lockedUntil]);

  const enterDigit = (digit: string) => {
    if (disabled || submitted.current || digits.length >= 6) return;
    onEdit();
    const next = digits + digit;
    setDigits(next);
    if (next.length === 6) {
      submitted.current = true;
      onConfirm(next);
    }
  };
  const removeDigit = () => {
    if (disabled || submitted.current) return;
    onEdit(); setDigits(value => value.slice(0, -1));
  };
  const close = () => { if (!isPending && !submitted.current) onClose(); };

  return <dialog ref={dialog} id="payment-pin-confirmation" aria-labelledby="payment-pin-confirmation-title"
    onCancel={event => { event.preventDefault(); close(); }}
    onKeyDown={event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^\d$/.test(event.key)) { event.preventDefault(); enterDigit(event.key); }
      else if (event.key === 'Backspace') { event.preventDefault(); removeDigit(); }
    }}
    className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-y-auto border-0 bg-white p-0 font-sans text-ink">
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-6 pb-5 pt-4">
      <header className="flex h-12 shrink-0 items-center justify-between">
        <button type="button" onClick={close} disabled={isPending || digits.length === 6} aria-label="กลับไปตรวจสอบยอดชำระ"
          className="flex items-center gap-1.5 rounded-full py-2 pr-3 text-sm text-ink-muted disabled:opacity-40">
          <ArrowLeft className="h-5 w-5" />กลับ
        </button>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-blue"><ShieldCheck className="h-4 w-4" />THAI Please</span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center pb-4 pt-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue"><LockKeyhole className="h-6 w-6" /></div>
        <h1 id="payment-pin-confirmation-title" className="text-xl font-bold">กรอกรหัส PIN</h1>
        <p className="mt-1.5 text-sm text-ink-muted">เพื่อยืนยันการชำระเงิน</p>
        <p className="mt-4 font-mono text-3xl font-bold tracking-tight">฿{amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p className="mt-1 max-w-full truncate text-sm text-ink-muted">ให้ {shopName}</p>

        <div role="status" aria-label={`กรอกรหัสแล้ว ${digits.length} จาก 6 หลัก`} className="mt-7 flex items-center gap-4">
          {Array.from({ length: 6 }, (_, index) => <span key={index} aria-hidden="true"
            className={`h-3.5 w-3.5 rounded-full border-2 transition-colors ${index < digits.length ? 'border-brand-blue bg-brand-blue' : 'border-slate-300 bg-white'}`} />)}
        </div>
        <div className="mt-4 flex min-h-12 items-center justify-center text-xs leading-relaxed" aria-live="polite">
          {isPending ? <p className="flex items-center gap-2 text-brand-blue"><RefreshCw className="h-4 w-4 animate-spin" />กำลังยืนยันการชำระเงิน...</p>
            : secondsLocked > 0 ? <p role="alert" className="text-status-error">กรอก PIN ผิดครบ 5 ครั้ง<br />ลองใหม่ได้ใน {Math.floor(secondsLocked / 60).toString().padStart(2, '0')}:{(secondsLocked % 60).toString().padStart(2, '0')} นาที</p>
              : error ? <p role="alert" className="text-status-error">{error}</p>
                : <p className="text-ink-muted">ระบบจะยืนยันเมื่อกรอกครบ 6 หลัก</p>}
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-xs shrink-0 grid-cols-3 gap-x-5 gap-y-2 pb-3" aria-label="แป้นตัวเลข PIN">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => <button key={digit} type="button" data-pin-digit={digit} aria-label={`เลข ${digit}`} disabled={disabled || digits.length === 6}
          onClick={() => enterDigit(digit)} className="h-14 rounded-2xl text-2xl font-medium transition hover:bg-blue-50 active:bg-blue-100 disabled:opacity-30">{digit}</button>)}
        <span aria-hidden="true" />
        <button type="button" data-pin-digit="0" aria-label="เลข 0" disabled={disabled || digits.length === 6} onClick={() => enterDigit('0')}
          className="h-14 rounded-2xl text-2xl font-medium transition hover:bg-blue-50 active:bg-blue-100 disabled:opacity-30">0</button>
        <button type="button" aria-label="ลบตัวเลขล่าสุด" disabled={disabled || digits.length === 6} onClick={removeDigit}
          className="flex h-14 items-center justify-center rounded-2xl text-ink-muted transition hover:bg-blue-50 disabled:opacity-30"><Delete className="h-6 w-6" /></button>
      </div>
      <p className="pb-[env(safe-area-inset-bottom)] text-center text-[11px] text-ink-muted">อย่าบอกรหัส PIN ของคุณกับผู้อื่น</p>
    </div>
  </dialog>;
};
