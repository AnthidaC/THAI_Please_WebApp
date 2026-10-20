import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, User, CreditCard, MapPin, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { APP_ROUTES } from '../../constants/routes';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [fullName, setFullName] = useState('');
  const [citizenId, setCitizenId] = useState('');
  const [provinceCode, setProvinceCode] = useState('10'); // กทม.
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !citizenId || !password) {
      setErrorMsg('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง');
      return;
    }
    if (citizenId.length !== 13) {
      setErrorMsg('เลขประจำตัวประชาชนต้องมี 13 หลัก');
      return;
    }

    setIsSuccess(true);
    setTimeout(() => {
      const mockUser = {
        id: 'new-registered-user',
        email: `${citizenId}@thaiplease.go.th`,
        name: fullName,
        role: 'USER' as const,
        createdAt: new Date().toISOString(),
      };
      setAuth(mockUser, 'demo-token-citizen-new');
      navigate(APP_ROUTES.CITIZEN_WALLET);
    }, 1200);
  };

  return (
    <div className="space-y-5 font-sans">
      <div className="text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20 mb-3">
          <UserPlus className="h-6 w-6" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
          ลงทะเบียนรับสิทธิ์โครงการ
        </h2>
        <p className="text-xs text-ink-muted mt-1">
          ไทยช่วยไทยพลีส (THAI Please) • สิทธิรัฐสมทบ 60%
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-status-error flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isSuccess ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-2 animate-in fade-in">
          <CheckCircle2 className="h-10 w-10 text-status-success mx-auto" />
          <h3 className="text-sm font-bold text-emerald-800">ลงทะเบียนและตรวจสอบสิทธิ์สำเร็จ!</h3>
          <p className="text-xs text-emerald-700">กำลังนำคุณเข้าสู่กระเป๋าเงินดิจิทัล...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              ชื่อ-นามสกุล (ตามบัตรประชาชน)
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
              <input
                type="text"
                id="input-register-fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="เช่น นายสมชาย ใจดี"
                className="w-full rounded-pill border border-hairline bg-surface-soft/40 pl-10 pr-4 py-2.5 text-xs text-ink focus:bg-white focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              เลขประจำตัวประชาชน 13 หลัก
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
              <input
                type="text"
                id="input-register-citizenid"
                maxLength={13}
                inputMode="numeric"
                value={citizenId}
                onChange={(e) => setCitizenId(e.target.value.replace(/\D/g, ''))}
                placeholder="1100501234567"
                className="w-full rounded-pill border border-hairline bg-surface-soft/40 pl-10 pr-4 py-2.5 font-mono text-xs text-ink focus:bg-white focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              จังหวัดที่อยู่ตามทะเบียนบ้าน
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <select
                id="select-register-province"
                value={provinceCode}
                onChange={(e) => setProvinceCode(e.target.value)}
                className="w-full rounded-pill border border-hairline bg-surface-soft/40 pl-10 pr-4 py-2.5 text-xs text-ink focus:bg-white focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
              >
                <option value="10">กรุงเทพมหานคร</option>
                <option value="73">นครปฐม</option>
                <option value="12">นนทบุรี</option>
                <option value="13">ปทุมธานี</option>
                <option value="11">สมุทรปราการ</option>
                <option value="50">เชียงใหม่</option>
                <option value="40">ขอนแก่น</option>
                <option value="84">สุราษฎร์ธานี</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              กำหนดรหัสผ่าน (Password)
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
              <input
                type="password"
                id="input-register-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กำหนดรหัสผ่านอย่างน้อย 6 หลัก"
                className="w-full rounded-pill border border-hairline bg-surface-soft/40 pl-10 pr-4 py-2.5 text-xs text-ink focus:bg-white focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            id="btn-register-submit"
            className="w-full rounded-pill bg-emerald-600 py-3 text-xs sm:text-sm font-semibold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition active:scale-98"
          >
            ยืนยันลงทะเบียนรับสิทธิ์
          </button>
        </form>
      )}

      <div className="text-xs text-center text-ink-muted pt-2 border-t border-hairline">
        มีบัญชีและเคยลงทะเบียนแล้ว?{' '}
        <Link to={APP_ROUTES.LOGIN} className="text-brand-blue font-semibold hover:underline">
          เข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
};
