import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, ExternalLink, MapPin, RefreshCw, XCircle } from 'lucide-react';
import {
  decideMerchantLocationChange,
  getMerchantLocationChangeRequests,
  MerchantLocationChangeRequest,
} from '../../../services/merchantProfileApi';

const getErrorMessage = (error: unknown): string => {
  if (isAxiosError<{ message?: string }>(error)) return error.response?.data?.message ?? 'ไม่สามารถเชื่อมต่อระบบได้';
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
};

const coordinatesUrl = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

export const AdminMerchantLocationRequestsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const requestsQuery = useQuery({
    queryKey: ['merchant-location-change-requests'],
    queryFn: getMerchantLocationChangeRequests,
    refetchInterval: 30000,
  });
  const decisionMutation = useMutation({
    mutationFn: (decision: { requestId: string; action: 'APPROVE' | 'REJECT'; note?: string }) =>
      decideMerchantLocationChange(decision.requestId, decision.action, decision.note),
    onSuccess: async (_result, decision) => {
      setFeedback(decision.action === 'APPROVE' ? 'อนุมัติพิกัดใหม่แล้ว' : 'ปฏิเสธคำขอเปลี่ยนพิกัดแล้ว');
      setNotes((current) => ({ ...current, [decision.requestId]: '' }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['merchant-location-change-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['approved-merchants'] }),
      ]);
    },
  });
  const requests = requestsQuery.data ?? [];

  const locationLink = (label: string, latitude: number, longitude: number) => (
    <a href={coordinatesUrl(latitude, longitude)} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">
      <MapPin className="h-3.5 w-3.5" /> {label}: {latitude.toFixed(6)}, {longitude.toFixed(6)}
      <ExternalLink className="h-3 w-3" />
    </a>
  );

  const decide = (request: MerchantLocationChangeRequest, action: 'APPROVE' | 'REJECT') => {
    const note = notes[request.requestId]?.trim();
    if (action === 'REJECT' && (!note || note.length < 10)) return;
    if (!window.confirm(action === 'APPROVE' ? 'ยืนยันอนุมัติพิกัดใหม่? พิกัดจะมีผลกับระบบทันที' : 'ยืนยันปฏิเสธคำขอเปลี่ยนพิกัด?')) return;
    decisionMutation.mutate({ requestId: request.requestId, action, ...(note ? { note } : {}) });
  };

  return (
    <div className="min-h-screen bg-surface-soft pb-24 font-sans text-ink">
      <header className="border-b border-hairline bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><MapPin className="h-5 w-5" /></div>
            <div>
              <h1 className="text-base font-bold sm:text-lg">คำขอเปลี่ยนพิกัดร้านค้า</h1>
              <p className="text-xs text-ink-muted">ตรวจสอบตำแหน่งเดิมและตำแหน่งใหม่ก่อนอนุมัติ</p>
            </div>
          </div>
          <button type="button" onClick={() => void requestsQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-pill border border-hairline px-3 py-2 text-xs font-semibold hover:bg-surface-soft">
            <RefreshCw className="h-4 w-4 text-brand-blue" /> รีเฟรช
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6">
        {feedback && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{feedback}</p>}
        {decisionMutation.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-status-error">{getErrorMessage(decisionMutation.error)}</p>}
        {requestsQuery.isLoading ? (
          <p className="rounded-2xl border border-hairline bg-white p-6 text-sm text-ink-muted">กำลังโหลดคำขอ...</p>
        ) : requestsQuery.error ? (
          <p role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-sm text-status-error">{getErrorMessage(requestsQuery.error)}</p>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-white p-8 text-center text-sm text-ink-muted">
            <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-status-success" /> ไม่มีคำขอเปลี่ยนพิกัดที่รอตรวจสอบ
          </div>
        ) : requests.map((request) => (
          <section key={request.requestId} className="space-y-4 rounded-2xl border border-hairline bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold">{request.businessName}</h2>
                <p className="mt-1 text-xs text-ink-muted">เลขผู้เสียภาษี {request.taxId} · {request.address}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-pill bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                <Clock3 className="h-3.5 w-3.5" /> รอตรวจสอบ
              </span>
            </div>
            <div className="grid gap-3 rounded-xl bg-surface-soft p-4 sm:grid-cols-2">
              {locationLink('พิกัดปัจจุบัน', request.currentLatitude, request.currentLongitude)}
              {locationLink('พิกัดที่ร้านขอ', request.requestedLatitude, request.requestedLongitude)}
              <p className="text-xs text-ink-muted sm:col-span-2">
                <a href={coordinatesUrl(request.currentLatitude, request.currentLongitude)} target="_blank" rel="noreferrer" className="font-semibold text-brand-blue hover:underline">เปิดพิกัดเดิม</a>
                {' · '}
                <a href={coordinatesUrl(request.requestedLatitude, request.requestedLongitude)} target="_blank" rel="noreferrer" className="font-semibold text-brand-blue hover:underline">เปิดพิกัดใหม่</a>
              </p>
            </div>
            <label className="block space-y-1.5 text-xs font-semibold">
              หมายเหตุ / เหตุผลปฏิเสธ (เมื่อปฏิเสธต้องกรอกอย่างน้อย 10 ตัวอักษร)
              <textarea rows={2} maxLength={1000} value={notes[request.requestId] ?? ''}
                onChange={(event) => setNotes((current) => ({ ...current, [request.requestId]: event.target.value }))}
                className="w-full rounded-xl border border-hairline px-3 py-2 text-xs font-normal focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={decisionMutation.isPending}
                onClick={() => decide(request, 'APPROVE')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-pill bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" /> อนุมัติพิกัด
              </button>
              <button type="button" disabled={decisionMutation.isPending || (notes[request.requestId] ?? '').trim().length < 10}
                onClick={() => decide(request, 'REJECT')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-pill border border-red-200 bg-white px-4 py-2.5 text-xs font-semibold text-status-error hover:bg-red-50 disabled:opacity-50">
                <XCircle className="h-4 w-4" /> ปฏิเสธคำขอ
              </button>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
};
