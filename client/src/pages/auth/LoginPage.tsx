import React, { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, LoaderCircle, LogIn, ShieldAlert, Store, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES, homeRouteForRole } from '../../constants/routes';
import { authApi } from '../../services/authApi';
import { requestDemoLogin } from '../../services/demoLogin';
import { DemoLoginRole, User as AppUser } from '../../types';

type LoginErrorResponse = {
  code?: string;
  message?: string;
  applicationStatus?: 'PENDING' | 'REJECTED';
  data?: { token?: string };
};

const demoAccountIdForRole: Partial<Record<DemoLoginRole, string | undefined>> = {
  ADMIN: import.meta.env.VITE_DEMO_ADMIN_STAFF_ID,
};

const safeTargetForRole = (role: AppUser['role'], requestedPath?: string): string => {
  const allowedPrefix = role === 'ADMIN' ? '/admin' : role === 'MERCHANT' ? '/merchant' : '/citizen';
  if (requestedPath?.startsWith(allowedPrefix)) return requestedPath;
  if (role === 'MERCHANT') return APP_ROUTES.MERCHANT_HOME;
  return homeRouteForRole(role);
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [demoCitizens, setDemoCitizens] = useState<{ id: string; name: string }[]>([]);
  const [selectedCitizenId, setSelectedCitizenId] = useState('');
  const [isLoadingCitizens, setIsLoadingCitizens] = useState(import.meta.env.DEV);
  const [citizenLoadError, setCitizenLoadError] = useState<string | null>(null);
  const [demoMerchants, setDemoMerchants] = useState<{ id: string; name: string }[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [isLoadingMerchants, setIsLoadingMerchants] = useState(import.meta.env.DEV);
  const [merchantLoadError, setMerchantLoadError] = useState<string | null>(null);
  const rawFrom = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  const resolveTargetAndValidateReset = (loggedInUser: AppUser, requestedFrom?: string): string => {
    const targetUserId = sessionStorage.getItem('thai-please:pin-reset-user-id');
    const resetReturn = sessionStorage.getItem('thai-please:pin-reset-return');

    if (targetUserId && targetUserId !== loggedInUser.id) {
      // บัญชีที่เข้าสู่ระบบใหม่ไม่ใช่บัญชีที่กดลืมรหัส PIN ให้ล้างข้อมูลการขอรีเซ็ตทิ้งทันที
      sessionStorage.removeItem('thai-please:pin-reset-intent');
      sessionStorage.removeItem('thai-please:pin-reset-user-id');
      sessionStorage.removeItem('thai-please:pin-reset-return');
      sessionStorage.removeItem('thai-please:pending-checkout-qr');
      return safeTargetForRole(loggedInUser.role, requestedFrom);
    }

    const effectivePath = requestedFrom || resetReturn || undefined;
    return safeTargetForRole(loggedInUser.role, effectivePath);
  };

  const loadDemoCitizens = useCallback(async () => {
    setIsLoadingCitizens(true);
    setCitizenLoadError(null);
    try {
      const citizens = await authApi.listDemoCitizens();
      setDemoCitizens(citizens);
      setSelectedCitizenId((currentId) =>
        citizens.some((citizen) => citizen.id === currentId) ? currentId : ''
      );
    } catch {
      setCitizenLoadError('โหลดรายชื่อประชาชนทดสอบไม่ได้ กรุณาลองอีกครั้ง');
    } finally {
      setIsLoadingCitizens(false);
    }
  }, []);

  const loadDemoMerchants = useCallback(async () => {
    setIsLoadingMerchants(true);
    setMerchantLoadError(null);
    try {
      const merchants = await authApi.listDemoMerchants();
      setDemoMerchants(merchants);
      setSelectedMerchantId((currentId) =>
        merchants.some((merchant) => merchant.id === currentId) ? currentId : ''
      );
    } catch {
      setMerchantLoadError('โหลดรายชื่อร้านค้าทดสอบไม่ได้ กรุณาลองอีกครั้ง');
    } finally {
      setIsLoadingMerchants(false);
    }
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      void loadDemoCitizens();
      void loadDemoMerchants();
    }
  }, [loadDemoCitizens, loadDemoMerchants]);

  const handleCredentialsLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (useAuthStore.getState().isAuthenticated) {
      setErrorMsg('กรุณาออกจากระบบก่อนเปลี่ยนบัญชี');
      setPassword('');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);
    try {
      const response = await authApi.login({ email, password });
      const user = response.data.user;

      if (user.role === 'MERCHANT' && user.merchantApprovalStatus !== 'APPROVED') {
        setErrorMsg(user.merchantApprovalStatus === 'REJECTED'
          ? 'ใบสมัครร้านค้าถูกปฏิเสธ'
          : 'ใบสมัครร้านค้าอยู่ระหว่างตรวจสอบ');
        return;
      }
      if (user.role !== 'ADMIN' && user.role !== 'MERCHANT' && user.role !== 'USER') {
        setErrorMsg('ไม่สามารถเข้าสู่ระบบด้วยบทบาทนี้ได้');
        return;
      }

      setAuth(user, response.data.token);
      navigate(resolveTargetAndValidateReset(user, rawFrom), { replace: true });
    } catch (error) {
      if (isAxiosError<LoginErrorResponse>(error)) {
        const code = error.response?.data?.code;
        const status = error.response?.status;
        if (code === 'MERCHANT_APPLICATION_PENDING') {
          const token = error.response?.data?.data?.token;
          if (token) {
            setAuth({ id: 'application-status', role: 'MERCHANT_APPLICATION_STATUS', createdAt: '' }, token);
            navigate(APP_ROUTES.MERCHANT_APPLICATION_STATUS, { replace: true });
          } else setErrorMsg('ใบสมัครร้านค้าอยู่ระหว่างตรวจสอบ');
        } else if (code === 'MERCHANT_APPLICATION_REJECTED') {
          const token = error.response?.data?.data?.token;
          if (token) {
            setAuth({ id: 'application-status', role: 'MERCHANT_APPLICATION_STATUS', createdAt: '' }, token);
            navigate(APP_ROUTES.MERCHANT_APPLICATION_STATUS, { replace: true });
          } else setErrorMsg('ใบสมัครร้านค้าถูกปฏิเสธ');
        } else if (status === 429) {
          setErrorMsg('ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่');
        } else if (status === 409) {
          setErrorMsg('พบข้อมูลบัญชีซ้ำ กรุณาติดต่อผู้ดูแลระบบ');
        } else {
          setErrorMsg('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        }
      } else {
        setErrorMsg('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setPassword('');
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (
    role: DemoLoginRole,
    accountId = demoAccountIdForRole[role]
  ) => {
    if (useAuthStore.getState().isAuthenticated) {
      setErrorMsg('กรุณาออกจากระบบก่อนเปลี่ยนบัญชีทดสอบ');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);
    try {
      const response = await requestDemoLogin(role, accountId);
      setAuth(response.data.user, response.data.token);
      navigate(resolveTargetAndValidateReset(response.data.user, rawFrom), { replace: true });
    } catch {
      setErrorMsg('เข้าสู่ระบบทดสอบไม่สำเร็จ กรุณาตรวจสอบบัญชีทดสอบ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5 font-sans">
      <div className="text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue text-white shadow-md shadow-blue-500/20">
          <LogIn className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">เข้าสู่ระบบ THAI Please</h2>
        <p className="mt-1 text-xs text-ink-muted">กรอกอีเมลและรหัสผ่านที่ลงทะเบียนไว้</p>
      </div>

      <form className="space-y-4" onSubmit={handleCredentialsLogin}>
        <div>
          <label htmlFor="login-email" className="mb-1 block text-sm font-semibold text-ink">อีเมล</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="mb-1 block text-sm font-semibold text-ink">รหัสผ่าน</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {errorMsg && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-status-error">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
          เข้าสู่ระบบ
        </button>
      </form>

      <p className="text-center text-xs leading-5 text-ink-muted">ระบบจะตรวจสอบประเภทบัญชีให้อัตโนมัติหลังเข้าสู่ระบบ</p>

      {import.meta.env.DEV && (
        <div className="space-y-2 border-t border-hairline pt-4">
          <p className="text-center text-xs font-semibold text-ink-muted">หรือเลือกบัญชีทดสอบ</p>
          <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
            <div>
              <label htmlFor="demo-citizen-id" className="mb-1.5 block text-xs font-semibold text-ink">
                เลือกบัญชีประชาชนทดสอบ
              </label>
              <select
                id="demo-citizen-id"
                name="demoCitizenId"
                value={selectedCitizenId}
                onChange={(event) => {
                  setSelectedCitizenId(event.target.value);
                  setErrorMsg(null);
                }}
                disabled={isLoading || isLoadingCitizens || demoCitizens.length === 0}
                className="min-h-11 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-ink-muted"
              >
                <option value="">
                  {isLoadingCitizens ? 'กำลังโหลดรายชื่อประชาชน…' : 'เลือกบัญชีประชาชน…'}
                </option>
                {demoCitizens.map((citizen) => (
                  <option key={citizen.id} value={citizen.id}>{citizen.name}</option>
                ))}
              </select>
              {isLoadingCitizens && (
                <p role="status" aria-live="polite" className="mt-1.5 text-xs text-ink-muted">
                  กำลังโหลดรายชื่อประชาชน…
                </p>
              )}
              {citizenLoadError && (
                <div role="alert" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-status-error">
                  <span>{citizenLoadError}</span>
                  <button
                    type="button"
                    onClick={() => void loadDemoCitizens()}
                    className="min-h-9 rounded-lg px-2 font-semibold text-brand-blue hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                  >
                    โหลดอีกครั้ง
                  </button>
                </div>
              )}
              {!isLoadingCitizens && !citizenLoadError && demoCitizens.length === 0 && (
                <p role="status" aria-live="polite" className="mt-1.5 text-xs text-ink-muted">
                  ไม่พบบัญชีประชาชนทดสอบ
                </p>
              )}
            </div>
            <button
              type="button"
              id="btn-demo-citizen"
              onClick={() => void handleDemoLogin('CITIZEN', selectedCitizenId)}
              disabled={isLoading || isLoadingCitizens || !selectedCitizenId || !!citizenLoadError}
              aria-busy={isLoading}
              className="group flex min-h-11 w-full items-center justify-between rounded-xl border border-hairline bg-white p-3 text-left text-xs font-medium text-ink transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center gap-3"><User className="h-4 w-4 text-brand-blue" aria-hidden="true" />เข้าสู่ระบบประชาชนทดสอบ</span>
              {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />}
            </button>
          </div>
          <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <div>
              <label htmlFor="demo-merchant-id" className="mb-1.5 block text-xs font-semibold text-ink">
                เลือกร้านค้าทดสอบ
              </label>
              <select
                id="demo-merchant-id"
                name="demoMerchantId"
                value={selectedMerchantId}
                onChange={(event) => {
                  setSelectedMerchantId(event.target.value);
                  setErrorMsg(null);
                }}
                disabled={isLoading || isLoadingMerchants || demoMerchants.length === 0}
                className="min-h-11 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-ink-muted"
              >
                <option value="">
                  {isLoadingMerchants ? 'กำลังโหลดรายชื่อร้านค้า…' : 'เลือกร้านค้า…'}
                </option>
                {demoMerchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>{merchant.name}</option>
                ))}
              </select>
              {isLoadingMerchants && (
                <p role="status" aria-live="polite" className="mt-1.5 text-xs text-ink-muted">
                  กำลังโหลดรายชื่อร้านค้า…
                </p>
              )}
              {merchantLoadError && (
                <div role="alert" className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-status-error">
                  <span>{merchantLoadError}</span>
                  <button
                    type="button"
                    onClick={() => void loadDemoMerchants()}
                    className="min-h-9 rounded-lg px-2 font-semibold text-brand-blue hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
                  >
                    โหลดอีกครั้ง
                  </button>
                </div>
              )}
              {!isLoadingMerchants && !merchantLoadError && demoMerchants.length === 0 && (
                <p className="mt-1.5 text-xs text-ink-muted">
                  ไม่พบบัญชีร้านค้าทดสอบที่ได้รับอนุมัติ
                </p>
              )}
            </div>
            <button
              type="button"
              id="btn-demo-merchant"
              onClick={() => void handleDemoLogin('MERCHANT', selectedMerchantId)}
              disabled={isLoading || isLoadingMerchants || !selectedMerchantId || !!merchantLoadError}
              className="group flex min-h-11 w-full items-center justify-between rounded-xl border border-hairline bg-white p-3 text-left text-xs font-medium text-ink transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center gap-3"><Store className="h-4 w-4 text-emerald-700" aria-hidden="true" />เข้าสู่ระบบร้านค้าทดสอบ</span>
              {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1" aria-hidden="true" />}
            </button>
          </div>
          <button type="button" onClick={() => void handleDemoLogin('ADMIN')} disabled={isLoading} className="group flex min-h-11 w-full items-center justify-between rounded-xl border border-hairline bg-surface-soft/60 p-3 text-left text-xs font-medium text-ink transition hover:border-red-200 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60">
            <span className="flex items-center gap-3"><ShieldAlert className="h-4 w-4 text-status-error" aria-hidden="true" />เข้าสู่ระบบผู้ดูแลทดสอบ</span>
            <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="border-t border-hairline pt-4 text-center text-xs text-ink-muted">
        ยังไม่มีบัญชี?{' '}
        <Link to={APP_ROUTES.REGISTER} className="font-semibold text-brand-blue hover:underline">สมัครสมาชิกประชาชน</Link>
      </div>
      <div className="text-center text-xs text-ink-muted">
        ต้องการสมัครเป็นร้านค้า?{' '}
        <Link to={APP_ROUTES.MERCHANT_REGISTER} className="font-semibold text-brand-blue hover:underline">สมัครร้านค้า</Link>
      </div>
    </div>
  );
};
