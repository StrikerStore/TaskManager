"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/format";

/**
 * Six boxes for a numeric code. The value is a plain string of digits with no
 * gaps; typing a digit moves to the next box, Backspace moves back, and pasting
 * "482913" fills every box at once.
 */
export function PinInput({
  value,
  onChange,
  onComplete,
  length = 6,
  masked = false,
  autoFocus = false,
  disabled = false,
  id,
  ariaLabel = "Passcode",
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  masked?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  /**
   * The digits as of the latest keystroke, ahead of React state. Focus moves
   * to the next box inside the same event that typed the digit — before React
   * re-renders — so reading the `value` prop there would see the old, shorter
   * value, conclude a box was skipped, and send focus straight back.
   */
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const focusBox = (index: number) => {
    const clamped = Math.max(0, Math.min(length - 1, index));
    boxes.current[clamped]?.focus();
    boxes.current[clamped]?.select();
  };

  const commit = (next: string) => {
    const digits = next.replace(/\D/g, "").slice(0, length);
    latest.current = digits;
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
    return digits;
  };

  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-1.5 sm:gap-2">
      {Array.from({ length }, (_, index) => {
        const char = value[index] ?? "";
        const isNext = index === value.length;

        return (
          <input
            key={index}
            ref={(el) => {
              boxes.current[index] = el;
            }}
            id={index === 0 ? id : undefined}
            type={masked ? "password" : "text"}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && index === 0}
            disabled={disabled}
            maxLength={length}
            value={char}
            aria-label={`${ariaLabel} digit ${index + 1}`}
            onFocus={(e) => {
              const filled = latest.current.length;
              // Never leave a gap: focusing past the end jumps back to the next empty box.
              if (index > filled) focusBox(filled);
              else e.currentTarget.select();
            }}
            onChange={(e) => {
              const current = latest.current;
              const existing = current[index] ?? "";
              const typed = e.target.value.replace(/\D/g, "");
              if (!typed) return;

              // One new digit — including typing over a filled box whose old
              // digit wasn't selected, which leaves "old + new" in the input.
              const single =
                typed.length === 1
                  ? typed
                  : typed.length === 2 && existing && typed.startsWith(existing)
                    ? typed[1]!
                    : typed.length === 2 && existing && typed.endsWith(existing)
                      ? typed[0]!
                      : null;

              if (single === null) {
                // A paste or an autofilled code arrives as several digits at once.
                const digits = commit(current.slice(0, index) + typed);
                focusBox(digits.length);
                return;
              }

              const digits = commit(current.slice(0, index) + single + current.slice(index + 1));
              focusBox(Math.min(index + 1, digits.length));
            }}
            onKeyDown={(e) => {
              const current = latest.current;
              if (e.key === "Backspace") {
                e.preventDefault();
                if (current[index]) {
                  commit(current.slice(0, index) + current.slice(index + 1));
                  focusBox(index);
                } else if (index > 0) {
                  commit(current.slice(0, index - 1) + current.slice(index));
                  focusBox(index - 1);
                }
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                focusBox(index - 1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                focusBox(Math.min(index + 1, current.length));
              }
            }}
            className={cn(
              "tb-field h-12 w-full min-w-0 rounded-[8px] border bg-raised text-center font-mono text-xl text-ink",
              "transition-colors disabled:opacity-60",
              char ? "border-ink-muted" : isNext ? "border-signal" : "border-rule-strong",
              "focus:border-signal",
            )}
          />
        );
      })}
    </div>
  );
}
