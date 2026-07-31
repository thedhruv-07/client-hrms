const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

const MONTH_NAMES_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

/** "JUNE" for month=6. */
export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

/** "JUNE-2026" for month=6, year=2026. */
export function monthLabel(month: number, year: number): string {
  return `${monthName(month)}-${year}`;
}

/** "JUN-26" for month=6, year=2026. */
export function monthLabelShort(month: number, year: number): string {
  return `${MONTH_NAMES_SHORT[month - 1] ?? ""}-${String(year).slice(-2)}`;
}

export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}
