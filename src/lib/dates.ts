/** Today's date (YYYY-MM-DD) in the given IANA time zone. */
export function todayIn(timeZone = "Europe/Bucharest", now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday for a YYYY-MM-DD date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function isSchoolDay(date: string): boolean {
  return isoWeekday(date) <= 5;
}

export function formatDate(date: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  const d = typeof date === "string" ? new Date(date.length === 10 ? `${date}T12:00:00Z` : date) : date;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", ...opts }).format(d);
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(date: string | Date, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return formatDate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}
