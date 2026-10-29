import { usePaymentPinStatus } from '../../hooks/usePaymentPinStatus';
import { useAuthStore } from '../../stores/authStore';
import { BankPinDialog } from './BankPinDialog';

/**
 * Mandatory initial PIN setup gate that runs after sign-in if the citizen account does not have a PIN yet.
 * Uses the standalone bank-style PIN interface (dots + keypad), matching payment confirmation.
 */
export const PaymentPinGate = () => {
  const status = usePaymentPinStatus();
  const token = useAuthStore(state => state.token);

  // Open only when the server confirms there is no PIN for a payment citizen.
  const mustOpen = status.isPaymentCitizen && status.data?.isSet === false;

  return (
    <BankPinDialog
      key={token}
      open={mustOpen}
      mode="setup"
      mandatory
    />
  );
};
