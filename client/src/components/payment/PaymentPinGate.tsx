import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePaymentPinStatus } from '../../hooks/usePaymentPinStatus';
import { useAuthStore } from '../../stores/authStore';
import { BankPinDialog } from './BankPinDialog';

const RESET_INTENT_KEY = 'thai-please:pin-reset-intent';
const RESET_USER_KEY = 'thai-please:pin-reset-user-id';
const RESET_RETURN_KEY = 'thai-please:pin-reset-return';

/**
 * Global PIN gate that:
 * 1. Prompts for mandatory PIN setup after sign-in if the citizen account does not have a PIN yet (mode="setup").
 * 2. Pops up directly into PIN reset mode (mode="reset") if the SAME user initiated a "Forgot PIN" re-login.
 * 3. Discards the reset intent if a DIFFERENT user logs in.
 */
export const PaymentPinGate = () => {
  const navigate = useNavigate();
  const status = usePaymentPinStatus();
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);

  const checkResetIntent = (): boolean => {
    const hasIntent = sessionStorage.getItem(RESET_INTENT_KEY) === '1';
    const targetUserId = sessionStorage.getItem(RESET_USER_KEY);
    if (!hasIntent) return false;

    // If the reset intent was bound to a specific user, verify that the logged-in user matches
    if (targetUserId && user?.id && user.id !== targetUserId) {
      // A different user logged in! Discard the reset intent immediately
      sessionStorage.removeItem(RESET_INTENT_KEY);
      sessionStorage.removeItem(RESET_USER_KEY);
      sessionStorage.removeItem(RESET_RETURN_KEY);
      sessionStorage.removeItem('thai-please:pending-checkout-qr');
      return false;
    }
    return true;
  };

  const [resetIntent, setResetIntent] = useState(checkResetIntent);

  // Re-check reset intent when token or user changes (e.g. after re-login or switching accounts)
  useEffect(() => {
    setResetIntent(checkResetIntent());
  }, [token, user?.id]);

  const handleResetSuccess = () => {
    sessionStorage.removeItem(RESET_INTENT_KEY);
    sessionStorage.removeItem(RESET_USER_KEY);
    setResetIntent(false);
    const returnPath = sessionStorage.getItem(RESET_RETURN_KEY);
    sessionStorage.removeItem(RESET_RETURN_KEY);
    if (returnPath) {
      navigate(returnPath, { replace: true });
    }
  };

  const handleCloseReset = () => {
    sessionStorage.removeItem(RESET_INTENT_KEY);
    sessionStorage.removeItem(RESET_USER_KEY);
    sessionStorage.removeItem(RESET_RETURN_KEY);
    setResetIntent(false);
  };

  if (!status.isPaymentCitizen) {
    return null;
  }

  const isReset = resetIntent;
  const isSetup = !isReset && status.data?.isSet === false;
  const mustOpen = isReset || isSetup;

  return (
    <BankPinDialog
      key={`${token}-${isReset ? 'reset' : 'setup'}`}
      open={mustOpen}
      mode={isReset ? 'reset' : 'setup'}
      mandatory={!isReset}
      onClose={isReset ? handleCloseReset : undefined}
      onSuccess={handleResetSuccess}
    />
  );
};
