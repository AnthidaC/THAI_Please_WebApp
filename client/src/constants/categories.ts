import React from 'react';
import { Utensils, Store, Cake, Coffee, ShoppingBag } from 'lucide-react';

/**
 * Canonical Merchant Category Taxonomy for THAI Please Web Application (Client)
 * Exactly 5 official categories approved for UC 2.5.3 and AI Near-Me Discovery.
 */
export const CANONICAL_CATEGORY_IDS = [
  'FOOD',
  'STREET_FOOD',
  'BAKERY_DESSERT',
  'BEVERAGE',
  'GENERAL_GOODS',
] as const;

export type CanonicalCategoryId = typeof CANONICAL_CATEGORY_IDS[number];

export interface ClientCategoryDefinition {
  id: CanonicalCategoryId;
  nameTh: string;
  nameEn: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: string;
}

export const CANONICAL_CATEGORIES: Record<CanonicalCategoryId, ClientCategoryDefinition> = {
  FOOD: {
    id: 'FOOD',
    nameTh: 'ร้านอาหารทั่วไป',
    nameEn: 'General Food & Restaurants',
    description: 'ร้านอาหารตามสั่ง ข้าวแกง ก๋วยเตี๋ยว และภัตตาคาร',
    icon: Store,
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  STREET_FOOD: {
    id: 'STREET_FOOD',
    nameTh: 'อาหารริมทาง',
    nameEn: 'Street Food & Food Stalls',
    description: 'อาหารจานด่วนริมทาง แผงลอย และร้านรถเข็นชุมชน',
    icon: Utensils,
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  BAKERY_DESSERT: {
    id: 'BAKERY_DESSERT',
    nameTh: 'ขนมหวานและเบเกอรี่',
    nameEn: 'Bakery & Desserts',
    description: 'ขนมหวาน ขนมไทย เบเกอรี่สด และของว่าง',
    icon: Cake,
    badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
  },
  BEVERAGE: {
    id: 'BEVERAGE',
    nameTh: 'เครื่องดื่ม',
    nameEn: 'Beverages & Cafes',
    description: 'ร้านชา กาแฟ คาเฟ่ชุมชน และน้ำดื่มชงสด',
    icon: Coffee,
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  GENERAL_GOODS: {
    id: 'GENERAL_GOODS',
    nameTh: 'สินค้าทั่วไป',
    nameEn: 'General Goods & Grocery',
    description: 'ร้านของชำ ร้านโชห่วย และของใช้จำเป็นในชีวิตประจำวัน',
    icon: ShoppingBag,
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
};

export const CANONICAL_CATEGORY_LIST = Object.values(CANONICAL_CATEGORIES);

/**
 * Type guard ตรวจสอบ categoryId
 */
export const isValidCategoryId = (id: unknown): id is CanonicalCategoryId => {
  return typeof id === 'string' && CANONICAL_CATEGORY_IDS.includes(id as CanonicalCategoryId);
};

/**
 * ฟังก์ชันดึงชื่อภาษาไทยพร้อม Fallback หากร้านไม่มี category_id (null)
 */
export const getCategoryDisplayName = (categoryId?: string | null): string => {
  if (!categoryId || !isValidCategoryId(categoryId)) {
    return 'ร้านค้าสมาชิก Co-pay';
  }
  return CANONICAL_CATEGORIES[categoryId].nameTh;
};
