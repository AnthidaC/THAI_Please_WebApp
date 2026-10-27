/** Calendar dates and day boundaries always use Asia/Bangkok, regardless of host TZ. */
export const thaiDateKey = (date = new Date()): string =>
  new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const thaiDayRange = (date = new Date()) => {
  const start = new Date(`${thaiDateKey(date)}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};
