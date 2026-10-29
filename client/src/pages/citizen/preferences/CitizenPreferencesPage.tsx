import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Info,
  Sparkles,
  Check,
} from 'lucide-react';
import { preferenceApi, UserPreferencesData } from '../../../services/preferenceApi';
import { APP_ROUTES } from '../../../constants/routes';
import {
  CANONICAL_CATEGORY_LIST,
} from '../../../constants/categories';

export const CitizenPreferencesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // สถานะการเลือกหมวดหมู่ (Local Selection State)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasInitialized, setHasInitialized] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. ดึงข้อมูล Preferences เดิมจาก Backend (GET /api/preferences)
  const {
    data: preferencesData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<UserPreferencesData>({
    queryKey: ['user-preferences'],
    queryFn: preferenceApi.getPreferences,
    retry: 1,
  });

  // 2. Preselect saved preferences เมื่อโหลดข้อมูลเสร็จ
  useEffect(() => {
    if (preferencesData && !hasInitialized) {
      const savedIds = new Set(preferencesData.preferences.map((p) => p.categoryId));
      setSelectedIds(savedIds);
      setHasInitialized(true);
    }
  }, [preferencesData, hasInitialized]);

  // 3. Mutation บันทึกข้อมูลไปยัง Backend (PUT /api/preferences)
  const saveMutation = useMutation({
    mutationFn: (categoryIds: string[]) => {
      const payload = {
        preferences: categoryIds.map((id) => ({
          categoryId: id,
          preferenceWeight: 1.0, // Default weight ตาม schema
        })),
      };
      return preferenceApi.updatePreferences(payload);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user-preferences'], data);
      queryClient.invalidateQueries({ queryKey: ['recommendations'] });
      setSuccessToast('บันทึกการตั้งค่าประเภทร้านค้าที่สนใจเรียบร้อยแล้ว');
      setErrorMessage(null);
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'ไม่สามารถบันทึกการตั้งค่าได้';
      setErrorMessage(msg);
      setSuccessToast(null);
    },
  });

  // ตรวจสอบว่ามีการเปลี่ยนแปลงจากการบันทึกครั้งล่าสุดหรือไม่
  const hasChanges = useMemo(() => {
    if (!preferencesData) return selectedIds.size > 0;
    const initialIds = new Set(preferencesData.preferences.map((p) => p.categoryId));
    if (initialIds.size !== selectedIds.size) return true;
    for (const id of selectedIds) {
      if (!initialIds.has(id)) return true;
    }
    return false;
  }, [preferencesData, selectedIds]);

  const handleToggleCategory = (categoryId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
    setSuccessToast(null);
  };

  const handleSelectAll = () => {
    const allIds = new Set(CANONICAL_CATEGORY_LIST.map((c) => c.id));
    setSelectedIds(allIds);
    setSuccessToast(null);
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
    setSuccessToast(null);
  };

  const handleSave = () => {
    saveMutation.mutate(Array.from(selectedIds));
  };

  return (
    <div className="min-h-screen bg-surface-soft pb-24 md:pb-12 font-sans text-ink">
      {/* Top Bar with Consistent Citizen Header */}
      <div className="bg-white border-b border-hairline px-3.5 sm:px-6 lg:px-8 py-3 sm:py-3.5 mb-3.5 sm:mb-5 shadow-2xs">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.PROFILE)}
              className="flex shrink-0 items-center space-x-1.5 rounded-pill px-2.5 sm:px-3 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline"
              title="กลับหน้าโปรไฟล์"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">กลับหน้าโปรไฟล์</span>
            </button>
            <div className="border-l border-hairline pl-2.5 sm:pl-3 min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-ink truncate">
                ประเภทร้านค้าที่สนใจ
              </h1>
              <p className="text-[11px] sm:text-xs text-brand-blue font-medium truncate">
                เลือกประเภทสินค้าและบริการที่คุณต้องการให้ความสำคัญเป็นพิเศษ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex shrink-0 items-center space-x-1.5 rounded-pill px-2.5 sm:px-3.5 py-1.5 text-xs font-medium text-ink-muted bg-surface-soft hover:bg-gray-200 hover:text-ink transition border border-hairline"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-brand-blue' : ''}`} />
            <span className="hidden xs:inline">อัปเดต</span>
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl px-4 sm:px-6 space-y-4">
        {/* Banner ข้อมูลหมวดหมู่ & การใช้งานระบบ */}
        <div className="rounded-card border border-hairline bg-white p-4 sm:p-5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-brand-blue-light border border-blue-200 text-brand-blue text-xs font-semibold">
                <Sparkles className="h-3 w-3" />
                <span>การตั้งค่าความสนใจส่วนบุคคล</span>
              </span>
              <span className="text-xs text-ink-muted">
                (Personal Preferences)
              </span>
            </div>
            <span className="px-3 py-0.5 rounded-pill bg-blue-50 border border-blue-200 text-brand-blue font-mono font-numeric text-xs font-bold shrink-0">
              เลือกแล้ว {selectedIds.size} / {CANONICAL_CATEGORY_LIST.length}
            </span>
          </div>

          <p className="text-xs text-ink-muted leading-relaxed">
            เลือกประเภทของร้านค้าชุมชนที่คุณชื่นชอบเพื่อช่วยให้ระบบสามารถแสดงผลและแนะนำร้านค้าที่ตรงกับความต้องการของคุณมากที่สุด
          </p>

          {/* ข้อความชี้แจงตามข้อกำหนดสถาปัตยกรรม (Recommendation Scoring Notice) */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 flex items-start gap-2.5 text-xs text-ink-body">
            <Info className="h-4 w-4 text-brand-blue shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-brand-blue">
                ข้อชี้แจงระบบการจัดอันดับร้านค้า (AI Recommendation Scoring)
              </p>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                การตั้งค่านี้จะถูกบันทึกในโปรไฟล์ส่วนบุคคลของคุณ ทั้งนี้ระบบ AI Recommendation Scoring ปัจจุบันคำนวณคะแนนตามระยะทางจริง พิกัด GPS เรตติ้ง และความนิยม 24 ชม. เป็นหลัก จนกว่าโครงสร้างหมวดหมู่ร้านค้าส่วนกลาง (Master Taxonomy) จะได้รับการอนุมัติอย่างเป็นทางการ
              </p>
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {successToast && (
          <div className="rounded-card border border-emerald-200 bg-emerald-50 p-3.5 flex items-center justify-between gap-2 text-xs text-emerald-800 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{successToast}</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-mono">บันทึกสำเร็จ</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="rounded-card border border-red-200 bg-red-50 p-3.5 flex items-center justify-between gap-2 text-xs text-status-error animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-status-error shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-xs underline font-medium hover:text-red-900"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="rounded-card border border-hairline bg-white p-4 animate-pulse space-y-2 shadow-xs"
              >
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-gray-200 rounded-pill w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded-full w-5"></div>
                </div>
                <div className="h-3 bg-gray-100 rounded-pill w-2/3"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error State on Load */}
        {isError && (
          <div className="rounded-card border border-red-200 bg-white p-6 text-center space-y-3 shadow-xs">
            <div className="h-10 w-10 rounded-full bg-red-50 text-status-error flex items-center justify-center mx-auto border border-red-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-ink">ไม่สามารถโหลดข้อมูลการตั้งค่าได้</h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              {(error as any)?.response?.data?.message || (error as Error)?.message || 'เกิดข้อผิดพลาดในการติดต่อกับเซิร์ฟเวอร์'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-brand-blue text-white text-xs font-semibold hover:bg-brand-blue-hover transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>ลองใหม่อีกครั้ง</span>
            </button>
          </div>
        )}

        {/* Category List */}
        {!isLoading && !isError && (
          <>
            {/* Quick Actions (Select All / Clear All) */}
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="text-ink-muted font-medium">
                แตะที่การ์ดเพื่อเลือกหรือยกเลิกหมวดหมู่
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-brand-blue hover:text-brand-blue-hover font-semibold transition text-xs"
                >
                  เลือกทั้งหมด
                </button>
                <span className="text-hairline">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-ink-muted hover:text-ink font-medium transition text-xs"
                >
                  ล้างทั้งหมด
                </button>
              </div>
            </div>

            {/* Selectable Cards */}
            <div className="space-y-2.5">
              {CANONICAL_CATEGORY_LIST.map((category) => {
                const isSelected = selectedIds.has(category.id);
                const IconComponent = category.icon;

                return (
                  <article
                    key={category.id}
                    onClick={() => handleToggleCategory(category.id)}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleToggleCategory(category.id);
                      }
                    }}
                    className={`rounded-card border p-4 transition-all duration-150 cursor-pointer select-none flex items-start justify-between gap-3 shadow-xs ${
                      isSelected
                        ? 'border-brand-blue bg-blue-50/40 ring-1 ring-brand-blue/30'
                        : 'border-hairline bg-white hover:border-gray-300 hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-start space-x-3 min-w-0">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border transition ${
                          isSelected
                            ? 'bg-brand-blue text-white border-brand-blue shadow-xs'
                            : 'bg-surface-soft text-ink-muted border-hairline'
                        }`}
                      >
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={`text-sm font-bold truncate ${
                              isSelected ? 'text-brand-blue' : 'text-ink'
                            }`}
                          >
                            {category.nameTh}
                          </h3>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded-pill border ${category.badgeColor}`}
                          >
                            {category.id}
                          </span>
                        </div>
                        <p className="text-xs text-ink-muted leading-relaxed">
                          {category.description}
                        </p>
                      </div>
                    </div>

                    {/* Custom Checkbox Pill */}
                    <div className="shrink-0 pt-0.5">
                      <div
                        className={`h-5 w-5 rounded-md flex items-center justify-center border transition ${
                          isSelected
                            ? 'bg-brand-blue border-brand-blue text-white shadow-xs'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Empty State warning if nothing is selected */}
            {selectedIds.size === 0 && (
              <div className="rounded-card border border-hairline bg-white p-5 text-center space-y-1.5 shadow-xs">
                <p className="text-xs font-semibold text-ink">
                  ยังไม่ได้เลือกหมวดหมู่ที่สนใจ
                </p>
                <p className="text-[11px] text-ink-muted">
                  หากไม่เลือกหมวดหมู่ใดเลย ระบบจะแสดงร้านค้าทุกประเภทตามระยะทางและความนิยมทั่วไป
                </p>
              </div>
            )}

            {/* Floating / Sticky Save Footer Action */}
            <div className="pt-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending || (!hasChanges && preferencesData !== undefined)}
                className={`w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-xs font-bold shadow-xs transition active:scale-98 ${
                  saveMutation.isPending || (!hasChanges && preferencesData !== undefined)
                    ? 'bg-gray-200 text-ink-muted cursor-not-allowed border border-hairline'
                    : 'bg-brand-blue hover:bg-brand-blue-hover text-white shadow-blue-500/20'
                }`}
              >
                {saveMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>กำลังบันทึกการตั้งค่า...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>
                      {hasChanges
                        ? `บันทึกหมวดหมู่ที่เลือก (${selectedIds.size} รายการ)`
                        : 'บันทึกเรียบร้อย (ไม่มีการเปลี่ยนแปลง)'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default CitizenPreferencesPage;
