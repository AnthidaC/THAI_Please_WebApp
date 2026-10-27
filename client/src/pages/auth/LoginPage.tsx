import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import { Eye, EyeOff, LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { APP_ROUTES } from '../../constants/routes';
import { authApi } from '../../services/authApi';
import { mockQuickLogin, mockThaiDLogin } from '../../services/authMock';
import { useAuthStore } from '../../stores/authStore';
import type { User } from '../../types';

type AuthPrincipal = Partial<User> & {
  user_id?: string; full_name?: string; approval_status?: string;
  merchant_approval_status?: string;
  merchant_rejection_reason?: string | null; rejection_reason?: string | null;
  merchant_application_submitted_at?: string | null; role: string;
};
type LoginPayload = { user?: AuthPrincipal; token: string };

const destinationFor = (user: User): string => {
  if (user.role === 'MERCHANT') {
    return APP_ROUTES.MERCHANT_HOME;
  }
  if (user.role === 'ADMIN' || user.role === 'STAFF') return APP_ROUTES.ADMIN_MERCHANT_APPLICATIONS;
  if (user.role === 'GOVERNMENT_EXECUTIVE') return APP_ROUTES.ADMIN_SOCIAL_IMPACT;
  return APP_ROUTES.DASHBOARD;
};

const normalizeUser = (payload: LoginPayload): User => {
  const source = (payload.user ?? payload) as AuthPrincipal;
  const rawRole = source.role.toUpperCase();
  const role: User['role'] = rawRole === 'CITIZEN' ? 'USER'
    : rawRole === 'GOV_EXECUTIVE' || rawRole === 'EXECUTIVE' ? 'GOVERNMENT_EXECUTIVE'
      : rawRole as User['role'];
  const rawApprovalStatus = (source.merchantApprovalStatus ?? source.merchant_approval_status ?? source.approval_status)?.toUpperCase();
  return {
    id: source.id || source.user_id || '',
    email: source.email || '',
    name: source.name || source.full_name || '',
    role,
    merchantApprovalStatus: rawApprovalStatus === 'PENDING' || rawApprovalStatus === 'APPROVED' || rawApprovalStatus === 'REJECTED' ? rawApprovalStatus : undefined,
    merchantRejectionReason: source.merchantRejectionReason ?? source.merchant_rejection_reason ?? source.rejection_reason ?? null,
    merchantApplicationSubmittedAt: source.merchantApplicationSubmittedAt ?? source.merchant_application_submitted_at ?? null,
    createdAt: source.createdAt || new Date().toISOString(),
  };
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishLogin = (response: { data: LoginPayload }) => {
    const user = normalizeUser(response.data);
    setAuth(user, response.data.token);
    const requested = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    navigate(requested || destinationFor(user), { replace: true });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await authApi.loginWithUsername({ username: username.trim(), password });
      finishLogin(response as { data: LoginPayload });
    } catch (cause) {
      const message = isAxiosError<{ message?: string }>(cause) ? cause.response?.data?.message : undefined;
      const timedOut = isAxiosError(cause) && cause.code === 'ECONNABORTED';
      setError(message || (timedOut
        ? 'ระบบยังไม่ตอบสนอง กรุณาลองอีกครั้ง หรือเปิดโหมดจำลองสำหรับทดสอบ'
        : 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const loginWithThaiDMock = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      finishLogin(await mockThaiDLogin() as { data: LoginPayload });
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickLogin = async (role: 'citizen' | 'merchant' | 'admin') => {
    setError(null);
    setIsSubmitting(true);
    try {
      finishLogin(await mockQuickLogin(role) as { data: LoginPayload });
    } catch {
      setError('ไม่สามารถเข้าสู่ระบบด่วนได้ กรุณาลองอีกครั้ง');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <header className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue text-white"><LogIn aria-hidden="true" className="h-7 w-7" /></span>
        <h1 className="mt-4 text-2xl font-bold text-ink">เข้าสู่ระบบ</h1>
        <p className="mt-2 text-base text-ink-muted">กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งาน</p>
        {import.meta.env.VITE_AUTH_MOCK === 'true' && <p className="mt-2 text-sm text-amber-800">โหมดจำลอง: citizen, merchant, pending-merchant, admin หรือ executive · รหัสผ่าน demo123</p>}
      </header>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="login-username" className="mb-1 block text-base font-semibold text-ink">ชื่อผู้ใช้</label>
          <input id="login-username" name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="min-h-12 w-full rounded-xl border border-hairline bg-white px-4 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue" />
        </div>
        <div>
          <label htmlFor="login-password" className="mb-1 block text-base font-semibold text-ink">รหัสผ่าน</label>
          <div className="relative">
            <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-12 w-full rounded-xl border border-hairline bg-white py-2 pl-4 pr-14 text-base text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue" />
            <button type="button" className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
              {showPassword ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-base text-status-error">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-pill bg-brand-blue px-5 text-base font-semibold text-white hover:bg-brand-blue-hover disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue">
          {isSubmitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>

      <section className="border-t border-hairline pt-5" aria-labelledby="identity-mock-title">
        <h2 id="identity-mock-title" className="text-center text-base font-semibold text-ink">ทดลองยืนยันตัวตนประชาชน</h2>
        <p className="mt-1 text-center text-sm text-ink-muted">โหมดจำลองเท่านั้น ยังไม่เชื่อมต่อ ThaiD หรือ NDID จริง</p>
        <button type="button" disabled={isSubmitting} onClick={() => void loginWithThaiDMock()} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-brand-blue px-4 text-base font-semibold text-brand-blue hover:bg-brand-blue-light disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">
          <UserRound aria-hidden="true" className="h-5 w-5" /> ยืนยันผ่าน ThaiD / NDID (จำลอง)
        </button>
      </section>
      <section className="border-t border-hairline pt-5" aria-labelledby="quick-login-title">
        <h2 id="quick-login-title" className="text-center text-base font-semibold text-ink">เข้าสู่ระบบด่วนเพื่อทดสอบแต่ละบทบาท</h2>
        <p className="mt-1 text-center text-sm text-ink-muted">บัญชีจำลองสำหรับตรวจสอบเมนูและหน้าจอเท่านั้น</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([
            ['citizen', 'ประชาชน'], ['merchant', 'ร้านค้า'], ['admin', 'ผู้ดูแลระบบ / ผู้บริหาร'],
          ] as const).map(([role, label]) => <button key={role} type="button" disabled={isSubmitting} onClick={() => void quickLogin(role)} className="min-h-11 rounded-xl border border-hairline bg-white px-3 text-base font-semibold text-ink hover:border-brand-blue hover:bg-brand-blue-light disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue">{label}</button>)}
        </div>
      </section>
      <p className="flex items-start gap-2 text-sm text-ink-muted"><ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />ข้อมูลเข้าสู่ระบบจะใช้เพื่อกำหนดสิทธิ์ตามบทบาทของบัญชี</p>
    </div>
  );
};
