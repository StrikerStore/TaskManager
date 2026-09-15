import type { RecurrenceFrequency } from "../db/app-schema.js";

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  /** 0-6, Sunday-Saturday. One or more; required for weekly and biweekly. */
  weekdays?: number[] | null;
  /** 1-31. One or more; required for monthly. Clamped to the length of the month. */
  monthDays?: number[] | null;
  /** "HH:MM" in server local time. */
  triggerTime: string;
  /** Biweekly fires on every second week counted from this date's week. */
  anchor?: Date | null;
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ------------------------------------------------------------------ storage */

/** Day sets are stored as a sorted CSV, e.g. "1,4". */
export function parseDays(value: string | null | undefined): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);
}

export function serializeDays(days: number[] | null | undefined): string | null {
  if (!days || days.length === 0) return null;
  return [...new Set(days)].sort((a, b) => a - b).join(",");
}

/* --------------------------------------------------------------------- time */

/** "09:30" -> { hours: 9, minutes: 30 }; anything malformed falls back to 09:00. */
export function parseTriggerTime(value: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { hours: 9, minutes: 0 };

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return { hours: 9, minutes: 0 };
  return { hours, minutes };
}

function atTime(date: Date, time: { hours: number; minutes: number }): Date {
  const d = new Date(date);
  d.setHours(time.hours, time.minutes, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** The Sunday that starts this date's week, at midnight. */
function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** Whole weeks between the weeks containing two dates. */
function weeksBetween(a: Date, b: Date): number {
  const diff = startOfWeek(b).getTime() - startOfWeek(a).getTime();
  return Math.round(diff / (7 * 86_400_000));
}

/* ---------------------------------------------------------------- next run */

/**
 * The first occurrence strictly after `from`.
 *
 * Strictly after matters: when the scheduler fires at 09:00 it recomputes from
 * that same moment, and must land on the next slot rather than firing again.
 *
 * With several days selected, every day produces a candidate and the earliest
 * one wins — that is all "twice a week" means.
 */
export function computeNextRun(rule: RecurrenceRule, from: Date = new Date()): Date {
  const time = parseTriggerTime(rule.triggerTime);

  if (rule.frequency === "daily") {
    const todayAtTime = atTime(from, time);
    return todayAtTime > from ? todayAtTime : atTime(addDays(from, 1), time);
  }

  if (rule.frequency === "weekly" || rule.frequency === "biweekly") {
    const weekdays = rule.weekdays?.length ? rule.weekdays : [from.getDay()];
    // Biweekly counts from the anchor's week; without one, this week is "on".
    const anchor = rule.anchor ?? from;

    const candidates = weekdays.map((weekday) => {
      const delta = (weekday - from.getDay() + 7) % 7;
      let candidate = atTime(addDays(from, delta), time);
      if (candidate <= from) candidate = atTime(addDays(candidate, 7), time);

      if (rule.frequency === "biweekly") {
        // Push a whole week whenever the candidate lands in an "off" week.
        if (Math.abs(weeksBetween(anchor, candidate)) % 2 !== 0) {
          candidate = atTime(addDays(candidate, 7), time);
        }
      }
      return candidate;
    });

    return candidates.reduce((earliest, c) => (c < earliest ? c : earliest));
  }

  // monthly
  const monthDays = rule.monthDays?.length ? rule.monthDays : [from.getDate()];
  let year = from.getFullYear();
  let month = from.getMonth();

  for (let i = 0; i < 13; i++) {
    const length = daysInMonth(year, month);
    // 30 and 31 both land on the 28th in February: dedupe so it fires once.
    const days = [...new Set(monthDays.map((d) => Math.min(d, length)))].sort((a, b) => a - b);

    const candidates = days
      .map((day) => atTime(new Date(year, month, day), time))
      .filter((candidate) => candidate > from);

    if (candidates.length > 0) {
      return candidates.reduce((earliest, c) => (c < earliest ? c : earliest));
    }

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  // Unreachable in practice; keeps the return type honest.
  return atTime(addDays(from, 1), time);
}

/* ----------------------------------------------------------------- summary */

function ordinal(day: number): string {
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${day}${suffix}`;
}

/** "Twice a week", "3× a week" — only used when more than one day is picked. */
function timesPerPeriod(count: number, period: string): string {
  if (count === 2) return `Twice a ${period}`;
  if (count === 3) return `3× a ${period}`;
  return `${count}× a ${period}`;
}

function isWeekdaySet(days: number[]): boolean {
  return days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d));
}

function isWeekendSet(days: number[]): boolean {
  return days.length === 2 && days.includes(0) && days.includes(6);
}

/** Human summary for the UI, e.g. "Twice a week · Mon, Thu at 09:00". */
export function describeRecurrence(rule: RecurrenceRule): string {
  const { hours, minutes } = parseTriggerTime(rule.triggerTime);
  const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  if (rule.frequency === "daily") return `Every day at ${time}`;

  if (rule.frequency === "weekly" || rule.frequency === "biweekly") {
    const days = [...(rule.weekdays ?? [])].sort((a, b) => a - b);
    const names = days.map((d) => WEEKDAY_SHORT[d] ?? "?").join(", ");

    if (rule.frequency === "biweekly") {
      if (days.length === 0) return `Every other week at ${time}`;
      if (days.length === 1) return `Every other ${WEEKDAY_NAMES[days[0]!]} at ${time}`;
      return `Every other week on ${names} at ${time}`;
    }

    if (days.length === 0) return `Every week at ${time}`;
    if (days.length === 7) return `Every day at ${time}`;
    if (isWeekdaySet(days)) return `Every weekday at ${time}`;
    if (isWeekendSet(days)) return `Every weekend at ${time}`;
    if (days.length === 1) return `Every ${WEEKDAY_NAMES[days[0]!]} at ${time}`;
    return `${timesPerPeriod(days.length, "week")} · ${names} at ${time}`;
  }

  const days = [...(rule.monthDays ?? [])].sort((a, b) => a - b);
  if (days.length === 0) return `Every month at ${time}`;
  if (days.length === 1) return `Monthly on the ${ordinal(days[0]!)} at ${time}`;
  return `${timesPerPeriod(days.length, "month")} · ${days.map(ordinal).join(", ")} at ${time}`;
}
