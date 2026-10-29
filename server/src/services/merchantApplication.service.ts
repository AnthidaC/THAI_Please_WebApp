import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { comparePassword, hashPassword } from '../utils/bcrypt';
import { signToken } from '../utils/jwt';
import { HttpError } from '../utils/http-error';
import { MerchantApplicationInput } from '../validations/merchant-application.validation';
import { privateStorageService } from './privateStorage.service';

const DOCUMENT_LABELS: Record<string, string> = {
  storePhoto: 'รูปหน้าร้าน',
  bankProof: 'หลักฐานบัญชีธนาคาร',
  businessRegistration: 'ทะเบียนพาณิชย์/หลักฐานกิจการ',
  companyCertificate: 'หนังสือรับรองนิติบุคคล',
  authorization: 'เอกสารผู้มีอำนาจ/หนังสือมอบอำนาจ',
};

const FILE_TYPES: Record<string, { mime: string; extension: string }> = {
  'image/jpeg': { mime: 'image/jpeg', extension: 'jpg' },
  'image/png': { mime: 'image/png', extension: 'png' },
  'application/pdf': { mime: 'application/pdf', extension: 'pdf' },
};

type UploadedDocuments = Record<string, Express.Multer.File[] | undefined>;

const hasValidSignature = (file: Express.Multer.File): boolean => {
  if (file.mimetype === 'application/pdf') return file.buffer.subarray(0, 5).toString() === '%PDF-';
  if (file.mimetype === 'image/png') {
    return file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  return file.mimetype === 'image/jpeg'
    && file.buffer[0] === 0xff
    && file.buffer[1] === 0xd8
    && file.buffer[2] === 0xff;
};

const getRequiredFiles = (
  businessType: MerchantApplicationInput['businessType'],
  files: UploadedDocuments
): Array<{ type: string; file: Express.Multer.File }> => {
  const required = businessType === 'JURISTIC'
    ? ['storePhoto', 'bankProof', 'companyCertificate']
    : ['storePhoto', 'bankProof'];
  for (const field of required) {
    if (!files[field]?.[0]) {
      throw new HttpError(400, 'กรุณาแนบรูปหน้าร้าน หลักฐานบัญชี และเอกสารตามประเภทธุรกิจให้ครบ');
    }
  }

  const documents: Array<{ type: string; file: Express.Multer.File }> = [];
  for (const [type, entries] of Object.entries(files)) {
    const file = entries?.[0];
    if (!file) continue;
    if (!FILE_TYPES[file.mimetype] || !hasValidSignature(file)) {
      throw new HttpError(400, `ไฟล์${DOCUMENT_LABELS[type] ?? 'เอกสาร'}ไม่ตรงกับชนิดไฟล์ที่แจ้ง`);
    }
    documents.push({ type, file });
  }
  return documents;
};

const mapApplication = (application: {
  application_id: string;
  merchant_id: string | null;
  business_type: string;
  tax_id: string;
  shop_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  status: string;
  rejection_reason: string | null;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
  documents?: Array<{ document_id: string; document_type: string; mime_type: string; file_size: number; storage_path: string; created_at: Date }>;
  audit_logs?: Array<{ action: string; note: string | null; created_at: Date; staff: { full_name: string; email: string } }>;
}) => ({
  id: application.application_id,
  merchantId: application.merchant_id,
  businessType: application.business_type,
  taxId: application.tax_id,
  businessName: application.shop_name,
  contactName: application.contact_name,
  email: application.email,
  phone: application.phone,
  address: application.address,
  latitude: Number(application.latitude),
  longitude: Number(application.longitude),
  status: application.status,
  rejectionReason: application.rejection_reason,
  createdAt: application.created_at,
  updatedAt: application.updated_at,
  reviewedAt: application.reviewed_at,
  ...(application.documents && {
    documents: application.documents.map((document) => ({
      id: document.document_id,
      type: document.document_type,
      label: DOCUMENT_LABELS[document.document_type] ?? 'เอกสาร',
      mimeType: document.mime_type,
      fileSize: document.file_size,
      createdAt: document.created_at,
    })),
  }),
  ...(application.audit_logs && {
    history: application.audit_logs.map((log) => ({
      action: log.action,
      note: log.note,
      createdAt: log.created_at,
      reviewedBy: log.staff.full_name,
    })),
  }),
});

export const merchantApplicationService = {
  async submit(input: MerchantApplicationInput, files: UploadedDocuments) {
    const documents = getRequiredFiles(input.businessType, files);
    const activeApplication = await prisma.merchantApplication.findFirst({
      where: {
        email: input.email,
        status: { in: ['SUBMITTING', 'PENDING', 'APPROVED'] },
      },
      select: { application_id: true },
    });
    if (activeApplication) {
      throw new HttpError(409, 'อีเมลนี้มีคำขอที่กำลังตรวจสอบหรือได้รับอนุมัติแล้ว');
    }

    const existingMerchant = await prisma.merchants.findUnique({
      where: { tax_id: input.taxId },
      select: { merchant_id: true },
    });
    if (existingMerchant) {
      throw new HttpError(409, 'เลขประจำตัวผู้เสียภาษีนี้มีบัญชีร้านค้าแล้ว');
    }

    let application: { application_id: string };
    try {
      application = await prisma.merchantApplication.create({
        data: {
          business_type: input.businessType,
          tax_id: input.taxId,
          shop_name: input.businessName,
          category_id: input.categoryId ?? null,
          contact_name: input.contactName,
          email: input.email,
          phone: input.phone,
          password_hash: await hashPassword(input.password),
          address: input.address,
          latitude: input.latitude,
          longitude: input.longitude,
        },
        select: { application_id: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'อีเมลนี้มีคำขอร้านค้าที่กำลังดำเนินการอยู่แล้ว');
      }
      throw error;
    }

    const uploadedPaths: string[] = [];
    try {
      const storedDocuments = [];
      for (const { type, file } of documents) {
        const extension = FILE_TYPES[file.mimetype].extension;
        const storagePath = `${application.application_id}/${randomUUID()}.${extension}`;
        await privateStorageService.upload(storagePath, file);
        uploadedPaths.push(storagePath);
        storedDocuments.push({
          application_id: application.application_id,
          document_type: type,
          storage_path: storagePath,
          mime_type: file.mimetype,
          file_size: file.size,
        });
      }

      await prisma.$transaction([
        prisma.merchant_application_documents.createMany({ data: storedDocuments }),
        prisma.merchantApplication.update({
          where: { application_id: application.application_id },
          data: { status: 'PENDING', updated_at: new Date() },
        }),
      ]);
    } catch (error) {
      await Promise.all(uploadedPaths.map((path) => privateStorageService.remove(path)));
      await prisma.merchantApplication.deleteMany({
        where: { application_id: application.application_id, status: 'SUBMITTING' },
      });
      throw error;
    }

    return { applicationId: application.application_id, status: 'PENDING' };
  },

  async login(email: string, password: string) {
    const application = await prisma.merchantApplication.findFirst({
      where: { email, status: 'APPROVED', merchant_id: { not: null } },
      include: { merchant: true },
    });
    if (!application || !application.merchant?.is_approved
      || !(await comparePassword(password, application.password_hash))) {
      throw new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่ได้รับอนุมัติ');
    }

    const merchant = application.merchant;
    return {
      user: {
        id: merchant.merchant_id,
        email: application.email,
        name: merchant.shop_name,
        role: 'MERCHANT',
        createdAt: merchant.created_at.toISOString(),
        merchantApprovalStatus: 'APPROVED',
        merchantApplicationSubmittedAt: application.created_at.toISOString(),
        merchantRejectionReason: application.rejection_reason,
      },
      token: signToken({ userId: merchant.merchant_id, role: 'MERCHANT' }),
    };
  },

  async list(status = 'PENDING') {
    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      throw new HttpError(400, 'สถานะคำขอไม่ถูกต้อง');
    }
    const applications = await prisma.merchantApplication.findMany({
      where: { status },
      orderBy: { created_at: 'asc' },
      select: {
        application_id: true,
        merchant_id: true,
        business_type: true,
        tax_id: true,
        shop_name: true,
        contact_name: true,
        email: true,
        phone: true,
        address: true,
        latitude: true,
        longitude: true,
        status: true,
        rejection_reason: true,
        created_at: true,
        updated_at: true,
        reviewed_at: true,
        documents: {
          select: {
            document_id: true,
            document_type: true,
            mime_type: true,
            file_size: true,
            storage_path: true,
            created_at: true,
          },
        },
      },
    });
    return applications.map((application) => mapApplication(application));
  },

  async getDetails(applicationId: string) {
    const application = await prisma.merchantApplication.findUnique({
      where: { application_id: applicationId },
      select: {
        application_id: true,
        merchant_id: true,
        business_type: true,
        tax_id: true,
        shop_name: true,
        contact_name: true,
        email: true,
        phone: true,
        address: true,
        latitude: true,
        longitude: true,
        status: true,
        rejection_reason: true,
        created_at: true,
        updated_at: true,
        reviewed_at: true,
        documents: {
          select: {
            document_id: true,
            document_type: true,
            mime_type: true,
            file_size: true,
            storage_path: true,
            created_at: true,
          },
        },
        audit_logs: {
          orderBy: { created_at: 'desc' },
          select: {
            action: true,
            note: true,
            created_at: true,
            staff: { select: { full_name: true, email: true } },
          },
        },
      },
    });
    if (!application) throw new HttpError(404, 'ไม่พบคำขอร้านค้า');

    const documents = await Promise.all(application.documents.map(async (document) => ({
      id: document.document_id,
      type: document.document_type,
      label: DOCUMENT_LABELS[document.document_type] ?? 'เอกสาร',
      mimeType: document.mime_type,
      fileSize: document.file_size,
      createdAt: document.created_at,
      signedUrl: await privateStorageService.createSignedUrl(document.storage_path),
    })));
    const { documents: _storedDocuments, ...details } = mapApplication(application);
    return { ...details, documents };
  },

  async decide(applicationId: string, staffId: string, action: 'APPROVE' | 'REJECT', note?: string) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const application = await transaction.merchantApplication.findFirst({
          where: { application_id: applicationId, status: 'PENDING' },
        });
        if (!application) {
          throw new HttpError(409, 'คำขอนี้ถูกดำเนินการแล้วหรือไม่อยู่ในสถานะรอตรวจสอบ');
        }

        let merchantId: string | undefined;
        if (action === 'APPROVE') {
          const merchant = await transaction.merchants.create({
            data: {
              tax_id: application.tax_id,
              shop_name: application.shop_name,
              category_id: application.category_id,
              latitude: application.latitude,
              longitude: application.longitude,
              is_approved: true,
              approved_by_admin_id: staffId,
            },
            select: { merchant_id: true },
          });
          merchantId = merchant.merchant_id;
        }

        const updated = await transaction.merchantApplication.updateMany({
          where: { application_id: applicationId, status: 'PENDING' },
          data: {
            status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            rejection_reason: action === 'REJECT' ? note : null,
            merchant_id: merchantId,
            reviewed_by_staff_id: staffId,
            reviewed_at: new Date(),
            updated_at: new Date(),
          },
        });
        if (updated.count !== 1) throw new HttpError(409, 'คำขอนี้ถูกดำเนินการแล้ว');

        await transaction.merchant_application_audit_logs.create({
          data: {
            application_id: applicationId,
            staff_id: staffId,
            action,
            note: note ?? null,
          },
        });
        return { applicationId, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED', merchantId };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'ร้านค้านี้มีบัญชีอยู่แล้ว กรุณาตรวจสอบเลขประจำตัวผู้เสียภาษี');
      }
      throw error;
    }
  },
};
