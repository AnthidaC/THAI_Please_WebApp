import { useState } from 'react';
import { BankPinDialog, BankPinMode } from './BankPinDialog';
import { usePaymentPinStatus } from '../../hooks/usePaymentPinStatus';

export const PaymentPinSettings = ({
  setupOnly = false,
  startEditing = false,
  resetMode = false,
  onForgot,
  onResetDone,
}: {
  setupOnly?: boolean;
  autoFocus?: boolean;
  startEditing?: boolean;
  /** Forgot-PIN flow: set a new PIN without current PIN */
  resetMode?: boolean;
  onPendingChange?: (pending: boolean) => void;
  onForgot?: () => void;
  onResetDone?: () => void;
}) => {
  const status = usePaymentPinStatus();
  const [open, setOpen] = useState(startEditing || resetMode || (setupOnly && !status.data?.isSet));

  if (setupOnly && status.data?.isSet) return null;

  const mode: BankPinMode = resetMode ? 'reset' : status.data?.isSet ? 'change' : 'setup';

  return (
    <BankPinDialog
      open={open}
      mode={mode}
      onClose={() => setOpen(false)}
      onSuccess={() => {
        setOpen(false);
        if (resetMode) onResetDone?.();
      }}
      onForgot={onForgot}
    />
  );
};
