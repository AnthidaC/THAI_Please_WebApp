import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { LogIn, User, Store, ShieldAlert, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES } from '../../constants/routes';
import type { User as AuthUser } from '../../types';
import { authApi } from '../../services/authApi';

type LoginAudience = 'CITIZEN' | 'MERCHANT' | 'ADMIN';

interface LoginPageProps {
  audience?: LoginAudience;
}

const DEFAULT_ROUTE_BY_AUDIENCE: Record<LoginAudience, string> = {
  CITIZEN: APP_ROUTES.DASHBOARD,
  MERCHANT: APP_ROUTES.MERCHANT_POS_QR,
  ADMIN: APP_ROUTES.ADMIN_MERCHANT_APPLICATIONS,
};

const LOGIN_COPY: Record<LoginAudience, { title: string; description: string }> = {
  CITIZEN: {
    title: 'เข้าสู่ระบบประชาชน',
    description: 'ระบบกระเป๋าเงินดิจิทัล & ชำระเงินร่วม Co-pay 60/40',
  },
  MERCHANT: {
    title: 'เข้าสู่ระบบร้านค้า',
    description: 'ระบบรับชำระเงินและจัดการยอดขายหน้าร้าน',
  },
  ADMIN: {
    title: 'เข้าสู่ระบบเจ้าหน้าที่',
    description: 'สำหรับเจ้าหน้าที่รัฐและผู้ดูแลระบบ',
  },
};

export const LoginPage: React.FC<LoginPageProps> = ({ audience = 'CITIZEN' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ดึงหน้าปลายทางที่ต้องการไปหลังล็อกอิน (ถ้ามี redirect มา)
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || DEFAULT_ROUTE_BY_AUDIENCE[audience];

  const handleRealDemoLogin = async (roleType: LoginAudience) => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const response = roleType === 'CITIZEN'
        ? await authApi.login({ citizenId: '1101700203456' })
        : roleType === 'MERCHANT'
          ? await authApi.loginMerchant({ email: 'noodle.shop@thaiplease.go.th', password: 'DemoMerchant123!' })
          : await authApi.loginStaff({ email: 'admin.super@thaiplease.go.th', password: 'DemoAdmin123!' });
      const apiUser = response.data.user as AuthUser & { user_id?: string; full_name?: string };
      const user: AuthUser = {
        id: apiUser.id || apiUser.user_id || '',
        email: apiUser.email || (roleType === 'CITIZEN' ? 'somchai.citizen@thaiplease.go.th' : ''),
        name: apiUser.name || apiUser.full_name,
        role: roleType === 'CITIZEN' ? 'USER' : apiUser.role,
        createdAt: apiUser.createdAt || new Date().toISOString(),
      };
      setAuth(user, response.data.token);
      navigate(roleType === audience ? from : DEFAULT_ROUTE_BY_AUDIENCE[roleType], { replace: true });
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error) ? error.response?.data?.message : undefined;
      setErrorMsg(message || 'ไม่สามารถเข้าสู่ระบบ Demo ได้ กรุณาตรวจสอบข้อมูล seed และ server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = (roleType: LoginAudience) => {
    let mockUser: AuthUser;
    if (roleType === 'CITIZEN') {
      mockUser = {
        id: '62a51dec-39a0-4193-9ddc-20fe354f0d27',
        email: 'somchai.citizen@thaiplease.go.th',
        name: 'นายสมชาย ประชาชนผู้รับสิทธิ',
        role: 'USER',
        createdAt: new Date().toISOString(),
      };
    } else if (roleType === 'MERCHANT') {
      mockUser = {
        id: '6d293778-8264-475d-a40e-448e78d7a861',
        email: 'noodle.shop@thaiplease.go.th',
        name: 'ร้านข้าวมันไก่ป้าณี (วิสาหกิจชุมชน)',
        role: 'MERCHANT',
        createdAt: new Date().toISOString(),
      };
    } else {
      mockUser = {
        id: 'admin-001',
        email: 'admin.super@thaiplease.go.th',
        name: 'ผู้ดูแลระบบส่วนกลาง (Admin Inspector)',
        role: 'ADMIN',
        createdAt: new Date().toISOString(),
      };
    }

    setAuth(mockUser, 'demo-token-' + roleType.toLowerCase());
    navigate(roleType === audience ? from : DEFAULT_ROUTE_BY_AUDIENCE[roleType], { replace: true });
  };

  // Kept only for backwards compatibility with the old demo helper; all UI demo buttons use the real API flow above.
  void handleDemoLogin;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('กรุณากรอกอีเมล/เลขบัตรประชาชน และรหัสผ่าน');
      return;
    }
    if (audience === 'CITIZEN') {
      void handleRealDemoLogin(audience);
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const response = audience === 'MERCHANT'
        ? await authApi.loginMerchant({ email, password })
        : await authApi.loginStaff({ email, password });
      setAuth(response.data.user, response.data.token);
      navigate(from, { replace: true });
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      setErrorMsg(message || 'ไม่สามารถเข้าสู่ระบบได้ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 font-sans">
      <div className="text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue text-white shadow-md shadow-blue-500/20 mb-3">
          <LogIn className="h-6 w-6" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
          {LOGIN_COPY[audience].title}
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          {LOGIN_COPY[audience].description}
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-status-error flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ฟอร์มเข้าสู่ระบบ */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-ink mb-1">
            {audience === 'CITIZEN' ? 'อีเมล หรือ เลขบัตรประชาชน 13 หลัก' : 'อีเมล'}
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <input
              type="text"
              id="input-login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={audience === 'CITIZEN' ? 'example@thaiplease.go.th' : 'อีเมลที่ลงทะเบียน'}
              className="w-full rounded-pill border border-hairline bg-surface-soft/40 pl-10 pr-4 py-2.5 text-xs text-ink focus:bg-white focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-ink">รหัสผ่าน</label>
            <a href="#" className="text-[11px] text-brand-blue hover:underline">
              ลืมรหัสผ่าน?
            </a>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <input
              type="password"
              id="input-login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-pill border border-hairline bg-surface-soft/40 pl-10 pr-4 py-2.5 text-xs text-ink focus:bg-white focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>
        </div>

        <button
          type="submit"
          id="btn-login-submit"
          disabled={isSubmitting}
          className="w-full rounded-pill bg-brand-blue py-3 text-xs sm:text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-brand-blue-hover transition active:scale-98"
        >
          {isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>

      {/* ทางลัดทดสอบระบบ (Demo Fast Login สำหรับตรวจเช็คทุกสถานการณ์) */}
      <div className="pt-2 border-t border-hairline">
        <span className="block text-[11px] font-semibold text-ink-muted text-center mb-2.5">
          เข้าสู่ระบบด่วนเพื่อตรวจสอบสถานะตามบทบาท (Demo Test Accounts):
        </span>
        <p className="mb-2 text-center text-[10px] text-amber-700">
          บัญชี Demo ใช้ทดสอบหน้าจอเท่านั้น ไม่สามารถเรียก API ของระบบได้
        </p>
        <div className="space-y-1.5">
          <button
            type="button"
            id="btn-demo-citizen"
            onClick={() => void handleRealDemoLogin('CITIZEN')}
            className="w-full flex items-center justify-between rounded-xl border border-hairline bg-surface-soft/60 hover:bg-blue-50 hover:border-blue-200 p-2.5 text-xs font-medium text-ink transition group"
          >
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 rounded-lg bg-blue-100 text-brand-blue flex items-center justify-center">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <span className="font-bold block">1. ประชาชน (Citizen)</span>
                <span className="text-[10px] text-ink-muted">กระเป๋าเงินดิจิทัล &amp; สแกน Co-pay 60/40</span>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-brand-blue group-hover:translate-x-1 transition" />
          </button>

          <button
            type="button"
            id="btn-demo-merchant"
            onClick={() => void handleRealDemoLogin('MERCHANT')}
            className="w-full flex items-center justify-between rounded-xl border border-hairline bg-surface-soft/60 hover:bg-emerald-50 hover:border-emerald-200 p-2.5 text-xs font-medium text-ink transition group"
          >
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Store className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <span className="font-bold block">2. ร้านค้า (Merchant)</span>
                <span className="text-[10px] text-ink-muted">สร้าง Dynamic QR &amp; ยอดขายหน้าร้าน</span>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-emerald-700 group-hover:translate-x-1 transition" />
          </button>

          <button
            type="button"
            id="btn-demo-admin"
            onClick={() => void handleRealDemoLogin('ADMIN')}
            className="w-full flex items-center justify-between rounded-xl border border-hairline bg-surface-soft/60 hover:bg-red-50 hover:border-red-200 p-2.5 text-xs font-medium text-ink transition group"
          >
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 rounded-lg bg-red-100 text-status-error flex items-center justify-center">
                <ShieldAlert className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <span className="font-bold block">3. ผู้ดูแลระบบ (Admin)</span>
                <span className="text-[10px] text-ink-muted">ตรวจสอบความผิดปกติ &amp; GPS Geofence</span>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-status-error group-hover:translate-x-1 transition" />
          </button>
        </div>
      </div>

      {audience === 'MERCHANT' ? (
        <div className="text-xs text-center text-ink-muted pt-2 border-t border-hairline">
          ยังไม่ได้ลงทะเบียนร้านค้า?{' '}
          <Link to={APP_ROUTES.MERCHANT_REGISTER} className="text-brand-blue font-semibold hover:underline">
            สมัครเป็นร้านค้า
          </Link>
        </div>
      ) : audience === 'CITIZEN' ? (
        <div className="text-xs text-center text-ink-muted pt-2 border-t border-hairline">
          ยังไม่มีบัญชีผู้ใช้งาน?{' '}
          <Link to={APP_ROUTES.REGISTER} className="text-brand-blue font-semibold hover:underline">
            ลงทะเบียนรับสิทธิ์
          </Link>
        </div>
      ) : null}
    </div>
  );
};
