const bangkokDateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const getBangkokDateKey = (instant: Date): string => {
  const parts = Object.fromEntries(bangkokDateParts.formatToParts(instant).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** Prisma maps PostgreSQL DATE values through a UTC-midnight JavaScript Date. */
export const toBangkokDatabaseDate = (instant: Date): Date =>
  new Date(`${getBangkokDateKey(instant)}T00:00:00.000Z`);

export const getDatabaseDateKey = (dateValue: Date): string => dateValue.toISOString().slice(0, 10);
