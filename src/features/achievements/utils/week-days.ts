export type WeekDay = { date: string; checkedIn: boolean; isToday: boolean };

export function buildWeekDays(
  last7Days: { date: string; checkedIn: boolean }[],
  today: string
): WeekDay[] {
  const [y, m, d] = today.split('-').map(Number);
  const todayDate = new Date(y, m - 1, d);
  const day = todayDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      date: dateStr,
      checkedIn: last7Days.find((e) => e.date === dateStr)?.checkedIn ?? false,
      isToday: dateStr === today
    };
  });
}
