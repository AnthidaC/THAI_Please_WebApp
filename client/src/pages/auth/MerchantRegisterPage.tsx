import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { ArrowLeft, CheckCircle2, FileText, MapPin, Store, Upload, UserRound } from 'lucide-react';
import { APP_ROUTES } from '../../constants/routes';
import { ThaiAddressSelect, ThaiAddressValue } from '../../components/common/ThaiAddressSelect';
import { submitMerchantApplication } from '../../services/merchantApplicationApi';

type BusinessType = 'INDIVIDUAL' | 'JURISTIC';
type DocumentKey = 'storePhoto' | 'bankProof' | 'businessRegistration' | 'companyCertificate' | 'authorization';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

export const MerchantRegisterPage: React.FC = () => {
  const [businessType, setBusinessType] = useState<BusinessType>('INDIVIDUAL');
  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [documents, setDocuments] = useState<Partial<Record<DocumentKey, File>>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [addressSelection, setAddressSelection] = useState<ThaiAddressValue | null>(null);

  const applyAddressSelection = (selected: ThaiAddressValue) => {
    setAddressSelection(selected);
    if (!selected.subdistrictCode) return;
    setAddress(`${selected.subdistrictName} ${selected.districtName} ${selected.provinceName}${selected.postalCode ? ` ${selected.postalCode}` : ''}`);
  };

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const missingCommonDocuments = !documents.storePhoto || !documents.bankProof;
    const missingCompanyCertificate = businessType === 'JURISTIC' && !documents.companyCertificate;

    if (missingCommonDocuments || missingCompanyCertificate || !taxId.match(/^\d{13}$/) || !addressSelection?.subdistrictCode) {
      setErrorMessage(!addressSelection?.subdistrictCode
        ? 'กรุณาเลือกจังหวัด อำเภอ/เขต และตำบล/แขวงให้ครบ'
        : !taxId.match(/^\d{13}$/)
          ? 'กรุณากรอกเลขประจำตัวผู้เสียภาษี 13 หลัก'
          : 'กรุณาแนบรูปหน้าร้านและหลักฐานบัญชีธนาคาร' +
          (missingCompanyCertificate ? ' รวมถึงหนังสือรับรองนิติบุคคล' : ''));
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('businessType', businessType);
    formData.append('taxId', taxId);
    formData.append('businessName', businessName);
    formData.append('contactName', contactName);
    formData.append('email', email);
    formData.append('phone', phone);
    formData.append('password', password);
    formData.append('address', address);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    Object.entries(documents).forEach(([key, file]) => {
      if (file) formData.append(key, file);
    });

    try {
      const result = await submitMerchantApplication(formData);
      setApplicationId(result.applicationId);
      setPassword('');
      setDocuments({});
      setIsSubmitted(true);
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      setErrorMessage(message || 'ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
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
        <h2 className="text-xl font-bold text-ink">ส่งคำขอสมัครร้านค้าเรียบร้อย</h2>
        {applicationId && <p className="text-xs text-ink-muted">เลขที่คำขอ: {applicationId}</p>}
        <p className="text-sm leading-relaxed text-ink-muted">
          คำขออยู่ระหว่างตรวจสอบ เจ้าหน้าที่จะตรวจข้อมูลและเอกสารก่อนอนุมัติ
          คุณจะเข้าสู่ Merchant Web App ได้เมื่อได้รับอนุมัติแล้ว
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
            <label htmlFor="merchant-tax-id" className="mb-1 block text-xs font-semibold text-ink">เลขประจำตัวผู้เสียภาษี 13 หลัก</label>
            <input id="merchant-tax-id" inputMode="numeric" pattern="[0-9]{13}" maxLength={13} required value={taxId} onChange={(event) => setTaxId(event.target.value.replace(/\D/g, '').slice(0, 13))} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <p className="mt-1 text-[11px] text-ink-muted">ใช้ตรวจสอบกิจการและป้องกันการสมัครซ้ำ</p>
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
            <input id="merchant-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
            <p className="mt-1 text-[11px] text-ink-muted">อย่างน้อย 12 ตัวอักษร บันทึกเป็นรหัสผ่านแบบเข้ารหัส</p>
          </div>
        </section>

        <section className="space-y-3 border-t border-hairline pt-4">
          <h3 className="text-sm font-bold text-ink">ที่ตั้งร้านค้า</h3>
          <div>
            <ThaiAddressSelect onChange={applyAddressSelection} />
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
            <p className="mt-2 text-[11px] text-ink-muted">ระบุพิกัดจาก Google Maps (คลิกขวาที่ตำแหน่งร้านเพื่อคัดลอกพิกัด)</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="merchant-latitude" className="mb-1 block text-xs font-semibold text-ink">Latitude</label>
                <input id="merchant-latitude" type="number" step="any" min="-90" max="90" required value={latitude} onChange={(event) => setLatitude(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label htmlFor="merchant-longitude" className="mb-1 block text-xs font-semibold text-ink">Longitude</label>
                <input id="merchant-longitude" type="number" step="any" min="-180" max="180" required value={longitude} onChange={(event) => setLongitude(event.target.value)} className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-xs focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
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

        <button type="submit" disabled={isSubmitting} className="w-full rounded-pill bg-brand-blue py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-blue-hover disabled:opacity-60">
          {isSubmitting ? 'กำลังส่งข้อมูลและเอกสาร...' : 'ส่งคำขอสมัครร้านค้า'}
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
