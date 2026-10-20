import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Home } from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center font-sans">
      <div className="max-w-md w-full bg-white rounded-card border border-hairline p-8 shadow-sm space-y-4">
        <div className="h-16 w-16 mx-auto rounded-3xl bg-red-50 text-status-error flex items-center justify-center shadow-xs">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-ink font-mono tracking-tight">404</h1>
        <h2 className="text-base font-bold text-ink">ไม่พบหน้าที่คุณต้องการ</h2>
        <p className="text-xs text-ink-muted leading-relaxed">
          หน้าเว็บที่คุณกำลังเข้าถึงอาจถูกย้าย ลบ หรือคุณอาจพิมพ์ที่อยู่ URL ไม่ถูกต้อง
        </p>
        <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            to={APP_ROUTES.HOME}
            className="inline-flex items-center justify-center space-x-1.5 rounded-pill bg-brand-blue px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-blue-hover transition"
          >
            <Home className="h-4 w-4" />
            <span>กลับสู่หน้าหลัก</span>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center space-x-1.5 rounded-pill border border-hairline bg-surface-soft px-4 py-2.5 text-xs font-medium text-ink hover:bg-gray-200 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>ย้อนกลับ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
