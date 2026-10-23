import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  MapPin,
  RefreshCw,
  Store,
  XCircle,
} from 'lucide-react';
import {
  decideMerchantApplication,
  getMerchantApplication,
  getMerchantApplications,
  MerchantApplicationStatus,
} from '../../../services/merchantApplicationApi';
import { APP_ROUTES } from '../../../constants/routes';

const STATUS_TABS: Array<{ value: MerchantApplicationStatus; label: string }> = [
  { value: 'PENDING', label: 'รอตรวจสอบ' },
  { value: 'APPROVED', label: 'อนุมัติแล้ว' },
  { value: 'REJECTED', label: 'ปฏิเสธ' },
];

const getErrorMessage = (error: unknown): string => {
  if (isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? 'ไม่สามารถเชื่อมต่อระบบได้';
  }
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export const AdminMerchantApplicationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<MerchantApplicationStatus>('PENDING');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const applicationsQuery = useQuery({
    queryKey: ['merchant-applications', status],
    queryFn: () => getMerchantApplications(status),
    refetchInterval: status === 'PENDING' ? 30000 : false,
  });

  const detailsQuery = useQuery({
    queryKey: ['merchant-application', selectedId],
    queryFn: () => getMerchantApplication(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const decisionMutation = useMutation({
    mutationFn: (decision: { action: 'APPROVE' | 'REJECT'; note?: string }) =>
      decideMerchantApplication(selectedId as string, decision.action, decision.note),
    onSuccess: async (_result, decision) => {
      setFeedback(decision.action === 'APPROVE' ? 'อนุมัติร้านค้าเรียบร้อยแล้ว' : 'บันทึกการปฏิเสธคำขอแล้ว');
      setRejectionNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['merchant-applications'] }),
        queryClient.invalidateQueries({ queryKey: ['merchant-application', selectedId] }),
      ]);
      if (decision.action === 'APPROVE') setStatus('APPROVED');
      if (decision.action === 'REJECT') setStatus('REJECTED');
    },
  });

  const applications = applicationsQuery.data ?? [];
  const selected = detailsQuery.data;
  const actionError = decisionMutation.error ? getErrorMessage(decisionMutation.error) : null;

  return (
    <div className="min-h-screen bg-surface-soft pb-24 font-sans text-ink">
      <header className="mb-5 border-b border-hairline bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-brand-blue">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold sm:text-lg">ตรวจสอบคำขอร้านค้า</h1>
              <p className="text-xs text-ink-muted">ตรวจข้อมูลและเอกสารก่อนเปิดสิทธิ์เข้า Merchant Web App</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void applicationsQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-pill border border-hairline bg-white px-3 py-2 text-xs font-semibold hover:bg-surface-soft"
          >
            <RefreshCw className="h-4 w-4 text-brand-blue" />
            <span className="hidden sm:inline">รีเฟรช</span>
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)]">
        <section className="min-w-0 rounded-2xl border border-hairline bg-white shadow-sm">
          <div className="flex border-b border-hairline">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatus(tab.value);
                  setSelectedId(null);
                  setFeedback(null);
                }}
                className={`flex-1 px-2 py-3 text-xs font-semibold transition ${
                  status === tab.value ? 'border-b-2 border-brand-blue text-brand-blue' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {applicationsQuery.isLoading ? (
            <p className="p-5 text-sm text-ink-muted">กำลังโหลดคำขอ...</p>
          ) : applicationsQuery.error ? (
            <p role="alert" className="p-5 text-sm text-status-error">{getErrorMessage(applicationsQuery.error)}</p>
          ) : applications.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-muted">
              <Clock3 className="mx-auto mb-2 h-6 w-6" />
              ไม่มีคำขอในสถานะนี้
            </div>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-hairline overflow-y-auto">
              {applications.map((application) => (
                <li key={application.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(application.id);
                      setRejectionNote('');
                      setFeedback(null);
                      decisionMutation.reset();
                    }}
                    className={`w-full p-4 text-left transition hover:bg-surface-soft ${
                      selectedId === application.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{application.businessName}</span>
                        <span className="mt-1 block truncate text-xs text-ink-muted">{application.contactName}</span>
                      </span>
                      {application.status === 'APPROVED' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" />
                      ) : application.status === 'REJECTED' ? (
                        <XCircle className="h-4 w-4 shrink-0 text-status-error" />
                      ) : (
                        <Clock3 className="h-4 w-4 shrink-0 text-amber-600" />
                      )}
                    </span>
                    <span className="mt-2 block text-[11px] text-ink-muted">
                      ยื่น {formatDate(application.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:p-6">
          {!selectedId ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center text-sm text-ink-muted">
              <Store className="mb-3 h-8 w-8" />
              เลือกคำขอร้านค้าเพื่อดูรายละเอียดและเอกสาร
            </div>
          ) : detailsQuery.isLoading ? (
            <p className="p-4 text-sm text-ink-muted">กำลังโหลดรายละเอียดและเอกสาร...</p>
          ) : detailsQuery.error ? (
            <p role="alert" className="p-4 text-sm text-status-error">{getErrorMessage(detailsQuery.error)}</p>
          ) : selected ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{selected.businessName}</h2>
                  <p className="mt-1 text-xs text-ink-muted">
                    {selected.businessType === 'JURISTIC' ? 'นิติบุคคล' : 'บุคคลธรรมดา'} · ยื่น {formatDate(selected.createdAt)}
                  </p>
                </div>
                <span className={`rounded-pill px-3 py-1 text-xs font-semibold ${
                  selected.status === 'PENDING'
                    ? 'bg-amber-50 text-amber-800'
                    : selected.status === 'APPROVED'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-red-50 text-red-800'
                }`}>
                  {STATUS_TABS.find((tab) => tab.value === selected.status)?.label}
                </span>
              </div>
              {selected.status === 'APPROVED' && selected.merchantId && (
                <Link
                  to={`${APP_ROUTES.ADMIN_MERCHANTS}/${selected.merchantId}/edit`}
                  className="inline-flex items-center gap-2 rounded-pill border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-brand-blue hover:bg-blue-100"
                >
                  <Store className="h-4 w-4" /> แก้ไขข้อมูลร้านค้าที่อนุมัติแล้ว
                </Link>
              )}

              <dl className="grid gap-3 rounded-xl bg-surface-soft p-4 text-xs sm:grid-cols-2">
                <div><dt className="text-ink-muted">ผู้ติดต่อ</dt><dd className="mt-1 font-semibold">{selected.contactName}</dd></div>
                <div><dt className="text-ink-muted">เลขประจำตัวผู้เสียภาษี</dt><dd className="mt-1 font-semibold">{selected.taxId}</dd></div>
                <div><dt className="text-ink-muted">อีเมล</dt><dd className="mt-1 font-semibold">{selected.email}</dd></div>
                <div><dt className="text-ink-muted">โทรศัพท์</dt><dd className="mt-1 font-semibold">{selected.phone}</dd></div>
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">ที่อยู่ร้าน</dt>
                  <dd className="mt-1 font-semibold">{selected.address}</dd>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-blue hover:underline"
                  >
                    <MapPin className="h-3.5 w-3.5" /> ดูตำแหน่งร้านบนแผนที่
                  </a>
                </div>
              </dl>

              <div>
                <h3 className="mb-2 text-sm font-bold">เอกสารยืนยัน</h3>
                <ul className="space-y-2">
                  {selected.documents.map((document) => (
                    <li key={document.id} className="flex items-center justify-between gap-3 rounded-xl border border-hairline p-3">
                      <span className="flex min-w-0 items-center gap-2 text-xs">
                        <FileText className="h-4 w-4 shrink-0 text-brand-blue" />
                        <span className="truncate">
                          <span className="block font-semibold">{document.label}</span>
                          <span className="text-ink-muted">{(document.fileSize / (1024 * 1024)).toFixed(2)} MB · {document.mimeType}</span>
                        </span>
                      </span>
                      {document.signedUrl && (
                        <a
                          href={document.signedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-blue-50 px-3 py-1.5 text-xs font-semibold text-brand-blue hover:bg-blue-100"
                        >
                          เปิด <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {selected.rejectionReason && (
                <p className="rounded-xl bg-red-50 p-3 text-xs text-red-800">
                  เหตุผลที่ปฏิเสธ: {selected.rejectionReason}
                </p>
              )}

              {feedback && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{feedback}</p>}
              {actionError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-status-error">{actionError}</p>}

              {selected.status === 'PENDING' && (
                <div className="space-y-3 border-t border-hairline pt-4">
                  <label htmlFor="merchant-rejection-note" className="block text-xs font-semibold">
                    เหตุผลประกอบการปฏิเสธ (อย่างน้อย 10 ตัวอักษรเมื่อเลือกปฏิเสธ)
                  </label>
                  <textarea
                    id="merchant-rejection-note"
                    value={rejectionNote}
                    onChange={(event) => setRejectionNote(event.target.value)}
                    rows={3}
                    maxLength={1000}
                    className="w-full rounded-xl border border-hairline px-3 py-2 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="ระบุเหตุผลที่ผู้สมัครนำไปแก้ไขหรือชี้แจงได้"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={decisionMutation.isPending}
                      onClick={() => {
                        if (window.confirm('ยืนยันอนุมัติร้านค้านี้? ร้านค้าจะสามารถเข้าสู่ Merchant Web App ได้')) {
                          decisionMutation.mutate({ action: 'APPROVE' });
                        }
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-pill bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" /> อนุมัติร้านค้า
                    </button>
                    <button
                      type="button"
                      disabled={decisionMutation.isPending || rejectionNote.trim().length < 10}
                      onClick={() => {
                        if (window.confirm('ยืนยันปฏิเสธคำขอนี้?')) {
                          decisionMutation.mutate({ action: 'REJECT', note: rejectionNote.trim() });
                        }
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-pill border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-status-error hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" /> ปฏิเสธคำขอ
                    </button>
                  </div>
                </div>
              )}

              {selected.history && selected.history.length > 0 && (
                <div className="border-t border-hairline pt-4">
                  <h3 className="mb-2 text-sm font-bold">ประวัติการพิจารณา</h3>
                  <ul className="space-y-2 text-xs text-ink-muted">
                    {selected.history.map((entry, index) => (
                      <li key={`${entry.createdAt}-${index}`}>
                        {formatDate(entry.createdAt)} · {entry.reviewedBy} · {entry.action}
                        {entry.note ? ` — ${entry.note}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
};
