import prisma from '../utils/prisma';
import {
  CANONICAL_CATEGORY_IDS,
  CanonicalCategoryId,
  isValidCategoryId,
  getCategoryDisplayName,
} from '../constants/categories';
import { MerchantApplicationInput } from '../validations/merchant-application.validation';

export class MerchantCategoryError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'MerchantCategoryError';
    this.statusCode = statusCode;
  }
}

/**
 * Service สำหรับจัดการ Category ID และการเชื่อมโยงข้อมูลระหว่าง MerchantApplication และ Merchants
 * (Developer 3 & Developer 1 Integration)
 */
export class MerchantCategoryService {
  /**
   * ตรวจสอบความถูกต้องของ Category ID
   * อนุญาตให้เป็น null / undefined สำหรับกรณีร้านค้ายังไม่ระบุหมวดหมู่
   */
  public validateCategoryId(categoryId?: string | null): CanonicalCategoryId | null {
    if (!categoryId || categoryId.trim() === '') {
      return null;
    }

    const trimmed = categoryId.trim();
    if (!isValidCategoryId(trimmed)) {
      throw new MerchantCategoryError(
        `รหัสหมวดหมู่ร้านค้าไม่ถูกต้อง: "${categoryId}" ต้องเป็นหนึ่งใน: ${CANONICAL_CATEGORY_IDS.join(', ')}`,
        400
      );
    }

    return trimmed;
  }

  /**
   * โอนถ่ายข้อมูล category_id จากใบสมัคร (MerchantApplication) ไปยังร้านค้าที่ได้รับการอนุมัติ (merchants)
   * รองรับการทำงานภายใน Prisma Transaction
   */
  public async transferCategoryOnApproval(
    applicationId: string,
    txClient: any = prisma
  ): Promise<{ merchantId: string; categoryId: string | null }> {
    const application = await txClient.merchantApplication.findUnique({
      where: { application_id: applicationId },
      select: {
        application_id: true,
        merchant_id: true,
        category_id: true,
        status: true,
        shop_name: true,
        tax_id: true,
        latitude: true,
        longitude: true,
      },
    });

    if (!application) {
      throw new MerchantCategoryError('ไม่พบข้อมูลใบสมัครร้านค้า', 404);
    }

    const validatedCategory = this.validateCategoryId(application.category_id);

    // หากมี merchant_id ผูกอยู่แล้ว ให้อัปเดต category_id เข้าไปที่ร้านค้านั้น
    if (application.merchant_id) {
      const updated = await txClient.merchants.update({
        where: { merchant_id: application.merchant_id },
        data: {
          category_id: validatedCategory,
        },
        select: {
          merchant_id: true,
          category_id: true,
        },
      });

      return {
        merchantId: updated.merchant_id,
        categoryId: updated.category_id,
      };
    }

    // หากยังไม่มี merchant_id (กำลังสร้างร้านค้าใหม่จากการอนุมัติ)
    const newMerchant = await txClient.merchants.create({
      data: {
        tax_id: application.tax_id,
        shop_name: application.shop_name,
        category_id: validatedCategory,
        latitude: application.latitude,
        longitude: application.longitude,
        is_approved: true,
      },
      select: {
        merchant_id: true,
        category_id: true,
      },
    });

    // อัปเดต merchant_id กลับไปที่ใบสมัคร
    await txClient.merchantApplication.update({
      where: { application_id: applicationId },
      data: {
        merchant_id: newMerchant.merchant_id,
        status: 'APPROVED',
      },
    });

    return {
      merchantId: newMerchant.merchant_id,
      categoryId: newMerchant.category_id,
    };
  }

  /**
   * สร้างใบสมัครร้านค้าใหม่พร้อมหมวดหมู่ (Merchant Registration)
   * รองรับการส่ง category_id หรือปล่อยว่าง (null)
   */
  public async createMerchantApplication(
    input: MerchantApplicationInput,
    passwordHash: string,
    txClient: any = prisma
  ): Promise<{ applicationId: string; categoryId: string | null; status: string }> {
    const validatedCategory = this.validateCategoryId(input.categoryId);

    const application = await txClient.merchantApplication.create({
      data: {
        business_type: input.businessType,
        tax_id: input.taxId,
        shop_name: input.shopName,
        contact_name: input.contactName,
        category_id: validatedCategory,
        email: input.email,
        phone: input.phone,
        password_hash: passwordHash,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        status: 'SUBMITTING',
      },
      select: {
        application_id: true,
        category_id: true,
        status: true,
      },
    });

    return {
      applicationId: application.application_id,
      categoryId: application.category_id,
      status: application.status,
    };
  }

  /**
   * ดึงข้อมูลร้านค้าพร้อมชื่อภาษาไทยของหมวดหมู่ (Safe null fallback)
   */
  public async getMerchantWithCategory(
    merchantId: string,
    txClient: any = prisma
  ): Promise<{
    merchantId: string;
    shopName: string;
    categoryId: string | null;
    categoryNameTh: string;
    isApproved: boolean;
  }> {
    const merchant = await txClient.merchants.findUnique({
      where: { merchant_id: merchantId },
      select: {
        merchant_id: true,
        shop_name: true,
        category_id: true,
        is_approved: true,
      },
    });

    if (!merchant) {
      throw new MerchantCategoryError('ไม่พบข้อมูลร้านค้า', 404);
    }

    return {
      merchantId: merchant.merchant_id,
      shopName: merchant.shop_name,
      categoryId: merchant.category_id,
      categoryNameTh: getCategoryDisplayName(merchant.category_id),
      isApproved: merchant.is_approved,
    };
  }

  /**
   * อัปเดตหมวดหมู่ร้านค้าโดยตรง พร้อมบันทึก Audit Log (Merchant Profile Editing)
   */
  public async updateMerchantCategory(
    merchantId: string,
    newCategoryId: string | null,
    actor?: { id: string; role: 'MERCHANT' | 'ADMIN' | 'STAFF' },
    txClient: any = prisma
  ): Promise<{ merchantId: string; previousCategory: string | null; newCategory: string | null }> {
    const existing = await txClient.merchants.findUnique({
      where: { merchant_id: merchantId },
      select: { merchant_id: true, category_id: true },
    });

    if (!existing) {
      throw new MerchantCategoryError('ไม่พบข้อมูลร้านค้า', 404);
    }

    const validatedCategory = this.validateCategoryId(newCategoryId);

    const updated = await txClient.merchants.update({
      where: { merchant_id: merchantId },
      data: { category_id: validatedCategory },
      select: { merchant_id: true, category_id: true },
    });

    // บันทึก Audit Log หากมี actor ข้อมูลระบุตัวตน
    if (actor && actor.id) {
      await txClient.merchant_profile_audit_logs.create({
        data: {
          merchant_id: merchantId,
          actor_id: actor.id,
          actor_role: actor.role,
          changes: {
            field: 'category_id',
            from: existing.category_id,
            to: validatedCategory,
          },
        },
      });
    }

    return {
      merchantId: updated.merchant_id,
      previousCategory: existing.category_id,
      newCategory: updated.category_id,
    };
  }
}

export const merchantCategoryService = new MerchantCategoryService();
