import api from '../lib/axios';
import { ApiResponse } from '../types';

/**
 * ข้อมูลหมวดหมู่ความสนใจของผู้ใช้แต่ละรายการ
 */
export interface UserPreferenceItem {
  preferenceId: string;
  categoryId: string;
  preferenceWeight: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * ข้อมูลตอบกลับจาก GET /api/preferences และ PUT /api/preferences
 */
export interface UserPreferencesData {
  userId: string;
  totalCategories: number;
  preferences: UserPreferenceItem[];
}

/**
 * DTO สำหรับการอัปเดตรายการ Preferences (PUT /api/preferences)
 */
export interface UpdatePreferencesPayload {
  preferences: Array<{
    categoryId: string;
    preferenceWeight?: number;
  }>;
}

/**
 * API Service สำหรับระบบตั้งค่าประเภทร้านค้าที่สนใจ (Developer 3: UC 2.5.3)
 */
export const preferenceApi = {
  /**
   * ดึงรายการหมวดหมู่ความสนใจของผู้ใช้งานปัจจุบัน (GET /api/preferences)
   */
  async getPreferences(): Promise<UserPreferencesData> {
    const response = await api.get<ApiResponse<UserPreferencesData>>('/preferences');
    return response.data.data;
  },

  /**
   * บันทึกหรือปรับปรุงรายการหมวดหมู่ความสนใจ (PUT /api/preferences)
   */
  async updatePreferences(payload: UpdatePreferencesPayload): Promise<UserPreferencesData> {
    const response = await api.put<ApiResponse<UserPreferencesData>>('/preferences', payload);
    return response.data.data;
  },
};
