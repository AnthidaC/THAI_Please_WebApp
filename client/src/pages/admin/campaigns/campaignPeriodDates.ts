const CAMPAIGN_TIME_ZONE = 'Asia/Bangkok';

interface CalendarParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface GeneratedCampaignPeriod {
  periodName: string;
  startDate: string;
  endDate: string;
  periodQuotaLimit: number;
}

const parseDateTimeLocal = (value: string): CalendarParts | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number) as unknown as [number, number, number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute) return null;
  return { year, month, day, hour, minute };
};

const toDateTimeLocal = ({ year, month, day, hour, minute }: CalendarParts) =>
  `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

const addMonths = (parts: CalendarParts, amount: number): CalendarParts => {
  const target = new Date(Date.UTC(parts.year, parts.month - 1 + amount, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    year: target.getUTCFullYear(),
    month: target.getUTCMonth() + 1,
    day: Math.min(parts.day, lastDay),
    hour: parts.hour,
    minute: parts.minute,
  };
};

const compareCalendarParts = (left: CalendarParts, right: CalendarParts) =>
  Date.UTC(left.year, left.month - 1, left.day, left.hour, left.minute) -
  Date.UTC(right.year, right.month - 1, right.day, right.hour, right.minute);

export const bangkokDateTimeToIso = (value: string): string => {
  const parts = parseDateTimeLocal(value);
  if (!parts) throw new Error('Enter a valid date and time.');
  return new Date(`${value}:00+07:00`).toISOString();
};

export const isoToBangkokDateTime = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CAMPAIGN_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
};

export const generateMonthlyCampaignPeriods = (
  campaignStart: string,
  campaignEnd: string,
  monthCount: number,
  quotaPerMonth: number
): GeneratedCampaignPeriod[] => {
  const start = parseDateTimeLocal(campaignStart);
  const end = parseDateTimeLocal(campaignEnd);
  if (!start || !end || compareCalendarParts(start, end) >= 0 || !Number.isInteger(monthCount) || monthCount < 1 || quotaPerMonth < 0) {
    return [];
  }

  const generated: GeneratedCampaignPeriod[] = [];
  for (let index = 0; index < monthCount; index += 1) {
    const periodStart = addMonths(start, index);
    if (compareCalendarParts(periodStart, end) >= 0) break;
    const calculatedEnd = addMonths(start, index + 1);
    const periodEnd = compareCalendarParts(calculatedEnd, end) > 0 ? end : calculatedEnd;
    generated.push({
      periodName: `ช่วงที่ ${index + 1}`,
      startDate: toDateTimeLocal(periodStart),
      endDate: toDateTimeLocal(periodEnd),
      periodQuotaLimit: Math.round(quotaPerMonth * 100) / 100,
    });
  }
  return generated;
};
