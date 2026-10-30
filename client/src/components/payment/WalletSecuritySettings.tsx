import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Settings } from 'lucide-react';
import { BankPinDialog } from './BankPinDialog';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES } from '../../constants/routes';

const RESET_INTENT_KEY = 'thai-please:pin-reset-intent';
const RESET_USER_KEY = 'thai-please:pin-reset-user-id';
const RESET_RETURN_KEY = 'thai-please:pin-reset-return';

export const WalletSecuritySettings = () => {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [open, setOpen] = useState(false);

  // Forgot PIN: prove identity again with the account login, then global PaymentPinGate handles reset
  const reLoginForReset = () => {
    sessionStorage.setItem(RESET_INTENT_KEY, '1');
    if (user?.id) {
      sessionStorage.setItem(RESET_USER_KEY, user.id);
    }
    sessionStorage.setItem(RESET_RETURN_KEY, window.location.pathname);
    setOpen(false);
    clearAuth();
    navigate(APP_ROUTES.LOGIN, {
      replace: true,
      state: { from: { pathname: window.location.pathname } },
    });
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

      {/* Standalone Bank-style PIN Dialog for Change */}
      <BankPinDialog
        open={open}
        mode="change"
        onClose={() => setOpen(false)}
        onSuccess={() => setOpen(false)}
        onForgot={reLoginForReset}
      />
    </>
  );
};
