import * as Slider from '@radix-ui/react-slider';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ConditionTypeUnit } from '../../services/admin/gamificationApi';
import {
  BADGE_TIER_IDENTITIES,
  BADGE_TIER_MAX,
  calculateBadgeProgressPreview,
  formatBadgeThreshold,
  getBadgeThresholdUnitLabel,
  getSuggestedBadgeSliderMax,
  increaseBadgeSliderMax,
  scaleBadgeThresholds,
  validateBadgeThresholds,
} from './badgeTierThresholds';

export interface BadgeTierThresholdSliderProps {
  id?: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
  measurementUnit: ConditionTypeUnit | undefined;
  conditionKey?: string;
  conditionName?: string;
  disabled?: boolean;
  readOnly?: boolean;
  lockedTiers?: readonly boolean[];
  validationErrors?: readonly (string | null | undefined)[];
  previewProgress?: string;
  onPreviewProgressChange?: (value: string) => void;
}

const BadgeTierThresholdSlider = ({
  id,
  values,
  onChange,
  measurementUnit,
  conditionKey = '',
  conditionName,
  disabled = false,
  readOnly = false,
  lockedTiers = [],
  validationErrors = [],
  previewProgress,
  onPreviewProgressChange,
}: BadgeTierThresholdSliderProps) => {
  const generatedId = useId().replace(/:/g, '');
  const baseId = id ?? `badge-tier-threshold-${generatedId}`;
  const [proportional, setProportional] = useState(false);
  const [expandedMax, setExpandedMax] = useState(0);
  const [localPreviewProgress, setLocalPreviewProgress] = useState('0');
  const [scalingError, setScalingError] = useState('');
  const scalingBaseline = useRef<string[] | null>(null);
  const lastValidSliderValues = useRef<number[]>([1, 2, 3, 4]);
  const inert = disabled || readOnly;
  const tierValidation = useMemo(() => validateBadgeThresholds(values), [values]);
  const parsedValues = tierValidation.valid ? values.map(Number) : lastValidSliderValues.current;
  useEffect(() => {
    if (tierValidation.valid) lastValidSliderValues.current = values.map(Number);
  }, [tierValidation.valid, values]);
  const suggestedMax = getSuggestedBadgeSliderMax(values);
  const sliderMax = Math.max(suggestedMax, expandedMax);
  const unitLabel = getBadgeThresholdUnitLabel(measurementUnit, conditionKey);
  const progressValue = previewProgress ?? localPreviewProgress;
  const parsedProgress = progressValue.trim() === '' ? Number.NaN : Number(progressValue);
  const progressPreview = calculateBadgeProgressPreview(values, parsedProgress);
  const locked = BADGE_TIER_IDENTITIES.map((_, index) => Boolean(lockedTiers[index]));
  const hasLockedTier = locked.some(Boolean);
  const sliderDisabled = inert || !tierValidation.valid;

  const updateValue = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    setScalingError('');
    onChange(next);
  };

  const updateNumericValue = (index: number, value: string) => {
    if (index !== 3 || !proportional || hasLockedTier || !Number.isSafeInteger(Number(value))) {
      updateValue(index, value);
      return;
    }

    const baseline = scalingBaseline.current ?? [...values];
    const scaled = scaleBadgeThresholds(baseline, Number(value));
    if (!scaled.values) {
      updateValue(index, value);
      setScalingError(scaled.error);
      return;
    }
    setScalingError('');
    onChange(scaled.values);
  };

  const applySliderValues = (next: number[]) => {
    if (sliderDisabled || next.length !== BADGE_TIER_IDENTITIES.length) return;
    if (locked.some((isLocked, index) => isLocked && next[index] !== parsedValues[index])) return;

    const nextStrings = next.map(String);
    if (proportional && next[3] !== parsedValues[3]) {
      const baseline = scalingBaseline.current ?? [...values];
      const scaled = scaleBadgeThresholds(baseline, next[3]);
      if (!scaled.values) {
        setScalingError(scaled.error);
        return;
      }
      if (locked.some((isLocked, index) => isLocked && scaled.values?.[index] !== values[index])) return;
      setScalingError('');
      onChange(scaled.values);
      return;
    }

    setScalingError('');
    onChange(nextStrings);
  };

  const beginScalingGesture = (tierIndex: number) => {
    if (!proportional || tierIndex !== 3) {
      scalingBaseline.current = null;
      return;
    }
    scalingBaseline.current ??= [...values];
  };

  const endScalingGesture = () => {
    scalingBaseline.current = null;
  };

  const finishNumericEdit = (index: number, value: string) => {
    if (index !== 3 || !proportional || !Number.isSafeInteger(Number(value))) {
      endScalingGesture();
      return;
    }
    const baseline = scalingBaseline.current;
    endScalingGesture();
    if (!baseline) return;
    const scaled = scaleBadgeThresholds(baseline, Number(value));
    if (!scaled.values) {
      setScalingError(scaled.error);
      return;
    }
    if (locked.some((isLocked, tierIndex) => isLocked && scaled.values?.[tierIndex] !== values[tierIndex])) return;
    setScalingError('');
    onChange(scaled.values);
  };

  const setProgressValue = (value: string) => {
    if (onPreviewProgressChange) onPreviewProgressChange(value);
    else setLocalPreviewProgress(value);
  };

  const firstError = tierValidation.message;

  return (
    <div className="space-y-4">
      <fieldset className="space-y-3" disabled={inert}>
        <legend className="sr-only">เกณฑ์ปลดล็อกเหรียญตราทั้ง 4 ระดับ</legend>
        <div className="rounded-xl border border-hairline bg-white px-3 pb-2 pt-3 sm:px-4">
          <Slider.Root
            className="relative flex h-11 w-full touch-none select-none items-center"
            min={1}
            max={sliderMax}
            step={1}
            minStepsBetweenThumbs={1}
            preserveThumbOrder
            value={parsedValues}
            disabled={sliderDisabled}
            onValueChange={applySliderValues}
            onValueCommit={endScalingGesture}
            aria-label="เกณฑ์ปลดล็อกเหรียญตรา"
          >
            <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-slate-200">
              <Slider.Range className="absolute h-full rounded-full bg-brand-blue" />
            </Slider.Track>
            {BADGE_TIER_IDENTITIES.map((tier, index) => (
              <Slider.Thumb
                key={tier.level}
                className={`group relative z-10 flex h-11 w-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed ${locked[index] ? 'aria-disabled:cursor-not-allowed aria-disabled:opacity-70' : ''}`}
                style={{ ['--badge-tier-color' as string]: tier.color }}
                aria-label={`เกณฑ์ระดับ ${tier.label}`}
                aria-valuetext={formatBadgeThreshold(parsedValues[index], measurementUnit)}
                aria-disabled={inert || locked[index] || !tierValidation.valid}
                tabIndex={locked[index] || inert || !tierValidation.valid ? -1 : 0}
                onPointerDown={() => beginScalingGesture(index)}
                onPointerUp={endScalingGesture}
                onPointerCancel={endScalingGesture}
                onKeyDown={() => beginScalingGesture(index)}
                onKeyUp={endScalingGesture}
                onBlur={endScalingGesture}
              >
                <span aria-hidden="true" className="h-5 w-5 rounded-full border-[3px] border-white bg-[var(--badge-tier-color)] shadow-[0_1px_4px_rgba(15,23,42,0.35)] transition-transform group-focus-visible:scale-110" />
              </Slider.Thumb>
            ))}
          </Slider.Root>
          <div className="mt-1 flex items-center justify-between gap-3 text-[11px] tabular-nums text-ink-muted">
            <span>1 {unitLabel}</span>
            <span>ช่วงสูงสุด {new Intl.NumberFormat('th-TH').format(sliderMax)} {unitLabel}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-muted">หากปุ่มเลื่อนอยู่ชิดกัน ให้ปรับค่าจากช่องตัวเลขด้านล่าง</p>
          <button
            type="button"
            disabled={inert || sliderMax >= BADGE_TIER_MAX}
            onClick={() => setExpandedMax((current) => increaseBadgeSliderMax(Math.max(current, sliderMax)))}
            className="mt-2 min-h-11 rounded-lg px-2 text-xs font-semibold text-brand-blue hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ขยายช่วงสูงสุด
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {BADGE_TIER_IDENTITIES.map((tier, index) => {
            const fieldId = `${baseId}-${tier.name.toLowerCase()}`;
            const errorId = `${fieldId}-error`;
            const fieldError = validationErrors[index] ?? tierValidation.errors[index];
            const isLocked = locked[index];
            return (
              <div key={tier.level} className="min-w-0 rounded-xl border border-hairline bg-white p-3">
                <label htmlFor={fieldId} className="flex min-h-7 items-center justify-between gap-2 text-sm font-semibold text-ink">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tier.color }} />
                    <span className="truncate">{tier.label}</span>
                  </span>
                  {isLocked && <span className="shrink-0 text-[11px] font-medium text-amber-800">มีประวัติแล้ว</span>}
                </label>
                <div className="mt-2 flex min-w-0 items-center gap-2">
                  <input
                    id={fieldId}
                    name={`badgeTier${tier.level}Threshold`}
                    autoComplete="off"
                    inputMode="numeric"
                    type="number"
                    min={1}
                    max={BADGE_TIER_MAX}
                    step={1}
                    value={values[index] ?? ''}
                    readOnly={readOnly}
                    disabled={disabled || isLocked}
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={fieldError ? errorId : `${fieldId}-unit`}
                    onFocus={() => {
                      if (index === 3 && proportional) scalingBaseline.current = [...values];
                    }}
                    onChange={(event) => updateNumericValue(index, event.target.value)}
                    onBlur={(event) => finishNumericEdit(index, event.target.value)}
                    className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-right text-sm font-semibold tabular-nums text-ink outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:bg-surface-soft ${fieldError ? 'border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100' : 'border-hairline focus-visible:border-brand-blue'}`}
                  />
                  <span id={`${fieldId}-unit`} className="shrink-0 text-xs text-ink-muted">{unitLabel}</span>
                </div>
                {fieldError && <p id={errorId} className="mt-1 text-xs leading-5 text-status-error" role="alert">{fieldError}</p>}
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-xl border border-hairline bg-white p-3 sm:p-4">
        <label htmlFor={`${baseId}-proportional`} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
          <input
            id={`${baseId}-proportional`}
            type="checkbox"
            checked={proportional}
            disabled={inert || hasLockedTier}
            onChange={(event) => { setProportional(event.target.checked); setScalingError(''); }}
            className="h-4 w-4 rounded border-hairline accent-brand-blue focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
          />
          ปรับทุกระดับตามสัดส่วน
        </label>
        <p className="ml-7 text-xs leading-5 text-ink-muted">
          {hasLockedTier
            ? 'มีระดับที่มีประวัติการปลดล็อก โหมดนี้จึงปิดไว้เพื่อรักษาเกณฑ์เดิม'
            : 'เมื่อแก้เกณฑ์แพลทินัม ระบบจะปรับอีก 3 ระดับจากค่าเดิมเมื่อแก้เสร็จ การแก้ระดับอื่นจะเปลี่ยนเฉพาะระดับนั้น'}
        </p>
        {scalingError && <p className="mt-2 text-xs leading-5 text-status-error" role="alert">{scalingError}</p>}
      </div>

      <section aria-labelledby={`${baseId}-preview-heading`} className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 id={`${baseId}-preview-heading`} className="text-sm font-semibold text-ink">ตัวอย่างความคืบหน้า</h4>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              {conditionName ? `${conditionName} · ` : ''}คำนวณในหน้านี้เท่านั้น ไม่บันทึกข้อมูลประชาชน
            </p>
          </div>
          <label htmlFor={`${baseId}-progress`} className="flex min-h-11 shrink-0 items-center gap-2 text-xs font-semibold text-ink">
            <span>ความคืบหน้า</span>
            <input
              id={`${baseId}-progress`}
              name="badgePreviewProgress"
              autoComplete="off"
              inputMode="numeric"
              type="number"
              min={0}
              max={BADGE_TIER_MAX}
              step={1}
              value={progressValue}
              onChange={(event) => setProgressValue(event.target.value)}
              className="w-24 rounded-lg border border-hairline bg-white px-2.5 py-2 text-right text-sm tabular-nums text-ink outline-none focus-visible:border-brand-blue focus-visible:ring-4 focus-visible:ring-blue-100"
            />
            <span className="text-ink-muted">{unitLabel}</span>
          </label>
        </div>

        {!tierValidation.valid ? (
          <p className="mt-3 text-sm text-status-error" aria-live="polite">{firstError}</p>
        ) : !Number.isSafeInteger(parsedProgress) || parsedProgress < 0 ? (
          <p className="mt-3 text-sm text-status-error" aria-live="polite">กรอกความคืบหน้าเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป</p>
        ) : progressPreview?.highestTierAchieved ? (
          <p className="mt-3 text-sm font-semibold text-ink" aria-live="polite">ระดับปัจจุบัน: แพลทินัม · ปลดล็อกครบทุกระดับแล้ว</p>
        ) : progressPreview ? (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2" aria-live="polite">
            <p><span className="text-ink-muted">ระดับปัจจุบัน:</span> {progressPreview.currentTier?.label ?? 'ยังไม่ปลดล็อก'}</p>
            <p>
              <span className="text-ink-muted">ระดับถัดไป:</span> {progressPreview.nextTier?.label}
              {' · '}ต้องการอีก {new Intl.NumberFormat('th-TH').format(progressPreview.remaining ?? 0)} {unitLabel}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default BadgeTierThresholdSlider;
