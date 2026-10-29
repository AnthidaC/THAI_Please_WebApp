import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Clock3 } from 'lucide-react';
import { APP_ROUTES } from '../../../constants/routes';
import { getOwnMerchantApplicationStatus, OwnMerchantApplicationStatus } from '../../../services/merchantApplicationApi';
import { useAuthStore } from '../../../stores/authStore';

export const MerchantApplicationStatusPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const navigate = useNavigate();
  const [application, setApplication] = useState<OwnMerchantApplicationStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    getOwnMerchantApplicationStatus()
      .then((result) => { if (active) setApplication(result); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  if (!user || user.role !== 'MERCHANT_APPLICATION_STATUS') {
    return <Navigate to={APP_ROUTES.LOGIN} replace />;
  }

  return (
    <main className="min-h-[70vh] bg-surface-soft px-4 py-8 font-sans text-ink sm:px-6">
      <section className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-hairline bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${application?.status === 'REJECTED' ? 'bg-red-50 text-status-error' : 'bg-amber-50 text-amber-700'}`}>
            {application?.status === 'REJECTED' ? <AlertCircle aria-hidden="true" className="h-6 w-6" /> : <Clock3 aria-hidden="true" className="h-6 w-6" />}
          </span>
          <div>
            <h1 className="text-2xl font-bold">
              {application?.status === 'REJECTED'
                ? 'คำขอสมัครร้านค้าไม่ผ่านการอนุมัติ'
                : application?.status === 'APPROVED' ? 'ร้านค้าได้รับอนุมัติแล้ว' : 'ใบสมัครร้านค้าอยู่ระหว่างตรวจสอบ'}
            </h1>
            <p className="mt-2 text-base text-ink-muted">
              {application?.status === 'REJECTED'
                ? 'ตรวจสอบเหตุผลด้านล่าง และติดต่อผู้ดูแลหากต้องการข้อมูลเพิ่มเติม'
                : application?.status === 'APPROVED'
                  ? 'ออกจากระบบแล้วเข้าสู่ระบบอีกครั้ง เพื่อเปิดใช้งานบัญชีร้านค้าที่ได้รับอนุมัติ'
                  : 'เจ้าหน้าที่กำลังตรวจสอบข้อมูลสมัครร้านค้าของคุณ'}
            </p>
          </div>
        </div>

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-status-error">โหลดสถานะไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่อีกครั้ง</p>}
        {!application && !error && <p role="status" className="text-sm text-ink-muted">กำลังโหลดสถานะใบสมัคร…</p>}

        {application && <dl className="grid gap-3 rounded-xl bg-surface-soft p-4 text-base sm:grid-cols-2">
          <div><dt className="text-sm text-ink-muted">สถานะ</dt><dd className="font-semibold">{application.status === 'PENDING' ? 'รอตรวจสอบ' : application.status === 'APPROVED' ? 'อนุมัติแล้ว' : 'ถูกปฏิเสธ'}</dd></div>
          <div><dt className="text-sm text-ink-muted">วันที่ส่งใบสมัคร</dt><dd className="font-semibold">{new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(application.submittedAt))}</dd></div>
          {application.status === 'REJECTED' && <div className="sm:col-span-2"><dt className="text-sm text-ink-muted">เหตุผลที่ปฏิเสธ</dt><dd className="mt-1 whitespace-pre-wrap font-semibold">{application.rejectionReason || 'ไม่มีเหตุผลเพิ่มเติมจากระบบ'}</dd></div>}
        </dl>}

        <button type="button" onClick={() => { clearAuth(); navigate(APP_ROUTES.LOGIN, { replace: true }); }} className="inline-flex min-h-11 items-center rounded-pill border border-hairline px-5 font-semibold text-brand-blue hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue">
          ออกจากระบบ
        </button>
      </section>
    </main>
  );
};
