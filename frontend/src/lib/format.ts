import { differenceInCalendarDays, format, isThisYear } from "date-fns";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** "Overdue 2d", "Today", "Fri", "12 Mar" — short enough for a dense row. */
export function formatDue(value: string | Date | null): { label: string; tone: "overdue" | "today" | "soon" | "normal" } | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;

  const days = differenceInCalendarDays(date, new Date());

  if (days < 0) return { label: days === -1 ? "Yesterday" : `${Math.abs(days)}d overdue`, tone: "overdue" };
  if (days === 0) return { label: "Today", tone: "today" };
  if (days === 1) return { label: "Tomorrow", tone: "soon" };
  if (days < 7) return { label: format(date, "EEE"), tone: "soon" };
  return { label: format(date, isThisYear(date) ? "d MMM" : "d MMM yy"), tone: "normal" };
}

export function toDateInputValue(value: string | Date | null): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

/** A date input gives "2026-03-12"; send it as midday ISO so timezones don't shift the day. */
export function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
