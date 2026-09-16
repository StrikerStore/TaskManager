"use client";

import { Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "@/components/popover";
import { cn } from "@/lib/format";
import { WEEKDAY_INITIALS } from "@/lib/types";

/* ------------------------------------------------------------------ Select */

export type SelectOption = {
  value: string;
  label: string;
  /** Colour dot shown before the label, e.g. a project colour. */
  dot?: string | null;
  /** Small note shown after the label, e.g. "you". */
  note?: string;
  disabled?: boolean;
};

/**
 * Listbox that replaces <select>. A native select draws its option list with
 * the operating system, which ignores the theme; this one is ours, and still
 * behaves like a select for keyboard and screen-reader users.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  id,
  ariaLabel,
  title,
  className,
  wrapperClassName,
  size = "md",
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  title?: string;
  className?: string;
  wrapperClassName?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeAhead = useRef({ term: "", at: 0 });

  const selected = options.find((o) => o.value === value) ?? null;
  const selectableIndexes = useMemo(
    () => options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0),
    [options],
  );

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const pick = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      onChange(option.value);
      close();
    },
    [options, onChange, close],
  );

  // Open with the current value highlighted, and keep it in view.
  useEffect(() => {
    if (!open) return;
    const current = options.findIndex((o) => o.value === value);
    setHighlight(current >= 0 ? current : (selectableIndexes[0] ?? 0));
  }, [open, options, value, selectableIndexes]);

  useEffect(() => {
    if (!open) return;
    const highlighted = listRef.current?.querySelector('[data-highlighted="true"]');
    // Guarded: not every environment implements scrollIntoView (jsdom, for one),
    // and keeping an option in view is never worth throwing over.
    highlighted?.scrollIntoView?.({ block: "nearest" });
  }, [open, highlight]);

  const move = (direction: 1 | -1) => {
    const position = selectableIndexes.indexOf(highlight);
    const next =
      selectableIndexes[
        (position + direction + selectableIndexes.length) % selectableIndexes.length
      ];
    if (next !== undefined) setHighlight(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        setHighlight(selectableIndexes[0] ?? 0);
        break;
      case "End":
        e.preventDefault();
        setHighlight(selectableIndexes[selectableIndexes.length - 1] ?? 0);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(highlight);
        break;
      case "Tab":
        close();
        break;
      default:
        // Type-ahead: "m", "mo" … jumps to the first matching label.
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
          const now = Date.now();
          typeAhead.current.term =
            now - typeAhead.current.at > 800 ? e.key : typeAhead.current.term + e.key;
          typeAhead.current.at = now;

          const term = typeAhead.current.term.toLowerCase();
          const match = options.findIndex(
            (o, i) => !o.disabled && selectableIndexes.includes(i) && o.label.toLowerCase().startsWith(term),
          );
          if (match >= 0) setHighlight(match);
        }
    }
  };

  return (
    <span className={cn("relative block", wrapperClassName)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={cn(
          "flex w-full items-center gap-2 rounded-[8px] border bg-raised text-left text-ink",
          "transition-colors disabled:opacity-60 disabled:pointer-events-none",
          size === "sm" ? "h-9 pl-2.5 pr-2 text-[13px]" : "h-10 pl-3 pr-2.5 text-sm",
          open ? "border-signal" : "border-rule-strong hover:border-ink-muted",
          className,
        )}
      >
        {selected?.dot && (
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: selected.dot }}
          />
        )}
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-ink-muted/70")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-ink-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <Popover open={open} onClose={close} anchorRef={triggerRef}>
        <ul
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="max-h-[inherit] overflow-y-auto overscroll-contain py-1"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value || `empty-${index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-highlighted={index === highlight}
                  disabled={option.disabled}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => pick(index)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                    index === highlight ? "bg-sunken text-ink" : "text-ink-soft",
                    option.disabled && "opacity-40",
                  )}
                >
                  {option.dot && (
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: option.dot }}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.note && (
                    <span className="font-mono text-[11px] text-ink-muted">{option.note}</span>
                  )}
                  {isSelected && <Check className="size-4 shrink-0 text-signal" />}
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    </span>
  );
}

/* ------------------------------------------------------------- NumberField */

/** Number input with our own steppers — the native spinners are tiny and grey. */
export function NumberField({
  value,
  onChange,
  min = 0,
  max = 999,
  id,
  suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  id?: string;
  suffix?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className="flex h-10 items-center rounded-[8px] border border-rule-strong bg-raised transition-colors focus-within:border-signal hover:border-ink-muted">
      <button
        type="button"
        aria-label="Decrease"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className="flex h-full w-9 items-center justify-center text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
      >
        <Minus className="size-3.5" />
      </button>

      <span className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value.replace(/\D/g, ""));
            onChange(clamp(Number.isNaN(next) ? min : next));
          }}
          className="w-10 bg-transparent text-center font-mono text-sm text-ink outline-none"
        />
        {suffix && <span className="font-mono text-[11px] text-ink-muted">{suffix}</span>}
      </span>

      <button
        type="button"
        aria-label="Increase"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className="flex h-full w-9 items-center justify-center text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- TimeField */

const QUICK_TIMES = ["07:00", "09:00", "12:00", "14:00", "17:00", "20:00"];

/** Hour and minute columns instead of the browser's clock widget. */
export function TimeField({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText ?? 9);
  const minute = Number(minuteText ?? 0);

  const set = (h: number, m: number) =>
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

  return (
    <span className="relative block">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-[8px] border bg-raised px-3 text-left transition-colors",
          open ? "border-signal" : "border-rule-strong hover:border-ink-muted",
        )}
      >
        <Clock className="size-4 shrink-0 text-ink-muted" />
        <span className="flex-1 font-mono text-sm text-ink">{value}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-3.5 text-ink-muted transition-transform", open && "rotate-180")}
        />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} matchAnchorWidth={false}>
        <div className="w-[min(15rem,calc(100vw-1.5rem))]">
          <div className="flex border-b border-rule">
            <Column
              label="Hour"
              values={Array.from({ length: 24 }, (_, i) => i)}
              active={hour}
              onPick={(h) => set(h, minute)}
            />
            <Column
              label="Minute"
              values={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]}
              active={minute}
              onPick={(m) => set(hour, m)}
            />
          </div>
          <div className="flex flex-wrap gap-1 p-2">
            {QUICK_TIMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onChange(t);
                  setOpen(false);
                }}
                className={cn(
                  "h-7 rounded-full border px-2 font-mono text-[11px] transition-colors",
                  t === value
                    ? "border-signal bg-signal-soft text-signal"
                    : "border-rule-strong text-ink-muted hover:border-ink-muted hover:text-ink",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </Popover>
    </span>
  );
}

function Column({
  label,
  values,
  active,
  onPick,
}: {
  label: string;
  values: number[];
  active: number;
  onPick: (value: number) => void;
}) {
  return (
    <div className="flex-1 border-r border-rule last:border-r-0">
      <p className="border-b border-rule px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </p>
      <ul className="max-h-44 overflow-y-auto overscroll-contain py-1">
        {values.map((v) => (
          <li key={v}>
            <button
              type="button"
              onClick={() => onPick(v)}
              className={cn(
                "w-full px-2 py-1 text-center font-mono text-[13px] transition-colors",
                v === active ? "bg-signal text-paper" : "text-ink-soft hover:bg-sunken",
              )}
            >
              {String(v).padStart(2, "0")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- DateField */

/** Calendar popover; `value` and `onChange` speak "YYYY-MM-DD" or "". */
export function DateField({
  value,
  onChange,
  id,
  disabled,
  placeholder = "No date",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = value ? new Date(`${value}T12:00:00`) : null;
  const [view, setView] = useState(() => selected ?? new Date());

  useEffect(() => {
    if (open) setView(selected ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the popover opens
  }, [open]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const length = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const iso = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (
    <span className="relative block">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-[8px] border bg-raised px-3 text-left transition-colors",
          "disabled:opacity-60 disabled:pointer-events-none",
          open ? "border-signal" : "border-rule-strong hover:border-ink-muted",
        )}
      >
        <span className={cn("flex-1 text-sm", selected ? "text-ink" : "text-ink-muted/70")}>
          {selected
            ? selected.toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: selected.getFullYear() === today.getFullYear() ? undefined : "numeric",
              })
            : placeholder}
        </span>
        <ChevronDown
          aria-hidden
          className={cn("size-3.5 text-ink-muted transition-transform", open && "rotate-180")}
        />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} matchAnchorWidth={false}>
        <div className="w-[min(17rem,calc(100vw-1.5rem))] p-2">
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setView(new Date(year, month - 1, 1))}
              className="flex size-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="font-display text-lg leading-none text-ink">
              {view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setView(new Date(year, month + 1, 1))}
              className="flex size-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAY_INITIALS.map((letter, i) => (
              <span
                key={i}
                className="py-1 text-center font-mono text-[10px] uppercase text-ink-muted"
              >
                {letter}
              </span>
            ))}
            {Array.from({ length: firstWeekday }, (_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {Array.from({ length }, (_, i) => i + 1).map((day) => {
              const isSelected = value === iso(day);
              const isToday =
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear();
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    onChange(iso(day));
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-[6px] font-mono text-[13px] transition-colors",
                    isSelected
                      ? "bg-signal text-paper"
                      : isToday
                        ? "border border-signal text-signal"
                        : "text-ink-soft hover:bg-sunken",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex gap-1 border-t border-rule pt-2">
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                onChange(
                  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
                    d.getDate(),
                  ).padStart(2, "0")}`,
                );
                setOpen(false);
              }}
              className="h-7 rounded-full border border-rule-strong px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="h-7 rounded-full px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted transition-colors hover:text-signal"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </Popover>
    </span>
  );
}
