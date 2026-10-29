import React from 'react';
import { Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';
import { CitizenRegistrationForm } from './CitizenRegistrationForm';

interface RegisterPageContentProps {
  isDevelopment: boolean;
}

const RegistrationUnavailable: React.FC = () => (
  <div className="space-y-5 font-sans">
    <div className="text-center">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
        <UserPlus className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">ลงทะเบียนรับสิทธิ์โครงการ</h2>
      <p className="mt-1 text-xs text-ink-muted">THAI Please • สิทธิ์รัฐสมทบ</p>
    </div>

    <div role="status" className="rounded-xl border border-hairline bg-surface-soft/50 p-4 text-sm leading-6 text-ink-muted">
      การสร้างบัญชีใหม่ยังไม่เปิดใช้ในระบบทดสอบ กรุณาเข้าสู่ระบบด้วยบัญชีจำลองที่ผู้พัฒนากำหนดไว้
    </div>

    <div className="border-t border-hairline pt-4 text-center text-xs text-ink-muted">
      มีบัญชีที่ลงทะเบียนแล้ว?{' '}
      <Link to={APP_ROUTES.LOGIN} className="font-semibold text-brand-blue hover:underline">เข้าสู่ระบบ</Link>
    </div>
  </div>
);

export const RegisterPageContent: React.FC<RegisterPageContentProps> = ({ isDevelopment }) => (
  isDevelopment ? <CitizenRegistrationForm /> : <RegistrationUnavailable />
);

export const RegisterPage: React.FC = () => (
  <RegisterPageContent isDevelopment={import.meta.env.DEV} />
);
