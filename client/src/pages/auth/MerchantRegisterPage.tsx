import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileText, MapPin, Store, Upload, UserRound } from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';

type BusinessType = 'INDIVIDUAL' | 'JURISTIC';
type DocumentKey = 'storePhoto' | 'bankProof' | 'businessRegistration' | 'companyCertificate' | 'authorization';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

export const MerchantRegisterPage: React.FC = () => {
  const [businessType, setBusinessType] = useState<BusinessType>('INDIVIDUAL');
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [documents, setDocuments] = useState<Partial<Record<DocumentKey, File>>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const selectDocument = (key: DocumentKey, file?: File) => {
    setErrorMessage(null);
    if (!file) {
      setDocuments((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setDocuments((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setErrorMessage('รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setDocuments((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setErrorMessage('ไฟล์ต้องมีขนาดไม่เกิน 10 MB');
      return;
    }
    setDocuments((current) => ({ ...current, [key]: file }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const missingCommonDocuments = !documents.storePhoto || !documents.bankProof;
    const missingCompanyCertificate = businessType === 'JURISTIC' && !documents.companyCertificate;

    if (missingCommonDocuments || missingCompanyCertificate) {
      setErrorMessage('กรุณาแนบรูปหน้าร้านและหลักฐานบัญชีธนาคาร' +
        (missingCompanyCertificate ? ' รวมถึงหนังสือรับรองนิติบุคคล' : ''));
      return;
    }

    setErrorMessage(null);
    setIsSubmitted(true);
  };

  const mapsSearchUrl = address.trim()
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
    : null;

  const documentField = (key: DocumentKey, label: string, required = false, hint?: string) => (
    <label className="block rounded-xl border border-hairline bg-white p-3">
      <span className="flex items-start gap-2 text-xs font-semibold text-ink">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
        <span>
          {label}{required ? ' *' : ' (ถ้ามี)'}
          {hint && <span className="mt-1 block font-normal text-ink-muted">{hint}</span>}
        </span>
      </span>
      <span className="mt-2 flex items-center gap-2 text-[11px] text-brand-blue">
        <Upload className="h-3.5 w-3.5" />
        {documents[key]?.name ?? 'เลือกไฟล์ PDF, JPG หรือ PNG (ไม่เกิน 10 MB)'}
      </span>
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={(event) => selectDocument(key, event.target.files?.[0])}
      />
    </label>
  );

  if (isSubmitted) {
    return (
      <div className="space-y-4 text-center font-sans">
        <CheckCircle2 className="mx-auto h-12 w-12 text-status-success" />
        <h2 className="text-xl font-bold text-ink">ตรวจสอบแบบฟอร์มทดลองเรียบร้อย</h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          นี่เป็นเพียงหน้าทดลอง ข้อมูลและไฟล์ยังไม่ได้ส่งหรือจัดเก็บไว้ที่ระบบ
          เมื่อเชื่อมต่อระบบจริง คำขอจะต้องผ่านการตรวจสอบก่อนเปิดใช้งานร้านค้า
        </p>
        <Link to={APP_ROUTES.MERCHANT_LOGIN} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-blue hover:underline">
          <ArrowLeft className="h-4 w-4" />
          กลับไปหน้าเข้าสู่ระบบร้านค้า
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans">
      <div className="text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
          <Store className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-ink">สมัครเข้าร่วมสำหรับร้านค้า</h2>
        <p className="mt-1 text-xs text-ink-muted">กรอกข้อมูลกิจการและแนบหลักฐานเพื่อประกอบการตรวจสอบ</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        แบบฟอร์มนี้เป็นต้นแบบเพื่อทดสอบหน้าจอเท่านั้น ไฟล์จะไม่ถูกอัปโหลดหรือบันทึก
        เอกสารที่ต้องใช้จริงและระยะเวลาการเก็บรักษาต้องกำหนดโดยผู้ดูแลระบบก่อนเปิดใช้งาน
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-status-error">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-ink">ข้อมูลกิจการและผู้ติดต่อ</h3>
          <div>
            <label htmlFor="merchant-business-type" className="mb-1 block text-xs font-semibold text-ink">ประเภทร้านค้า</label>
            <select
              id="merchant-business-type"
              value={businessType}
              onChange={(event) => setBusinessType(event.target.value === 'JURISTIC' ? 'JURISTIC' : 'INDIVIDUAL')}
              className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs text-ink focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="INDIVIDUAL">บุคคลธรรมดา / ร้านค้าทั่วไป</option>
              <option value="JURISTIC">นิติบุคคล</option>
            </select>
          </div>

          <div>
            <label htmlFor="merchant-business-name" className="mb-1 block text-xs font-semibold text-ink">ชื่อร้านหรือชื่อกิจการ</label>
            <input id="merchant-business-name" required value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>

          <div>
            <label htmlFor="merchant-contact-name" className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink">
              <UserRound className="h-3.5 w-3.5" /> ชื่อผู้ติดต่อ
            </label>
            <input id="merchant-contact-name" required value={contactName} onChange={(event) => setContactName(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="merchant-email" className="mb-1 block text-xs font-semibold text-ink">อีเมล</label>
              <input id="merchant-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
            <div>
              <label htmlFor="merchant-phone" className="mb-1 block text-xs font-semibold text-ink">เบอร์โทรศัพท์</label>
              <input id="merchant-phone" type="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>

          <div>
            <label htmlFor="merchant-password" className="mb-1 block text-xs font-semibold text-ink">ตั้งรหัสผ่าน</label>
            <input id="merchant-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <p className="mt-1 text-[11px] text-ink-muted">อย่างน้อย 8 ตัวอักษร (ต้นแบบนี้ยังไม่ส่งรหัสผ่านไปบันทึก)</p>
          </div>
        </section>

        <section className="space-y-3 border-t border-hairline pt-4">
          <h3 className="text-sm font-bold text-ink">ที่ตั้งร้านค้า</h3>
          <div>
            <label htmlFor="merchant-address" className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink">
              <MapPin className="h-3.5 w-3.5" /> ที่อยู่ร้าน
            </label>
            <textarea
              id="merchant-address"
              required
              rows={3}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด และรหัสไปรษณีย์"
              className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {mapsSearchUrl && (
              <a href={mapsSearchUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">
                <MapPin className="h-3.5 w-3.5" />
                ตรวจสอบตำแหน่งบน Google Maps
              </a>
            )}
          </div>
        </section>

        <section className="space-y-3 border-t border-hairline pt-4">
          <div>
            <h3 className="text-sm font-bold text-ink">เอกสารประกอบการตรวจสอบ</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
              เอกสารตัวอย่างที่แนะนำ อาจต้องปรับตามหลักเกณฑ์ของโครงการและประเภทร้านค้า
            </p>
          </div>
          {documentField('storePhoto', 'รูปหน้าร้านหรือจุดขายที่เห็นชื่อร้าน', true, 'ควรเป็นภาพปัจจุบันที่ช่วยยืนยันว่ามีสถานที่ประกอบการจริง')}
          {documentField('bankProof', 'หลักฐานบัญชีธนาคารหรือ PromptPay ในนามผู้สมัคร/กิจการ', true)}
          {businessType === 'INDIVIDUAL'
            ? documentField('businessRegistration', 'ทะเบียนพาณิชย์หรือหลักฐานการประกอบกิจการ')
            : (
              <>
                {documentField('companyCertificate', 'หนังสือรับรองนิติบุคคลฉบับล่าสุด', true)}
                {documentField('authorization', 'เอกสารผู้มีอำนาจลงนามหรือหนังสือมอบอำนาจ')}
              </>
            )}
        </section>

        <button type="submit" className="w-full rounded-pill bg-brand-blue py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-blue-hover">
          ส่งคำขอสมัครร้านค้า (ทดลอง)
        </button>
      </form>

      <div className="border-t border-hairline pt-3 text-center text-xs text-ink-muted">
        มีบัญชีร้านค้าแล้ว?{' '}
        <Link to={APP_ROUTES.MERCHANT_LOGIN} className="font-semibold text-brand-blue hover:underline">
          เข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
};
