import React, { useState, useMemo } from 'react';
import {
  Users,
  Gift,
  Copy,
  Check,
  Share2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  ChevronRight,
  RefreshCw,
  Search,
  Info,
  Tag,
} from 'lucide-react';

/**
 * โครงสร้างข้อมูลรหัสแนะนำเพื่อนของฉัน (Single-Use Referral Code Model)
 * สอดคล้องกับ MyReferralCodeResult ของ Backend
 */
export interface MyReferralCode {
  referralId: string;
  referralCode: string;
  discountAmount: number;
  shareUrl: string;
  status: 'pending' | 'redeemed' | 'expired';
  expiresAt: string | null;
  createdAt: string;
}

/**
 * โครงสร้างรายการเพื่อนที่แนะนำ (Referred Friend Item)
 * สอดคล้องกับ ReferralFriendItem ของ Backend
 */
export interface ReferralFriendItem {
  referralId: string;
  referralCode: string;
  friendName: string;
  status: 'pending' | 'redeemed' | 'expired';
  discountAmount: number;
  merchantName: string | null;
  invitedAt: string;
  redeemedAt: string | null;
}

/**
 * สรุปสถิติการชวนเพื่อน (Referral Summary Metrics)
 * สอดคล้องกับ summary ใน ReferralStatsResult
 */
export interface ReferralStatsSummary {
  totalInvited: number;
  totalRedeemed: number;
  totalPending: number;
  totalDiscountGiven: number;
}

/**
 * ผลลัพธ์การตรวจสอบรหัสแนะนำเพื่อน
 */
export interface ReferralValidationState {
  code: string;
  isValid: boolean | null;
  referrerName?: string;
  discountAmount?: number;
  sourceDescription?: string;
  errorMessage?: string;
}

/**
 * ตัวเลือกสถานะพรีวิว UI สำหรับทดสอบการแสดงผล
 */
export type PreviewState = 'success' | 'loading' | 'empty' | 'error';

/**
 * ชุดข้อมูลจำลองสำหรับพรีวิว UI (Local Mock Data)
 */
const MOCK_ACTIVE_REFERRAL: MyReferralCode = {
  referralId: 'ref-001-active',
  referralCode: 'TP-8F3K9A',
  discountAmount: 30.0,
  shareUrl: 'https://thai-please.gov.th/register?ref=TP-8F3K9A',
  status: 'pending',
  expiresAt: null,
  createdAt: '2026-10-24T10:00:00.000Z',
};

const MOCK_SUMMARY: ReferralStatsSummary = {
  totalInvited: 5,
  totalRedeemed: 3,
  totalPending: 2,
  totalDiscountGiven: 90.0,
};

const MOCK_FRIENDS: ReferralFriendItem[] = [
  {
    referralId: 'ref-f1',
    referralCode: 'TP-9K2L1A',
    friendName: 'สมชาย ใ***',
    status: 'redeemed',
    discountAmount: 30.0,
    merchantName: 'โกอ่างข้าวมันไก่ ประตูน้ำ',
    invitedAt: '2026-10-23T14:30:00.000Z',
    redeemedAt: '2026-10-24T09:15:00.000Z',
  },
  {
    referralId: 'ref-f2',
    referralCode: 'TP-3M7N4B',
    friendName: 'วิภาดา ร***',
    status: 'redeemed',
    discountAmount: 30.0,
    merchantName: 'ชาตรามือ สยามสแควร์วัน',
    invitedAt: '2026-10-22T11:20:00.000Z',
    redeemedAt: '2026-10-23T13:45:00.000Z',
  },
  {
    referralId: 'ref-f3',
    referralCode: 'TP-5P8Q2C',
    friendName: 'ธนากร ส***',
    status: 'redeemed',
    discountAmount: 30.0,
    merchantName: 'ร้านข้าวมันไก่ป้าณี',
    invitedAt: '2026-10-20T08:10:00.000Z',
    redeemedAt: '2026-10-21T12:00:00.000Z',
  },
  {
    referralId: 'ref-f4',
    referralCode: 'TP-4J8H2X',
    friendName: 'กานดา น***',
    status: 'pending',
    discountAmount: 30.0,
    merchantName: null,
    invitedAt: '2026-10-24T08:00:00.000Z',
    redeemedAt: null,
  },
  {
    referralId: 'ref-f5',
    referralCode: 'TP-8F3K9A',
    friendName: 'รอเพื่อนลงทะเบียนและใช้สิทธิ์',
    status: 'pending',
    discountAmount: 30.0,
    merchantName: null,
    invitedAt: '2026-10-24T10:00:00.000Z',
    redeemedAt: null,
  },
];

export const CitizenReferralPage: React.FC = () => {
  // 1. สถานะตัวควบคุมการแสดงผลและพรีวิว UI
  const [previewState, setPreviewState] = useState<PreviewState>('success');
  const [friendFilter, setFriendFilter] = useState<'all' | 'redeemed' | 'pending'>('all');

  // 2. สถานะการคัดลอกและการแชร์รหัส
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // 3. สถานะเครื่องมือตรวจสอบรหัสคำชวนจากเพื่อน (Validation Tool State)
  const [inputCode, setInputCode] = useState<string>('');
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ReferralValidationState | null>(null);

  // ข้อมูลจำลองตามสถานะที่เลือก
  const activeReferral = previewState === 'empty' ? null : MOCK_ACTIVE_REFERRAL;
  const summary =
    previewState === 'empty'
      ? { totalInvited: 0, totalRedeemed: 0, totalPending: 0, totalDiscountGiven: 0 }
      : MOCK_SUMMARY;
  const friendsList = previewState === 'empty' ? [] : MOCK_FRIENDS;

  // กรองรายการเพื่อนตามแท็บที่เลือก
  const filteredFriends = useMemo(() => {
    if (friendFilter === 'all') return friendsList;
    return friendsList.filter((f) => f.status === friendFilter);
  }, [friendsList, friendFilter]);

  // ฟังก์ชันคัดลอกรหัสคำชวน
  const handleCopyCode = async (code: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback สำหรับเบราว์เซอร์รุ่นเก่า
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2200);
    } catch (err) {
      console.warn('Copy to clipboard failed:', err);
    }
  };

  // ฟังก์ชันแชร์รหัสผ่าน Web Share API
  const handleShareCode = async () => {
    if (!activeReferral) return;

    const shareData = {
      title: 'โครงการไทยช่วยไทยพลีส (THAI Please) - สิทธิ์ชวนเพื่อน Co-pay',
      text: `ใช้รหัสแนะนำ ${activeReferral.referralCode} เพื่อรับส่วนลดสมทบ Co-pay เพิ่มเติม ฿30.00 เมื่อสแกนจ่ายค่าอาหารและบริการ`,
      url: activeReferral.shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShareFeedback('แชร์ลิงก์คำชวนสำเร็จแล้ว');
        setTimeout(() => setShareFeedback(null), 3000);
      } catch (err) {
        // ผู้ใช้ยกเลิกการแชร์
      }
    } else {
      // Fallback: คัดลอกลิงก์แชร์อัตโนมัติ
      handleCopyCode(activeReferral.shareUrl);
      setShareFeedback('คัดลอกลิงก์คำชวนสำหรับส่งให้เพื่อนแล้ว');
      setTimeout(() => setShareFeedback(null), 3000);
    }
  };

  // ฟังก์ชันจำลองการตรวจสอบรหัสแนะนำเพื่อน (Validation Only - No Redemption)
  const handleValidateCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputCode.trim().toUpperCase();
    if (!clean) return;

    setIsValidating(true);
    setValidationResult(null);

    setTimeout(() => {
      setIsValidating(false);

      if (clean === activeReferral?.referralCode) {
        setValidationResult({
          code: clean,
          isValid: false,
          errorMessage: 'ไม่สามารถใช้รหัสแนะนำเพื่อนของตนเองได้',
        });
      } else if (clean === 'TP-FRIEND30' || clean === 'TP-9K2L1A' || clean === 'TP-DEMO') {
        setValidationResult({
          code: clean,
          isValid: true,
          referrerName: 'อนุชา พ***',
          discountAmount: 30.0,
          sourceDescription: 'ส่วนลดสิทธิพิเศษ ฿30.00 จากคำชวนของ อนุชา พ***',
        });
      } else {
        setValidationResult({
          code: clean,
          isValid: false,
          errorMessage: 'ไม่พบรหัสแนะนำเพื่อนนี้ในระบบ หรือรหัสนี้ถูกใช้งานไปแล้ว',
        });
      }
    }, 450);
  };

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-14 font-sans text-ink">
      {/* 1. TOP HEADER & HERO SECTION (Coinbase Style) */}
      <section className="bg-white border-b border-hairline px-4 sm:px-6 lg:px-8 pt-5 pb-5 shadow-2xs">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Breadcrumb Hierarchy: Citizen > Gamification > Referral */}
          <nav className="flex items-center space-x-1.5 text-xs text-ink-muted">
            <span>หน้าหลัก</span>
            <ChevronRight className="h-3 w-3 text-ink-muted" />
            <span>ภารกิจ & สิทธิพิเศษ (Gamification)</span>
            <ChevronRight className="h-3 w-3 text-ink-muted" />
            <span className="text-brand-blue font-semibold">ระบบชวนเพื่อน (Referral)</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-brand-blue-light border border-blue-200 text-brand-blue text-xs font-semibold">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Growth 2.0</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-emerald-50 border border-emerald-200 text-status-success text-xs font-semibold">
                  <Gift className="h-3.5 w-3.5" />
                  <span>สิทธิ์ส่วนลดเพื่อน ฿30</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-gray-100 border border-gray-200 text-ink-body font-mono text-[11px] font-semibold">
                  <span>Single-Use Code</span>
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                ระบบชวนเพื่อน (Referral Program)
              </h1>
              <p className="text-xs sm:text-sm text-ink-muted mt-0.5 leading-relaxed">
                แชร์รหัสชวนเพื่อนใหม่เข้าร่วมโครงการ THAI Please เพื่อรับสิทธิประโยชน์ส่วนลด Co-pay 60/40 เพิ่มเติม
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SUB-BAR: PREVIEW STATE CONTROLLER (เครื่องมือจำลองสถานะเพื่อตรวจงาน) */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs bg-white border border-hairline p-2 rounded-2xl shadow-2xs">
          <span className="text-ink-muted font-medium flex items-center gap-1.5 pl-1">
            <Info className="h-3.5 w-3.5 text-brand-blue" />
            <span>โหมดจำลองสถานะ UI (Preview):</span>
          </span>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setPreviewState('success')}
              className={`px-3 py-1 rounded-pill font-medium transition ${
                previewState === 'success'
                  ? 'bg-brand-blue text-white shadow-xs font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-soft'
              }`}
            >
              🟢 พร้อมใช้งาน (Success)
            </button>
            <button
              onClick={() => setPreviewState('loading')}
              className={`px-3 py-1 rounded-pill font-medium transition ${
                previewState === 'loading'
                  ? 'bg-ink text-white shadow-xs font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-soft'
              }`}
            >
              ⏳ กำลังโหลด (Loading)
            </button>
            <button
              onClick={() => setPreviewState('empty')}
              className={`px-3 py-1 rounded-pill font-medium transition ${
                previewState === 'empty'
                  ? 'bg-ink text-white shadow-xs font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-soft'
              }`}
            >
              📭 ยังไม่มีเพื่อน (Empty)
            </button>
            <button
              onClick={() => setPreviewState('error')}
              className={`px-3 py-1 rounded-pill font-medium transition ${
                previewState === 'error'
                  ? 'bg-status-error text-white shadow-xs font-semibold'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-soft'
              }`}
            >
              ⚠️ ข้อผิดพลาด (Error)
            </button>
          </div>
        </div>
      </section>

      {/* 3. MAIN DASHBOARD CONTENT */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* ============================================================== */}
        {/* STATE: LOADING SKELETON */}
        {/* ============================================================== */}
        {previewState === 'loading' && (
          <div className="space-y-6 animate-pulse">
            <div className="rounded-card border border-hairline bg-white p-6 space-y-4">
              <div className="h-6 bg-gray-200 rounded-pill w-1/3"></div>
              <div className="h-16 bg-gray-100 rounded-2xl"></div>
              <div className="flex gap-3">
                <div className="h-10 bg-gray-200 rounded-pill w-32"></div>
                <div className="h-10 bg-gray-200 rounded-pill w-32"></div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-card border border-hairline bg-white p-5 space-y-3">
                  <div className="h-4 bg-gray-200 rounded-pill w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded-pill w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STATE: NETWORK / SERVICE ERROR */}
        {/* ============================================================== */}
        {previewState === 'error' && (
          <div className="bg-white border border-hairline rounded-card p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm my-6 space-y-4">
            <div className="h-14 w-14 rounded-full bg-red-50 text-status-error flex items-center justify-center mx-auto border border-red-200">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-ink">
                ไม่สามารถดึงข้อมูลระบบชวนเพื่อนได้
              </h2>
              <p className="text-xs sm:text-sm text-ink-muted mt-1 leading-relaxed">
                การเชื่อมต่อไปยังบริการ Referral ชั่วคราวไม่สามารถทำได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือลองใหม่อีกครั้ง
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setPreviewState('success')}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-pill bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>ลองโหลดใหม่อีกครั้ง</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* STATE: SUCCESS OR EMPTY DASHBOARD */}
        {/* ============================================================== */}
        {(previewState === 'success' || previewState === 'empty') && (
          <>
            {/* 3.1 SECTION: SINGLE-USE ACTIVE REFERRAL CODE CARD */}
            <div className="rounded-card border border-hairline bg-white p-6 sm:p-7 shadow-sm hover:shadow-md transition space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">
                      รหัสคำชวนเพื่อนของคุณ (Your Referral Code)
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-pill bg-blue-50 border border-blue-200 text-brand-blue font-mono text-[10px] font-semibold">
                      1 สิทธิ์ / คน
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-ink">
                    แชร์รหัสเพื่อมอบส่วนลด Co-pay ฿30 ให้เพื่อน
                  </h2>
                  <p className="text-xs text-ink-muted leading-relaxed max-w-xl">
                    เมื่อเพื่อนใหม่นำรหัสนี้ไปใช้สิทธิ์ในโครงการ THAI Please เพื่อนจะได้รับส่วนลดค่าอาหารและบริการทันที ฿30.00 และระบบจะสร้างรหัสใหม่ให้คุณอัตโนมัติ
                  </p>
                </div>

                <div className="h-12 w-12 rounded-2xl bg-brand-blue-light text-brand-blue flex items-center justify-center shrink-0 border border-blue-200 shadow-2xs">
                  <Gift className="h-6 w-6" />
                </div>
              </div>

              {/* Code Box Display (JetBrains Mono & Pill geometry) */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <div className="flex-1 bg-surface-soft border border-hairline rounded-2xl px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-ink-muted font-medium block">รหัสพร้อมแชร์</span>
                    <span className="font-mono font-numeric text-2xl font-extrabold text-ink tracking-wider">
                      {activeReferral ? activeReferral.referralCode : 'กำลังสร้างรหัสใหม่...'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-pill border border-emerald-200 font-semibold block">
                      สถานะ: พร้อมใช้งาน
                    </span>
                    <span className="text-[10px] text-ink-muted mt-0.5 block">
                      ส่วนลด ฿30.00
                    </span>
                  </div>
                </div>

                {/* Action Buttons: Copy & Share */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => activeReferral && handleCopyCode(activeReferral.referralCode)}
                    disabled={!activeReferral}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-pill text-xs font-semibold transition shadow-xs ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-brand-blue text-white hover:bg-brand-blue-hover active:scale-95'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>คัดลอกแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>คัดลอกรหัส</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleShareCode}
                    disabled={!activeReferral}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-pill border border-hairline bg-white text-xs font-semibold text-ink hover:bg-surface-soft transition shadow-xs active:scale-95"
                  >
                    <Share2 className="h-4 w-4 text-brand-blue" />
                    <span>แชร์ให้เพื่อน</span>
                  </button>
                </div>
              </div>

              {/* Toast Feedback สำหรับการแชร์ */}
              {shareFeedback && (
                <div className="bg-blue-50 border border-blue-200 rounded-pill px-4 py-2 text-xs text-brand-blue font-medium flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 className="h-4 w-4 text-brand-blue shrink-0" />
                  <span>{shareFeedback}</span>
                </div>
              )}

              {/* ข้อความชี้แจงกฎกติกาการชวนเพื่อน */}
              <div className="pt-3 border-t border-hairline/60 flex items-start gap-2 text-xs text-ink-muted leading-relaxed">
                <Info className="h-4 w-4 text-brand-blue shrink-0 mt-0.5" />
                <span>
                  <strong>หลักเกณฑ์ Single-Use:</strong> แต่ละรหัสคำชวนสามารถส่งให้เพื่อนใช้งานได้ 1 คนเท่านั้น เมื่อเพื่อนนำไปสแกนใช้สิทธิ์ Co-pay ครั้งแรกสำเร็จ รหัสจะเปลี่ยนสถานะเป็น "สำเร็จ" และระบบจะรีเฟรชรหัสคำชวนใหม่ให้คุณโดยอัตโนมัติ
                </span>
              </div>
            </div>

            {/* 3.2 SECTION: REFERRAL STATISTICS CARDS (3 Verified Metric Cards) */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <Users className="h-4 w-4 text-brand-blue" />
                <span>สถิติการชวนเพื่อน (Referral Performance)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* Metric 1: Total Invited */}
                <div className="rounded-card border border-hairline bg-white p-5 shadow-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted font-medium">เพื่อนที่ชวนทั้งหมด</span>
                    <div className="h-8 w-8 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center border border-blue-200">
                      <Users className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono font-numeric text-2xl font-bold text-ink">
                      {summary.totalInvited}
                    </span>
                    <span className="text-xs text-ink-muted">คน</span>
                  </div>
                  <p className="text-[11px] text-ink-muted">จำนวนคำชวนทั้งหมดที่สร้างขึ้น</p>
                </div>

                {/* Metric 2: Total Redeemed */}
                <div className="rounded-card border border-hairline bg-white p-5 shadow-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted font-medium">ใช้สิทธิ์สำเร็จแล้ว</span>
                    <div className="h-8 w-8 rounded-xl bg-emerald-50 text-status-success flex items-center justify-center border border-emerald-200">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono font-numeric text-2xl font-bold text-status-success">
                      {summary.totalRedeemed}
                    </span>
                    <span className="text-xs text-ink-muted">คน</span>
                  </div>
                  <p className="text-[11px] text-ink-muted">เพื่อนใช้สิทธิ์ Co-pay ครั้งแรกแล้ว</p>
                </div>

                {/* Metric 3: Total Pending */}
                <div className="rounded-card border border-hairline bg-white p-5 shadow-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted font-medium">รอเพื่อนใช้สิทธิ์</span>
                    <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                      <Clock className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono font-numeric text-2xl font-bold text-amber-600">
                      {summary.totalPending}
                    </span>
                    <span className="text-xs text-ink-muted">คำชวน</span>
                  </div>
                  <p className="text-[11px] text-ink-muted">รอเพื่อนนำรหัสไปใช้สิทธิ์หน้าร้าน</p>
                </div>
              </div>
            </div>

            {/* 3.3 SECTION: REFERRAL CODE VALIDATION TOOL (Check Tool Only - Separate from Redemption) */}
            <div className="rounded-card border border-hairline bg-white p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <Tag className="h-4 w-4 text-brand-blue" />
                    <span>ตรวจสอบรหัสคำชวนจากเพื่อน (Check Referral Code)</span>
                  </h3>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    หากคุณได้รับรหัสแนะนำจากเพื่อน คุณสามารถกรอกตรวจสอบความถูกต้องและดูชื่อผู้ชวนได้ที่นี่
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded-pill bg-surface-soft border border-hairline text-ink-body font-mono text-[11px] font-semibold shrink-0">
                  Validation Tool
                </span>
              </div>

              <form onSubmit={handleValidateCode} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="กรอกรหัสแนะนำเพื่อน เช่น TP-FRIEND30"
                    maxLength={20}
                    className="w-full bg-surface-soft border border-hairline rounded-pill pl-10 pr-4 py-2.5 text-xs sm:text-sm font-mono text-ink placeholder:font-sans placeholder:text-ink-muted focus:bg-white focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 transition uppercase"
                  />
                  {inputCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setInputCode('');
                        setValidationResult(null);
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted hover:text-ink bg-white px-2 py-0.5 rounded-pill border border-hairline"
                    >
                      ล้าง
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isValidating || !inputCode.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-pill bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover disabled:opacity-50 transition shadow-xs shrink-0"
                >
                  {isValidating ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>กำลังตรวจสอบ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>ตรวจสอบรหัส</span>
                    </>
                  )}
                </button>
              </form>

              {/* ผลลัพธ์การตรวจสอบรหัส (Dynamic Validation Feedback) */}
              {validationResult && (
                <div
                  className={`p-4 rounded-2xl border text-xs space-y-2 animate-fade-in ${
                    validationResult.isValid
                      ? 'bg-emerald-50 border-emerald-200 text-status-success'
                      : 'bg-red-50 border-red-200 text-status-error'
                  }`}
                >
                  {validationResult.isValid ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
                        <span>รหัสคำชวนถูกต้องและพร้อมใช้งาน!</span>
                      </div>
                      <div className="text-emerald-900 leading-relaxed pl-5.5 space-y-0.5">
                        <p>
                          • ผู้แนะนำ: <strong>{validationResult.referrerName}</strong>
                        </p>
                        <p>
                          • สิทธิประโยชน์: <strong>ส่วนลด Co-pay เพิ่มเติม ฿{validationResult.discountAmount?.toFixed(2)}</strong>
                        </p>
                        <p className="text-emerald-700 text-[11px] pt-1">
                          💡 <em>การใช้สิทธิ์: คุณสามารถนำรหัสนี้ไปใช้เป็นส่วนลดได้ที่หน้า "สแกน QR ร่วมจ่าย Co-pay (60/40)" เมื่อชำระค่าอาหารหน้าร้าน</em>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-red-800">
                      <AlertCircle className="h-4 w-4 text-status-error shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">ตรวจสอบไม่ผ่าน: </span>
                        <span>{validationResult.errorMessage}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3.4 SECTION: REFERRED FRIENDS LIST & FILTER TABS */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div>
                  <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-brand-blue" />
                    <span>ประวัติคำชวนและรายชื่อเพื่อนที่แนะนำ</span>
                  </h3>
                  <p className="text-xs text-ink-muted">
                    แสดงสถานะการใช้สิทธิ์ของเพื่อนตามลำดับเวลาล่าสุด
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-white border border-hairline p-1 rounded-pill self-start sm:self-auto text-xs">
                  <button
                    onClick={() => setFriendFilter('all')}
                    className={`px-3 py-1 rounded-pill transition ${
                      friendFilter === 'all'
                        ? 'bg-ink text-white font-semibold shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    ทั้งหมด ({friendsList.length})
                  </button>
                  <button
                    onClick={() => setFriendFilter('redeemed')}
                    className={`px-3 py-1 rounded-pill transition ${
                      friendFilter === 'redeemed'
                        ? 'bg-status-success text-white font-semibold shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    สำเร็จ ({summary.totalRedeemed})
                  </button>
                  <button
                    onClick={() => setFriendFilter('pending')}
                    className={`px-3 py-1 rounded-pill transition ${
                      friendFilter === 'pending'
                        ? 'bg-amber-500 text-white font-semibold shadow-xs'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    รอใช้สิทธิ์ ({summary.totalPending})
                  </button>
                </div>
              </div>

              {/* รายการเพื่อน */}
              {filteredFriends.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredFriends.map((friend) => (
                    <article
                      key={friend.referralId}
                      className="bg-white border border-hairline rounded-card p-4 sm:p-4.5 shadow-2xs hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                            friend.status === 'redeemed'
                              ? 'bg-emerald-50 text-status-success border-emerald-200'
                              : 'bg-amber-50 text-amber-600 border-amber-200'
                          }`}
                        >
                          {friend.status === 'redeemed' ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Clock className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-bold text-ink truncate">
                              {friend.friendName}
                            </h4>
                            <span className="font-mono font-numeric text-[11px] text-ink-muted bg-surface-soft px-2 py-0.5 rounded-pill border border-hairline">
                              {friend.referralCode}
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-muted truncate">
                            {friend.status === 'redeemed' && friend.merchantName
                              ? `ใช้สิทธิ์ที่ร้าน: ${friend.merchantName}`
                              : `สร้างคำชวนเมื่อ: ${new Date(friend.invitedAt).toLocaleDateString('th-TH', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-hairline/60">
                        <div className="text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-pill text-[11px] font-semibold border ${
                              friend.status === 'redeemed'
                                ? 'bg-emerald-50 text-status-success border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {friend.status === 'redeemed' ? 'ใช้สิทธิ์สำเร็จ' : 'รอเพื่อนใช้สิทธิ์'}
                          </span>
                          <span className="block text-[10px] text-ink-muted mt-0.5 font-mono">
                            ส่วนลด ฿{friend.discountAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                /* EMPTY STATE: เมื่อไม่มีเพื่อนในรายการ */
                <div className="bg-white border border-hairline rounded-card p-8 sm:p-10 text-center shadow-xs space-y-3">
                  <div className="h-12 w-12 rounded-full bg-blue-50 text-brand-blue flex items-center justify-center mx-auto border border-blue-200">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-ink">
                      ยังไม่มีรายการเพื่อนในตัวกรองนี้
                    </h4>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed max-w-sm mx-auto">
                      แชร์รหัสคำชวนของคุณให้เพื่อนเพื่อเริ่มต้นมอบส่วนลด Co-pay ฿30 และติดตามความคืบหน้าที่นี่
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleShareCode}
                      disabled={!activeReferral}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition shadow-sm"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      <span>แชร์รหัสให้เพื่อนคนแรก</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default CitizenReferralPage;
