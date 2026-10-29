import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES, homeRouteForRole } from '../../constants/routes';
import { citizenProvinceOptions, isValidThaiCitizenId, submitCitizenRegistrationMock } from '../../services/citizenRegistrationMock';

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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    try {
      const response = await submitCitizenRegistrationMock({
        fullName: fullName.trim(),
        citizenId,
        provinceCode,
        email: email.trim(),
        password,
      }, clearSensitiveFields, import.meta.env.VITE_DEMO_CITIZEN_USER_ID);
      setFullName('');
      setProvinceCode('');
      setEmail('');
      setAuth(response.data.user, response.data.token);
      navigate(homeRouteForRole(response.data.user.role) || APP_ROUTES.CITIZEN_WALLET, { replace: true });
    } catch {
      setErrorMessage('เข้าสู่ระบบประชาชนทดสอบไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 font-sans">
      <div className="text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
          <span className="text-lg font-bold" aria-hidden="true">ป</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">สมัครสมาชิกประชาชน</h2>
        <p className="mt-1 text-xs text-ink-muted">กรอกข้อมูลสำหรับจำลองการสมัครสมาชิก</p>
      </div>

      <div role="status" className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
        โหมดทดลอง: ไม่ได้สร้างบัญชีจริง ข้อมูลไม่ถูกบันทึก
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-status-error">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="citizen-full-name" className="mb-1 block text-sm font-semibold text-ink">ชื่อ-นามสกุล</label>
          <input id="citizen-full-name" name="fullName" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="citizen-id" className="mb-1 block text-sm font-semibold text-ink">เลขบัตรประชาชน 13 หลัก</label>
          <input id="citizen-id" name="citizenId" inputMode="numeric" autoComplete="off" pattern="[0-9]{13}" maxLength={13} required value={citizenId} onChange={(event) => setCitizenId(event.target.value.replace(/\D/g, '').slice(0, 13))} className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="citizen-province" className="mb-1 block text-sm font-semibold text-ink">จังหวัด</label>
          <select id="citizen-province" name="provinceCode" required value={provinceCode} onChange={(event) => setProvinceCode(event.target.value)} className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100">
            <option value="">เลือกจังหวัด</option>
            {citizenProvinceOptions.map((province) => (
              <option key={province.code} value={province.code}>{province.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="citizen-email" className="mb-1 block text-sm font-semibold text-ink">อีเมล</label>
          <input id="citizen-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="citizen-password" className="mb-1 block text-sm font-semibold text-ink">รหัสผ่าน (8–72 ตัวอักษร)</label>
          <input id="citizen-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="citizen-password-confirmation" className="mb-1 block text-sm font-semibold text-ink">ยืนยันรหัสผ่าน</label>
          <input id="citizen-password-confirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} className="min-h-11 w-full rounded-xl border border-hairline bg-white px-3 text-sm text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
        </div>
        <button type="submit" disabled={isSubmitting} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:cursor-wait disabled:opacity-60">
          {isSubmitting ? 'กำลังเข้าสู่ระบบบัญชีทดสอบ…' : 'สมัครสมาชิกทดลอง'}
        </button>
      </form>
    </div>
  );
};
