import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, LoaderCircle, LogIn, ShieldAlert, Store, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES, homeRouteForRole } from '../../constants/routes';
import { authApi } from '../../services/authApi';
import { DemoLoginRole, User as AppUser } from '../../types';

const demoAccountIdForRole: Partial<Record<DemoLoginRole, string | undefined>> = {
  CITIZEN: import.meta.env.VITE_DEMO_CITIZEN_USER_ID,
  MERCHANT: import.meta.env.VITE_DEMO_MERCHANT_ID,
  ADMIN: import.meta.env.VITE_DEMO_ADMIN_STAFF_ID,
};

const safeTargetForRole = (role: AppUser['role'], requestedPath?: string): string => {
  const allowedPrefix = role === 'ADMIN' ? '/admin' : role === 'MERCHANT' ? '/merchant' : '/citizen';
  return requestedPath?.startsWith(allowedPrefix) ? requestedPath : homeRouteForRole(role);
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  const handleDemoLogin = async (role: DemoLoginRole) => {
    if (useAuthStore.getState().isAuthenticated) {
      setErrorMsg('กรุณาออกจากระบบบัญชีปัจจุบันก่อนเปลี่ยนบัญชีทดสอบ');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);
    try {
      const response = await authApi.demoLogin(role, demoAccountIdForRole[role]);
      setAuth(response.data.user, response.data.token);
      navigate(safeTargetForRole(response.data.user.role, from), { replace: true });
    } catch (error) {
      const responseMessage = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setErrorMsg(responseMessage || 'เข้าสู่ระบบบัญชีจำลองไม่สำเร็จ กรุณาตรวจสอบบัญชีที่กำหนดไว้');
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
        <p className="mt-1 text-xs text-ink-muted">กระเป๋าเงินดิจิทัลและสิทธิ์ชำระเงินร่วม</p>
      </div>

      <div className="rounded-xl border border-hairline bg-surface-soft/50 p-4 text-sm leading-6 text-ink-muted">
        ระบบนี้ใช้บัญชีจำลองที่กำหนดไว้สำหรับทดสอบ Citizen, ร้านค้า และผู้ดูแลระบบ
      </div>

      {errorMsg && (
        <div role="alert" className="flex items-center space-x-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-status-error">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="space-y-2 border-t border-hairline pt-4">
        <p className="text-center text-xs font-semibold text-ink-muted">เลือกบทบาทบัญชีจำลอง</p>
        <button
          type="button"
          id="btn-demo-citizen"
          onClick={() => handleDemoLogin('CITIZEN')}
          disabled={isLoading}
          className="group flex min-h-11 w-full items-center justify-between rounded-xl border border-hairline bg-surface-soft/60 p-3 text-left text-xs font-medium text-ink transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
        >
          <span className="flex items-center gap-3"><User className="h-4 w-4 text-brand-blue" aria-hidden="true" />เข้าสู่ระบบประชาชนทดสอบ</span>
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1" aria-hidden="true" />}
        </button>
        <button
          type="button"
          id="btn-demo-merchant"
          onClick={() => handleDemoLogin('MERCHANT')}
          disabled={isLoading}
          className="group flex min-h-11 w-full items-center justify-between rounded-xl border border-hairline bg-surface-soft/60 p-3 text-left text-xs font-medium text-ink transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"
        >
          <span className="flex items-center gap-3"><Store className="h-4 w-4 text-emerald-700" aria-hidden="true" />เข้าสู่ระบบร้านค้าทดสอบ</span>
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1" aria-hidden="true" />}
        </button>
        <button
          type="button"
          id="btn-demo-admin"
          onClick={() => handleDemoLogin('ADMIN')}
          disabled={isLoading}
          className="group flex min-h-11 w-full items-center justify-between rounded-xl border border-hairline bg-surface-soft/60 p-3 text-left text-xs font-medium text-ink transition hover:border-red-200 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
        >
          <span className="flex items-center gap-3"><ShieldAlert className="h-4 w-4 text-status-error" aria-hidden="true" />เข้าสู่ระบบผู้ดูแลทดสอบ</span>
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1" aria-hidden="true" />}
        </button>
      </div>

      <div className="border-t border-hairline pt-4 text-center text-xs text-ink-muted">
        ต้องการลงทะเบียนรับสิทธิ์?{' '}
        <Link to={APP_ROUTES.REGISTER} className="font-semibold text-brand-blue hover:underline">ดูข้อมูลการลงทะเบียน</Link>
      </div>
    </div>
  );
};
