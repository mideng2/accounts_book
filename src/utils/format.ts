export function formatAmountFromCent(value: number) {
  return (value / 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatMonthLabel(date: Date) {
  return `${date.getFullYear()} 年 ${String(date.getMonth() + 1).padStart(2, '0')} 月`;
}

export function formatDateGroup(dateText: string) {
  const date = new Date(dateText);
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];

  return `${String(date.getMonth() + 1).padStart(2, '0')} 月 ${String(date.getDate()).padStart(2, '0')} 日 ${weekday}`;
}

export function toLocalDateKey(dateText: string) {
  const date = new Date(dateText);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDateTimeLocalValue(dateText: string) {
  const date = new Date(dateText);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toDateValue(dateText: string) {
  const date = new Date(dateText);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
