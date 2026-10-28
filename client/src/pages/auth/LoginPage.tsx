import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, LoaderCircle, LogIn, ShieldAlert, Store, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES, homeRouteForRole } from '../../constants/routes';
import { authApi } from '../../services/authApi';
import { User as AppUser } from '../../types';

const demoCitizenLoginEnabled = import.meta.env.DEV
  && import.meta.env.VITE_DEMO_CITIZEN_AUTH_ENABLED === 'true';

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

  const handleCitizenDemoLogin = async () => {
    if (useAuthStore.getState().isAuthenticated) {
      setErrorMsg('กรุณาออกจากระบบบัญชีปัจจุบันก่อนเข้าสู่บัญชีทดสอบ');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);
    try {
      const response = await authApi.demoCitizenLogin(import.meta.env.VITE_DEMO_CITIZEN_USER_ID);
      setAuth(response.data.user, response.data.token);
      navigate(safeTargetForRole('USER', from), { replace: true });
    } catch (error) {
      const responseMessage = (error as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      setErrorMsg(responseMessage || 'เข้าสู่ระบบทดสอบไม่สำเร็จ กรุณาตรวจสอบการตั้งค่าบัญชีทดสอบ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleDemoLogin = (role: 'ADMIN' | 'MERCHANT') => {
    if (useAuthStore.getState().isAuthenticated) {
      setErrorMsg('กรุณาออกจากระบบบัญชีปัจจุบันก่อนเปลี่ยนบัญชีทดสอบ');
      return;
    }

    const users: Record<'ADMIN' | 'MERCHANT', AppUser> = {
      ADMIN: {
        id: 'admin-001',
        email: 'admin.super@thaiplease.go.th',
        name: 'ผู้ดูแลระบบส่วนกลาง',
        role: 'ADMIN',
        createdAt: new Date().toISOString(),
      },
      MERCHANT: {
        id: '4ebb77a7-2248-4c67-a56e-d5cdfcbb210b',
        email: 'chickenrice.shop@thaiplease.go.th',
        name: 'ร้านค้าทดสอบ',
        role: 'MERCHANT',
        createdAt: new Date().toISOString(),
      },
    };

    setErrorMsg(null);
    setAuth(users[role], `demo-token-${role.toLowerCase()}`);
    navigate(safeTargetForRole(role, from), { replace: true });
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
        การเข้าสู่ระบบประชาชนต้องยืนยันตัวตนผ่าน ThaiD หรือ NDID ซึ่งยังไม่พร้อมใช้งานในระบบนี้
      </div>

      {errorMsg && (
        <div role="alert" className="flex items-center space-x-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-status-error">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {demoCitizenLoginEnabled && (
        <button
          type="button"
          id="btn-demo-citizen"
          onClick={handleCitizenDemoLogin}
          disabled={isLoading}
          className="group flex min-h-12 w-full items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-3 text-left text-sm font-medium text-ink transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-brand-blue">
              {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <User className="h-4 w-4" aria-hidden="true" />}
            </span>
            <span>
              <span className="block font-bold">เข้าสู่ระบบบัญชีทดสอบประชาชน</span>
              <span className="block text-xs text-ink-muted">สำหรับทดสอบในสภาพแวดล้อมพัฒนาเท่านั้น</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1 group-hover:text-brand-blue" aria-hidden="true" />
        </button>
      )}

      {import.meta.env.DEV && (
        <div className="space-y-2 border-t border-hairline pt-4">
          <p className="text-center text-xs font-semibold text-ink-muted">บัญชีทดสอบสำหรับผู้ดูแลและร้านค้า</p>
          <button
            type="button"
            id="btn-demo-merchant"
            onClick={() => handleRoleDemoLogin('MERCHANT')}
            className="group flex min-h-11 w-full items-center justify-between rounded-xl border border-hairline bg-surface-soft/60 p-3 text-left text-xs font-medium text-ink transition hover:border-emerald-200 hover:bg-emerald-50"
          >
            <span className="flex items-center gap-3"><Store className="h-4 w-4 text-emerald-700" aria-hidden="true" />เข้าสู่ระบบร้านค้าทดสอบ</span>
            <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1" aria-hidden="true" />
          </button>
          <button
            type="button"
            id="btn-demo-admin"
            onClick={() => handleRoleDemoLogin('ADMIN')}
            className="group flex min-h-11 w-full items-center justify-between rounded-xl border border-hairline bg-surface-soft/60 p-3 text-left text-xs font-medium text-ink transition hover:border-red-200 hover:bg-red-50"
          >
            <span className="flex items-center gap-3"><ShieldAlert className="h-4 w-4 text-status-error" aria-hidden="true" />เข้าสู่ระบบผู้ดูแลทดสอบ</span>
            <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="border-t border-hairline pt-4 text-center text-xs text-ink-muted">
        ต้องการลงทะเบียนรับสิทธิ์?{' '}
        <Link to={APP_ROUTES.REGISTER} className="font-semibold text-brand-blue hover:underline">ดูข้อมูลการลงทะเบียน</Link>
      </div>
    </div>
  );
};
