import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, LoaderCircle, LogIn, ShieldAlert, Store, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES, homeRouteForRole } from '../../constants/routes';
import { authApi } from '../../services/authApi';
import { DemoLoginRole, User as AppUser } from '../../types';

const demoAccountIdForRole: Partial<Record<DemoLoginRole, string | undefined>> = {
  CITIZEN: import.meta.env.VITE_DEMO_CITIZEN_USER_ID,
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
  const [demoMerchants, setDemoMerchants] = useState<{ id: string; name: string }[]>([]);
  const [selectedMerchantId, setSelectedMerchantId] = useState('');
  const [isLoadingMerchants, setIsLoadingMerchants] = useState(true);
  const [merchantLoadError, setMerchantLoadError] = useState<string | null>(null);
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

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
    void loadDemoMerchants();
  }, [loadDemoMerchants]);

  const handleDemoLogin = async (
    role: DemoLoginRole,
    accountId = demoAccountIdForRole[role]
  ) => {
    if (useAuthStore.getState().isAuthenticated) {
      setErrorMsg('กรุณาออกจากระบบบัญชีปัจจุบันก่อนเปลี่ยนบัญชีทดสอบ');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);
    try {
      const response = await authApi.demoLogin(role, accountId);
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
            onClick={() => handleDemoLogin('MERCHANT', selectedMerchantId)}
            disabled={isLoading || isLoadingMerchants || !selectedMerchantId || !!merchantLoadError}
            className="group flex min-h-11 w-full items-center justify-between rounded-xl border border-hairline bg-white p-3 text-left text-xs font-medium text-ink transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex items-center gap-3"><Store className="h-4 w-4 text-emerald-700" aria-hidden="true" />เข้าสู่ระบบร้านค้าทดสอบ</span>
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1" aria-hidden="true" />}
          </button>
        </div>
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
