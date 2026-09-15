"use client";

import { cn } from "@/lib/format";
import { DAY_PRESETS, WEEKDAY_INITIALS, WEEKDAY_SHORT } from "@/lib/types";

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
}

/** Square toggle used by both pickers, sized for thumbs on a phone. */
function DayToggle({
  active,
  label,
  title,
  onClick,
}: {
  active: boolean;
  label: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "flex h-9 min-w-9 items-center justify-center rounded-[8px] border px-1 font-mono text-[13px]",
        "transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px",
        active
          ? "border-signal bg-signal text-paper font-medium"
          : "border-rule-strong bg-raised text-ink-soft hover:border-ink-muted hover:bg-sunken",
      )}
    >
      {label}
    </button>
  );
}

/** Sunday-to-Saturday chips. Any number can be on: two of them is "twice a week". */
export function WeekdayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort());

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAY_INITIALS.map((letter, index) => (
          <DayToggle
            key={index}
            active={value.includes(index)}
            label={letter}
            title={WEEKDAY_SHORT[index]}
            onClick={() => toggle(index)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DAY_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.days)}
            className={cn(
              "h-7 rounded-full border px-2.5 font-mono text-[11px] uppercase tracking-[0.08em]",
              "transition-colors",
              sameDays(value, preset.days)
                ? "border-signal bg-signal-soft text-signal"
                : "border-rule-strong bg-raised text-ink-muted hover:border-ink-muted hover:text-ink",
            )}
          >
            {preset.label}
          </button>
        ))}
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="h-7 px-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-signal"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

/** 1-31 in a seven-wide grid, so it reads like a month and fits a phone. */
export function MonthDayPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
          <DayToggle
            key={day}
            active={value.includes(day)}
            label={String(day)}
            onClick={() => toggle(day)}
          />
        ))}
      </div>
      <p className="font-mono text-[11px] text-ink-muted">
        29–31 fall back to the last day in shorter months.
      </p>
    </div>
  );
}
