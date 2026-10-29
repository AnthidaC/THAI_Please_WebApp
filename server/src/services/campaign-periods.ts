export interface CampaignPeriodInput {
  periodId?: string;
  periodName: string;
  periodQuotaLimit: number;
  startDate: Date;
  endDate: Date;
}

export interface CampaignPeriodValidationIssue {
  index: number | null;
  field?: keyof CampaignPeriodInput;
  message: string;
}

const toCents = (amount: number | string): bigint | null => {
  const value = String(amount).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;

  const [, sign, whole, fraction = ''] = match;
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  return sign === '-' ? -cents : cents;
};

export const validateCampaignPeriodConfiguration = (
  periods: CampaignPeriodInput[],
  campaignStart: Date,
  campaignEnd: Date,
  campaignQuotaLimit: number | string
): CampaignPeriodValidationIssue[] => {
  const issues: CampaignPeriodValidationIssue[] = [];
  const seenIds = new Set<string>();

  periods.forEach((period, index) => {
    if (period.periodId) {
      if (seenIds.has(period.periodId)) {
        issues.push({ index, field: 'periodId', message: 'A period may only appear once.' });
      }
      seenIds.add(period.periodId);
    }

    if (!Number.isFinite(period.startDate.getTime()) || !Number.isFinite(period.endDate.getTime())) {
      issues.push({ index, field: 'startDate', message: 'Period dates must be valid.' });
      return;
    }
    if (period.startDate >= period.endDate) {
      issues.push({ index, field: 'endDate', message: 'Period end must be after its start.' });
    }
    if (period.startDate < campaignStart || period.endDate > campaignEnd) {
      issues.push({ index, field: 'startDate', message: 'Periods must stay within campaign dates.' });
    }
    const quotaCents = toCents(period.periodQuotaLimit);
    if (quotaCents === null) {
      issues.push({ index, field: 'periodQuotaLimit', message: 'Period quota must use at most two decimal places.' });
    } else if (quotaCents < 0n) {
      issues.push({ index, field: 'periodQuotaLimit', message: 'Period quota cannot be negative.' });
    }
  });

  for (let leftIndex = 0; leftIndex < periods.length; leftIndex += 1) {
    const left = periods[leftIndex];
    if (!Number.isFinite(left.startDate.getTime()) || !Number.isFinite(left.endDate.getTime()) || left.startDate >= left.endDate) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < periods.length; rightIndex += 1) {
      const right = periods[rightIndex];
      if (!Number.isFinite(right.startDate.getTime()) || !Number.isFinite(right.endDate.getTime()) || right.startDate >= right.endDate) continue;
      if (left.startDate < right.endDate && right.startDate < left.endDate) {
        issues.push({ index: rightIndex, field: 'startDate', message: 'Periods cannot overlap; adjacent end and start times are allowed.' });
      }
    }
  }

  const quotaCents = periods.map((period) => toCents(period.periodQuotaLimit));
  const campaignCents = toCents(campaignQuotaLimit);
  if (periods.length > 0 && campaignCents !== null && quotaCents.every((amount) => amount !== null && amount >= 0n)) {
    const configuredCents = quotaCents.reduce<bigint>((total, amount) => total + (amount ?? 0n), 0n);
    if (configuredCents !== campaignCents) {
      issues.push({ index: null, message: 'The sum of period quotas must equal the campaign-wide quota.' });
    }
  }

  return issues;
};

export const getActiveCampaignPeriods = <T extends { start_date: Date; end_date: Date }>(
  periods: T[],
  at: Date
): T[] => periods.filter((period) => period.start_date <= at && at < period.end_date);
