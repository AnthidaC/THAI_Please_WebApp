import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, KeyRound, Settings, X } from 'lucide-react';
import { PaymentPinSettings } from './PaymentPinSettings';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES } from '../../constants/routes';

/** Set before the forced re-login so the wallet reopens straight into the reset form. */
const RESET_INTENT_KEY = 'thai-please:pin-reset-intent';
type View = 'change' | 'forgot' | 'reset';

export const WalletSecuritySettings = () => {
  const navigate = useNavigate();
  const clearAuth = useAuthStore(state => state.clearAuth);
  const hasResetIntent = () => sessionStorage.getItem(RESET_INTENT_KEY) === '1';
  const [open, setOpen] = useState(hasResetIntent);
  const [view, setView] = useState<View>(() => (hasResetIntent() ? 'reset' : 'change'));
  const [isSaving, setIsSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!open) { element?.close(); return; }
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, [open]);

  const close = () => {
    if (isSaving) return;
    sessionStorage.removeItem(RESET_INTENT_KEY);
    setOpen(false); setView('change');
  };
  // Forgot PIN = prove identity again with the account login, then set a new PIN without the old one.
  const reLoginForReset = () => {
    sessionStorage.setItem(RESET_INTENT_KEY, '1');
    clearAuth();
    navigate(APP_ROUTES.LOGIN, { replace: true, state: { from: { pathname: APP_ROUTES.CITIZEN_WALLET } } });
  };

  return <>
    <button id="btn-wallet-security" type="button" aria-haspopup="dialog" onClick={() => { setView('change'); setOpen(true); }}
      className="flex w-full items-center gap-3 rounded-2xl border border-hairline bg-white px-4 py-3 text-left text-ink-muted transition hover:bg-surface-soft">
      <Settings className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-xs sm:text-sm">ตั้งค่าความปลอดภัย</span>
      <ChevronRight className="h-4 w-4 shrink-0" />
    </button>
    <dialog ref={dialog} id="wallet-security-settings" aria-labelledby="wallet-security-title"
      onCancel={event => { event.preventDefault(); close(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-3xl border-0 bg-white p-5 text-ink shadow-2xl backdrop:bg-slate-950/40 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 id="wallet-security-title" className="text-base font-semibold">ความปลอดภัยกระเป๋าเงิน</h2>
        <button type="button" aria-label="ปิดการตั้งค่าความปลอดภัย" disabled={isSaving} onClick={close}
          className="rounded-full p-2 text-ink-muted transition hover:bg-surface-soft disabled:opacity-40"><X className="h-4 w-4" /></button>
      </header>
      {open && view === 'forgot' && <section id="forgot-pin-panel" className="space-y-4 rounded-card border border-hairline p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4 text-brand-blue" />ลืมรหัส PIN</div>
        <p className="text-xs leading-relaxed text-ink-muted">
          เพื่อความปลอดภัยของเงินในกระเป๋า ระบบจะให้คุณเข้าสู่ระบบใหม่อีกครั้งเพื่อยืนยันตัวตน
          จากนั้นจะพากลับมาที่หน้านี้เพื่อตั้งรหัส PIN ใหม่ได้ทันทีโดยไม่ต้องใช้ PIN เดิม
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" id="btn-forgot-pin-relogin" onClick={reLoginForReset}
            className="rounded-full bg-brand-blue px-5 py-2 text-sm text-white">เข้าสู่ระบบใหม่เพื่อตั้ง PIN</button>
          <button type="button" onClick={() => setView('change')} className="text-xs text-ink-muted underline">กลับ</button>
        </div>
      </section>}
      {open && view !== 'forgot' && <PaymentPinSettings key={view} startEditing autoFocus resetMode={view === 'reset'}
        onPendingChange={setIsSaving} onForgot={view === 'reset' ? reLoginForReset : () => setView('forgot')}
        onResetDone={() => sessionStorage.removeItem(RESET_INTENT_KEY)} />}
    </dialog>
  </>;
};
