import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Settings } from 'lucide-react';
import { BankPinDialog } from './BankPinDialog';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES } from '../../constants/routes';

/** Set before the forced re-login so the wallet reopens straight into the reset form. */
const RESET_INTENT_KEY = 'thai-please:pin-reset-intent';

export const WalletSecuritySettings = () => {
  const navigate = useNavigate();
  const clearAuth = useAuthStore(state => state.clearAuth);
  const hasResetIntent = () => sessionStorage.getItem(RESET_INTENT_KEY) === '1';
  const [open, setOpen] = useState(hasResetIntent);
  const isReset = hasResetIntent();

  const close = () => {
    sessionStorage.removeItem(RESET_INTENT_KEY);
    const returnPath = sessionStorage.getItem('thai-please:pin-reset-return');
    sessionStorage.removeItem('thai-please:pin-reset-return');
    setOpen(false);
    if (returnPath) {
      navigate(returnPath, { replace: true });
    }
  };

  // Forgot PIN: prove identity again with the account login, then set a new PIN without the old one.
  const reLoginForReset = () => {
    sessionStorage.setItem(RESET_INTENT_KEY, '1');
    clearAuth();
    navigate(APP_ROUTES.LOGIN, { replace: true, state: { from: { pathname: APP_ROUTES.CITIZEN_WALLET } } });
  };

  return (
    <>
      <button
        id="btn-wallet-security"
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-hairline bg-white px-4 py-3 text-left text-ink-muted transition hover:bg-surface-soft"
      >
        <Settings className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-xs sm:text-sm">ตั้งค่าความปลอดภัย</span>
        <ChevronRight className="h-4 w-4 shrink-0" />
      </button>

      {/* Standalone Bank-style PIN Dialog for Change / Reset */}
      <BankPinDialog
        open={open}
        mode={isReset ? 'reset' : 'change'}
        onClose={close}
        onSuccess={() => {
          if (isReset) sessionStorage.removeItem(RESET_INTENT_KEY);
          close();
        }}
        onForgot={reLoginForReset}
      />
    </>
  );
};
