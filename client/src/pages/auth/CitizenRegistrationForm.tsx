import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, LoaderCircle, User, UserPlus } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES, homeRouteForRole } from '../../constants/routes';
import { authApi } from '../../services/authApi';
import { requestDemoLogin } from '../../services/demoLogin';
import { citizenProvinceOptions, isValidThaiCitizenId } from '../../utils/thaiCitizenId';

export const CitizenRegistrationForm: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [fullName, setFullName] = useState('');
  const [citizenId, setCitizenId] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isDevMode = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  const demoCitizenUserId = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_DEMO_CITIZEN_USER_ID : undefined;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoLoggingIn, setIsDemoLoggingIn] = useState(false);

  const clearSensitiveFields = () => {
    setCitizenId('');
    setPassword('');
    setPasswordConfirmation('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('กรุณากรอกชื่อและนามสกุล');
      return;
    }
    if (!isValidThaiCitizenId(citizenId)) {
      setErrorMessage('เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบเลข 13 หลัก');
      return;
    }
    if (!provinceCode) {
      setErrorMessage('กรุณาเลือกจังหวัด');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setErrorMessage('รหัสผ่านต้องมีความยาว 8–72 ตัวอักษร');
      return;
    }
    if (password !== passwordConfirmation) {
      setErrorMessage('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    const submittedCitizenId = citizenId;
    const submittedPassword = password;
    clearSensitiveFields();

    try {
      await authApi.registerCitizen({
        fullName: fullName.trim(),
        citizenId: submittedCitizenId,
        provinceCode,
        email: email.trim(),
        password: submittedPassword,
      });

      setFullName('');
      setProvinceCode('');
      setEmail('');

      navigate(APP_ROUTES.LOGIN, {
        state: { registeredMessage: 'ลงทะเบียนประชาชนสำเร็จ กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่านของคุณ' },
        replace: true,
      });
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        const serverMessage = error.response.data?.message;

        if (status === 409) {
          setErrorMessage(serverMessage || 'ข้อมูลการสมัครซ้ำกับในระบบ กรุณาตรวจสอบเลขบัตรหรืออีเมล');
        } else if (status === 429) {
          setErrorMessage(serverMessage || 'ทำรายการเกินจำนวนครั้งที่กำหนด (จำกัด 5 ครั้งต่อชั่วโมง) กรุณารอสักครู่แล้วลองใหม่');
        } else if (status === 503) {
          setErrorMessage(serverMessage || 'ระบบไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่ในภายหลัง');
        } else {
          setErrorMessage(serverMessage || 'การลงทะเบียนไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่');
        }
      } else {
        setErrorMessage('เชื่อมต่อระบบไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsDemoLoggingIn(true);
    setErrorMessage(null);
    try {
      const response = await requestDemoLogin('CITIZEN', demoCitizenUserId);
      setAuth(response.data.user, response.data.token);
      navigate(homeRouteForRole(response.data.user.role) || APP_ROUTES.CITIZEN_WALLET, { replace: true });
    } catch {
      setErrorMessage('เข้าสู่ระบบประชาชนทดสอบไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsDemoLoggingIn(false);
    }
  };

  return (
    <div className="space-y-5 font-sans">
      <div className="text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
          <UserPlus className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">สมัครสมาชิกประชาชน</h2>
        <p className="mt-1 text-xs text-ink-muted">กรอกข้อมูลเพื่อลงทะเบียนรับสิทธิ์โครงการ THAI Please</p>
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-status-error">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="citizen-full-name" className="mb-1 block text-sm font-semibold text-ink">ชื่อ-นามสกุล</label>
          <input
            id="citizen-full-name"
            name="fullName"
            autoComplete="name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label htmlFor="citizen-id" className="mb-1 block text-sm font-semibold text-ink">เลขบัตรประชาชน 13 หลัก</label>
          <input
            id="citizen-id"
            name="citizenId"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]{13}"
            maxLength={13}
            required
            value={citizenId}
            onChange={(event) => setCitizenId(event.target.value.replace(/\D/g, '').slice(0, 13))}
            className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label htmlFor="citizen-province" className="mb-1 block text-sm font-semibold text-ink">จังหวัด</label>
          <select
            id="citizen-province"
            name="provinceCode"
            required
            value={provinceCode}
            onChange={(event) => setProvinceCode(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">เลือกจังหวัด</option>
            {citizenProvinceOptions.map((province) => (
              <option key={province.code} value={province.code}>{province.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="citizen-email" className="mb-1 block text-sm font-semibold text-ink">อีเมล</label>
          <input
            id="citizen-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label htmlFor="citizen-password" className="mb-1 block text-sm font-semibold text-ink">รหัสผ่าน (8–72 ตัวอักษร)</label>
          <input
            id="citizen-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label htmlFor="citizen-password-confirmation" className="mb-1 block text-sm font-semibold text-ink">ยืนยันรหัสผ่าน</label>
          <input
            id="citizen-password-confirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={72}
            required
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isDemoLoggingIn}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:cursor-wait disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              กำลังลงทะเบียน…
            </>
          ) : (
            'สมัครสมาชิก'
          )}
        </button>
      </form>

      <div className="border-t border-hairline pt-3 text-center text-xs text-ink-muted">
        มีบัญชีอยู่แล้ว?{' '}
        <Link to={APP_ROUTES.LOGIN} className="font-semibold text-brand-blue hover:underline">
          เข้าสู่ระบบ
        </Link>
      </div>

      {isDevMode && (
        <div className="space-y-2 border-t border-hairline pt-3">
          <p className="text-center text-xs font-semibold text-ink-muted">สำหรับทดสอบ (DEV เท่านั้น)</p>
          <button
            type="button"
            onClick={() => void handleDemoLogin()}
            disabled={isSubmitting || isDemoLoggingIn}
            className="group flex min-h-11 w-full items-center justify-between rounded-xl border border-hairline bg-surface-soft/60 p-3 text-left text-xs font-medium text-ink transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <User className="h-4 w-4 text-brand-blue" aria-hidden="true" />
              {isDemoLoggingIn ? 'กำลังเข้าสู่ระบบบัญชีทดสอบ…' : 'เข้าสู่ระบบประชาชนทดสอบ (DEV)'}
            </span>
            <ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
