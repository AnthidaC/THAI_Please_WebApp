import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Delete, KeyRound, LockKeyhole, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { setPaymentPin, resetPaymentPin } from '../../services/paymentApi';
import { usePaymentPinStatus } from '../../hooks/usePaymentPinStatus';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES } from '../../constants/routes';

export type BankPinMode = 'setup' | 'change' | 'reset';

interface Props {
  open: boolean;
  mode?: BankPinMode;
  /** Mandatory setup (e.g. login gate for citizen without PIN). Disables voluntary close and shows logout button */
  mandatory?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  onForgot?: () => void;
}

type Step = 'current' | 'new' | 'confirm';

/**
 * Bank-style standalone full-screen PIN dialog for setting, changing, and resetting PIN.
 * Uses 6-dot indicators and a 3x4 numeric keypad, matching PaymentPinConfirmation.
 */
export const BankPinDialog = ({
  open,
  mode = 'setup',
  mandatory = false,
  onClose,
  onSuccess,
  onForgot,
}: Props) => {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const { token, clearAuth } = useAuthStore();
  const pinStatus = usePaymentPinStatus();

  // Initial step based on mode
  const initialStep: Step = mode === 'change' ? 'current' : 'new';
  const [step, setStep] = useState<Step>(initialStep);
  const [view, setView] = useState<'pin' | 'forgot'>('pin');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const lockedUntil = pinStatus.data?.lockedUntil;
  const secondsLocked = Math.max(0, Math.ceil(((lockedUntil ? new Date(lockedUntil).getTime() : 0) - now) / 1000));

  const resetAll = () => {
    setStep(initialStep);
    setView('pin');
    setCurrentPin('');
    setNewPin('');
    setDigits('');
    setError(null);
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
    setSuccessMessage(null);
  };

  useEffect(() => {
    const element = dialogRef.current;
    if (!open) {
      if (element?.open) element.close();
      resetAll();
      return;
    }
    resetAll();
    if (element && !element.open) {
      element.showModal();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      if (element?.open) element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open, mode, token]);

  useEffect(() => {
    if (!open || !lockedUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open, lockedUntil]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { pin: string; confirmPin: string; currentPin?: string }) => {
      if (mode === 'reset') {
        return resetPaymentPin({ pin: payload.pin, confirmPin: payload.confirmPin });
      }
      return setPaymentPin({
        pin: payload.pin,
        confirmPin: payload.confirmPin,
        ...(payload.currentPin ? { currentPin: payload.currentPin } : {}),
      });
    },
    onSuccess: async () => {
      const msg = mode === 'reset'
        ? 'ตั้งรหัส PIN ใหม่สำเร็จ'
        : mode === 'change'
        ? 'เปลี่ยนรหัส PIN สำเร็จ'
        : 'ตั้งรหัส PIN สำเร็จ';
      setSuccessMessage(msg);
      setError(null);
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
      client.setQueryData(['payment-pin-status', token], { isSet: true, lockedUntil: null });
      await client.invalidateQueries({ queryKey: ['payment-pin-status'] });
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 700);
    },
    onError: (err: any) => {
      const resp = err?.response?.data;
      const msg = resp?.message || 'บันทึก PIN ไม่สำเร็จ กรุณาลองใหม่';
      setError(msg);
      // If error was incorrect current PIN in change mode, reset to current PIN step
      if (mode === 'change' && (resp?.code === 'PIN_INCORRECT' || resp?.code === 'CURRENT_PIN_REQUIRED')) {
        setStep('current');
        setCurrentPin('');
        setNewPin('');
        setDigits('');
      } else {
        // Reset confirmation step to let user retry
        setDigits('');
      }
    },
  });

  const isPending = saveMutation.isPending;
  const disabled = isPending || Boolean(successMessage) || secondsLocked > 0;

  const enterDigit = (digit: string) => {
    if (disabled || digits.length >= 6) return;
    setError(null);
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
    const next = digits + digit;
    setDigits(next);

    if (next.length === 6) {
      handleCompleteDigits(next);
    }
  };

  const removeDigit = () => {
    if (disabled || digits.length === 0) return;
    setError(null);
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
    const next = digits.slice(0, -1);
    setDigits(next);
    if (step === 'current') setCurrentPin(next);
    else if (step === 'new') setNewPin(next);
  };

  const handleCompleteDigits = (val: string) => {
    if (step === 'current') {
      setCurrentPin(val);
      setDigits('');
      setStep('new');
    } else if (step === 'new') {
      setNewPin(val);
      setDigits('');
      setStep('confirm');
    } else if (step === 'confirm') {
      if (val !== newPin) {
        setError('รหัส PIN ทั้งสองครั้งไม่ตรงกัน กรุณาลองใหม่');
        setDigits('');
        return;
      }
      // PIN matches, trigger save mutation directly with explicit values
      saveMutation.mutate({
        pin: newPin,
        confirmPin: val,
        ...(mode === 'change' ? { currentPin } : {}),
      });
    }
  };

  const handleBack = () => {
    if (disabled) return;
    setError(null);
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
    if (view === 'forgot') {
      setView('pin');
      return;
    }
    if (step === 'confirm') {
      setStep('new');
      setDigits('');
      setNewPin('');
    } else if (step === 'new' && mode === 'change') {
      setStep('current');
      setDigits('');
      setCurrentPin('');
      setNewPin('');
    } else {
      if (!mandatory) {
        onClose?.();
      }
    }
  };

  // Header and title config based on current state
  const totalSteps = mode === 'change' ? 3 : 2;
  const currentStepNum = step === 'current' ? 1 : step === 'new' ? (mode === 'change' ? 2 : 1) : totalSteps;

  const getTitle = () => {
    if (step === 'current') return 'กรอกรหัส PIN เดิม';
    if (step === 'new') return mode === 'change' || mode === 'reset' ? 'ตั้งรหัส PIN ใหม่' : 'ตั้งรหัส PIN 6 หลัก';
    return mode === 'change' || mode === 'reset' ? 'ยืนยันรหัส PIN ใหม่' : 'ยืนยันรหัส PIN';
  };

  const getSubtitle = () => {
    if (step === 'current') return 'เพื่อยืนยันตัวตนก่อนเปลี่ยนรหัส';
    if (step === 'new') {
      if (mode === 'reset') return 'กำหนดรหัส PIN 6 หลักใหม่';
      if (mode === 'change') return 'กำหนดรหัส PIN 6 หลักใหม่ที่คุณต้องการ';
      return 'กำหนดรหัส PIN เพื่อความปลอดภัยในการชำระเงิน';
    }
    return 'กรอกรหัส PIN อีกครั้งเพื่อยืนยัน';
  };

  const getHelperText = () => {
    if (step === 'confirm') return 'ระบบจะบันทึกเมื่อกรอกครบ 6 หลัก';
    return 'ระบบจะไปยังขั้นตอนถัดไปเมื่อกรอกครบ 6 หลัก';
  };

  const dialogId = mandatory ? 'payment-pin-gate' : 'bank-pin-dialog';
  const titleId = mandatory ? 'payment-pin-gate-title' : 'bank-pin-dialog-title';

  return (
    <dialog
      ref={dialogRef}
      id={dialogId}
      aria-labelledby={titleId}
      onCancel={event => {
        event.preventDefault();
        if (!mandatory && !disabled) onClose?.();
      }}
      onKeyDown={event => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (view === 'forgot') {
          if (event.key === 'Escape' && !mandatory && !disabled) {
            event.preventDefault();
            setView('pin');
          }
          return;
        }
        if (/^\d$/.test(event.key)) {
          event.preventDefault();
          enterDigit(event.key);
        } else if (event.key === 'Backspace') {
          event.preventDefault();
          removeDigit();
        } else if (event.key === 'Escape' && !mandatory && !disabled) {
          event.preventDefault();
          onClose?.();
        }
      }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-y-auto border-0 bg-white p-0 font-sans text-ink z-50 backdrop:bg-white"
    >
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-6 pb-5 pt-4">
        {/* Header */}
        <header className="flex h-12 shrink-0 items-center justify-between">
          {mandatory && step === 'new' && view !== 'forgot' ? (
            <button
              type="button"
              onClick={() => {
                clearAuth();
                navigate(APP_ROUTES.HOME, { replace: true });
              }}
              disabled={disabled}
              aria-label="ออกจากระบบ"
              className="flex items-center gap-1.5 rounded-full py-2 pr-3 text-sm text-ink-muted transition hover:text-ink disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2"
            >
              <LogOut className="h-4 w-4" />ออกจากระบบ
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBack}
              disabled={disabled}
              aria-label="ย้อนกลับ"
              className="flex items-center gap-1.5 rounded-full py-2 pr-3 text-sm text-ink-muted transition hover:text-ink disabled:opacity-40"
            >
              <ArrowLeft className="h-5 w-5" />กลับ
            </button>
          )}

          <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-blue">
            <ShieldCheck className="h-4 w-4" />THAI Please
          </span>
        </header>

        {/* Forgot PIN View */}
        {view === 'forgot' ? (
          <div className="flex flex-1 flex-col items-center justify-center pb-8 pt-4 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue shadow-sm">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              ลืมรหัส PIN
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
              เพื่อความปลอดภัยของเงินในกระเป๋า ระบบจะให้คุณเข้าสู่ระบบใหม่อีกครั้งเพื่อยืนยันตัวตน จากนั้นจะพากลับมาตั้งรหัส PIN ใหม่ได้ทันทีโดยไม่ต้องใช้ PIN เดิม
            </p>

            <div className="mt-8 w-full max-w-xs space-y-3">
              <button
                type="button"
                id="btn-forgot-pin-relogin"
                onClick={onForgot}
                className="w-full rounded-2xl bg-brand-blue py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 active:scale-[0.99]"
              >
                เข้าสู่ระบบใหม่เพื่อตั้ง PIN
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('pin');
                  if (dialogRef.current) dialogRef.current.scrollTop = 0;
                }}
                className="w-full rounded-2xl border border-hairline py-3 text-sm text-ink-muted transition hover:bg-surface-soft"
              >
                ย้อนกลับ
              </button>
            </div>
            <p className="mt-auto pb-[env(safe-area-inset-bottom)] text-center text-[11px] text-ink-muted">
              ระบบรักษาความปลอดภัยตามมาตรฐาน THAI Please
            </p>
          </div>
        ) : (
          /* Normal PIN View */
          <>
            <div className="flex flex-1 flex-col items-center justify-center pb-4 pt-4 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-brand-blue shadow-sm">
                <LockKeyhole className="h-6 w-6" />
              </div>

              <span className="mb-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold text-brand-blue">
                ขั้นตอนที่ {currentStepNum} จาก {totalSteps}
              </span>

              <h1 id={titleId} className="text-xl font-bold tracking-tight">
                {getTitle()}
              </h1>
              <p className="mt-1.5 max-w-xs text-sm text-ink-muted">
                {getSubtitle()}
              </p>

              {/* 6 Dots Indicator */}
              <div
                role="status"
                aria-label={`กรอกรหัสแล้ว ${digits.length} จาก 6 หลัก`}
                className="mt-7 flex items-center gap-4"
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <span
                    key={index}
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 rounded-full border-2 transition-all duration-150 ${
                      index < digits.length
                        ? 'border-brand-blue bg-brand-blue scale-110 shadow-sm'
                        : 'border-slate-300 bg-white'
                    }`}
                  />
                ))}
              </div>

              {/* Feedback & Alert Area */}
              <div
                className="mt-4 flex min-h-12 items-center justify-center text-xs leading-relaxed"
                aria-live="polite"
              >
                {isPending ? (
                  <p className="flex items-center gap-2 font-medium text-brand-blue">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {mode === 'reset'
                      ? 'กำลังตั้งรหัส PIN ใหม่...'
                      : mode === 'change'
                      ? 'กำลังเปลี่ยนรหัส PIN...'
                      : 'กำลังบันทึกรหัส PIN...'}
                  </p>
                ) : secondsLocked > 0 ? (
                  <p role="alert" className="text-status-error font-medium">
                    กรอก PIN ผิดครบ 5 ครั้ง<br />
                    ลองใหม่ได้ใน {Math.floor(secondsLocked / 60).toString().padStart(2, '0')}:{(secondsLocked % 60).toString().padStart(2, '0')} นาที
                  </p>
                ) : successMessage ? (
                  <p role="status" className="flex items-center gap-1.5 font-medium text-status-success">
                    <CheckCircle2 className="h-4 w-4" />
                    {successMessage}
                  </p>
                ) : error ? (
                  <div className="text-center">
                    <p role="alert" className="font-medium text-status-error">{error}</p>
                    {errIsReauth(saveMutation.error) && onForgot && (
                      <button
                        type="button"
                        onClick={onForgot}
                        className="mt-1 text-xs text-brand-blue underline"
                      >
                        เข้าสู่ระบบใหม่
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-ink-muted">{getHelperText()}</p>
                )}
              </div>

              {/* Forgot PIN action when on current PIN step */}
              {step === 'current' && (
                <button
                  type="button"
                  id="btn-forgot-pin"
                  onClick={() => setView('forgot')}
                  disabled={disabled}
                  className="mt-1 text-xs font-medium text-brand-blue underline hover:opacity-80 disabled:opacity-40"
                >
                  ลืมรหัส PIN?
                </button>
              )}
            </div>

            {/* 3x4 Bank Numeric Keypad */}
            <div
              className="mx-auto grid w-full max-w-xs shrink-0 grid-cols-3 gap-x-5 gap-y-2 pb-3"
              aria-label="แป้นตัวเลข PIN"
            >
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
                <button
                  key={digit}
                  type="button"
                  data-pin-digit={digit}
                  aria-label={`เลข ${digit}`}
                  disabled={disabled || digits.length === 6}
                  onClick={() => enterDigit(digit)}
                  className="h-14 rounded-2xl text-2xl font-medium transition hover:bg-blue-50 active:bg-blue-100 disabled:opacity-30"
                >
                  {digit}
                </button>
              ))}
              <span aria-hidden="true" />
              <button
                type="button"
                data-pin-digit="0"
                aria-label="เลข 0"
                disabled={disabled || digits.length === 6}
                onClick={() => enterDigit('0')}
                className="h-14 rounded-2xl text-2xl font-medium transition hover:bg-blue-50 active:bg-blue-100 disabled:opacity-30"
              >
                0
              </button>
              <button
                type="button"
                aria-label="ลบตัวเลขล่าสุด"
                disabled={disabled || digits.length === 0}
                onClick={removeDigit}
                className="flex h-14 items-center justify-center rounded-2xl text-ink-muted transition hover:bg-blue-50 disabled:opacity-30"
              >
                <Delete className="h-6 w-6" />
              </button>
            </div>

            <p className="pb-[env(safe-area-inset-bottom)] text-center text-[11px] text-ink-muted">
              อย่าบอกรหัส PIN ของคุณกับผู้อื่น
            </p>
          </>
        )}
      </div>
    </dialog>
  );
};

const errIsReauth = (error: unknown) => {
  return (error as any)?.response?.data?.code === 'REAUTH_REQUIRED';
};
