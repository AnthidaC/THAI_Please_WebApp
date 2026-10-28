import prisma from '../utils/prisma';
import { UpdatePreferencesInput } from '../validations/preference.validation';

export class PreferenceError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PreferenceError';
    this.statusCode = statusCode;
  }
}

export interface UserPreferenceItem {
  preferenceId: string;
  categoryId: string;
  preferenceWeight: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferencesResult {
  userId: string;
  totalCategories: number;
  preferences: UserPreferenceItem[];
}

/**
 * Service จัดการหมวดหมู่ความสนใจของผู้ใช้ (Developer 3: User Category Preferences)
 * - จัดเก็บเฉพาะ Explicit Preferences ที่ผู้ใช้ระบุโดยตรง
 * - แยกขาดจาก Behavioral Scores หรือ AI Recommendation Weights
 * - รองรับ Category IDs แบบ Configurable ไม่ผูกมัดหรือ Hardcode Taxonomy ที่ยังไม่ได้รับอนุมัติ
 */
export class PreferenceService {
  /**
   * ดึงรายการหมวดหมู่ความสนใจของผู้ใช้งานปัจจุบัน (GET /preferences)
   * @param userId รหัสประชาชนที่ผ่านการยืนยันตัวตนแล้ว (Authenticated User ID)
   */
  public async getUserPreferences(userId: string): Promise<UserPreferencesResult> {
    if (!userId) {
      throw new PreferenceError('ไม่พบรหัสผู้ใช้งานที่ยืนยันตัวตน', 401);
    }

    const preferences = await prisma.user_category_preferences.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'asc' },
    });

    return {
      userId,
      totalCategories: preferences.length,
      preferences: preferences.map((p) => ({
        preferenceId: p.preference_id,
        categoryId: p.category_id,
        preferenceWeight: Number(p.preference_weight),
        createdAt: p.created_at.toISOString(),
        updatedAt: p.updated_at.toISOString(),
      })),
    };
  }

  /**
   * บันทึกหรือปรับปรุงรายการหมวดหมู่ความสนใจของผู้ใช้งาน (PUT /preferences)
   * ทำงานแบบ Atomic Replacement ภายใต้ Prisma Transaction
   * @param userId รหัสประชาชนที่ผ่านการยืนยันตัวตนแล้ว
   * @param input รายการหมวดหมู่และค่าน้ำหนักที่ส่งมาจาก Client
   */
  public async updateUserPreferences(
    userId: string,
    input: UpdatePreferencesInput
  ): Promise<UserPreferencesResult> {
    if (!userId) {
      throw new PreferenceError('ไม่พบรหัสผู้ใช้งานที่ยืนยันตัวตน', 401);
    }

    const { preferences } = input;

    // ตรวจสอบและตัดช่องว่างของ Category ID
    const sanitizedItems = preferences.map((item) => ({
      categoryId: item.categoryId.trim(),
      preferenceWeight: item.preferenceWeight !== undefined ? item.preferenceWeight : 1.0,
    }));

    // ดำเนินการแบบ Atomic Replacement ภายใต้ Prisma Transaction
    const updatedPreferences = await prisma.$transaction(async (txPrisma) => {
      // 1. ลบรายการ Preferences เดิมของผู้ใช้งานรายนี้ทั้งหมด
      await txPrisma.user_category_preferences.deleteMany({
        where: { user_id: userId },
      });

      // 2. หากมีรายการหมวดหมู่ใหม่ที่เลือก ให้ทำการ Insert แบบ CreateMany
      if (sanitizedItems.length > 0) {
        await txPrisma.user_category_preferences.createMany({
          data: sanitizedItems.map((item) => ({
            user_id: userId,
            category_id: item.categoryId,
            preference_weight: item.preferenceWeight,
          })),
        });
      }

      // 3. ดึงรายการล่าสุดที่บันทึกสำเร็จกลับมาเพื่อตอบกลับ
      return await txPrisma.user_category_preferences.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'asc' },
      });
    });

    return {
      userId,
      totalCategories: updatedPreferences.length,
      preferences: updatedPreferences.map((p) => ({
        preferenceId: p.preference_id,
        categoryId: p.category_id,
        preferenceWeight: Number(p.preference_weight),
        createdAt: p.created_at.toISOString(),
        updatedAt: p.updated_at.toISOString(),
      })),
    };
  }
}

export const preferenceService = new PreferenceService();
