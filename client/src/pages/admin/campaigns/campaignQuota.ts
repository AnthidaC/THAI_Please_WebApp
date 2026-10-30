export const moneyToCents = (value: number | string): bigint | null => {
  const match = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  if (!match) return null;
  const [, sign, whole, fraction = ''] = match;
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  return sign === '-' ? -cents : cents;
};

export const sumMoneyCents = (values: Array<number | string>): bigint =>
  values.reduce((sum, value) => sum + (moneyToCents(value) ?? 0n), 0n);

export const periodQuotasMatchCampaignTotal = (
  campaignTotal: number | string,
  periodQuotas: Array<number | string>
): boolean => {
  const campaignCents = moneyToCents(campaignTotal);
  const periodCents = periodQuotas.map(moneyToCents);
  return periodQuotas.length > 0
    && campaignCents !== null
    && campaignCents >= 0n
    && periodCents.every((quota) => quota !== null && quota >= 0n)
    && sumMoneyCents(periodQuotas) === campaignCents;
};
