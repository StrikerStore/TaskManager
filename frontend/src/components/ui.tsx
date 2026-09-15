"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn, initials } from "@/lib/format";

export { DateField, NumberField, Select, TimeField, type SelectOption } from "@/components/fields";

/* ------------------------------------------------------------------ Button */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "signal";
  size?: "sm" | "md";
  ref?: React.Ref<HTMLButtonElement>;
};

export function Button({ variant = "outline", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium",
        "transition-[background-color,border-color,color,transform] duration-150",
        "active:translate-y-px disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "bg-ink text-paper shadow-[0_1px_0_0_var(--rule-strong)] hover:bg-ink-soft",
        variant === "signal" && "bg-signal text-paper hover:brightness-110",
        variant === "outline" &&
          "border border-rule-strong bg-raised text-ink hover:border-ink-muted hover:bg-sunken",
        variant === "ghost" && "text-ink-muted hover:bg-sunken hover:text-ink",
        variant === "danger" && "border border-urgent/40 text-urgent hover:bg-urgent/10",
        className,
      )}
    />
  );
}

/* ------------------------------------------------------------------- Input */

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "tb-field h-10 w-full rounded-[8px] border border-rule-strong bg-raised px-3 text-sm text-ink",
        "transition-colors placeholder:text-ink-muted/70 hover:border-ink-muted focus:border-signal",
        className,
      )}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "tb-field w-full rounded-[8px] border border-rule-strong bg-raised px-3 py-2 text-sm text-ink",
        "transition-colors placeholder:text-ink-muted/70 hover:border-ink-muted focus:border-signal",
        "resize-y min-h-24",
        className,
      )}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={cn(
        "block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted mb-1.5",
        className,
      )}
    />
  );
}

/* -------------------------------------------------------------------- Chip */

type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  dot?: string | null;
};

export function Chip({ active, dot, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[13px] transition-colors",
        active
          ? "border-signal bg-signal-soft text-signal font-medium"
          : "border-rule-strong bg-raised text-ink-soft hover:border-ink-muted",
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: dot }}
        />
      )}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Avatar */

export function Avatar({
  name,
  image,
  size = 24,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from arbitrary hosts
    return (
      <img
        src={image}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      title={name}
      className="inline-flex items-center justify-center rounded-full bg-sunken font-mono text-ink-soft border border-rule"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------- Sheet */

/**
 * Side panel on desktop, bottom drawer on mobile. Closes on Escape or backdrop
 * click and traps initial focus.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end">
      <div
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          "sheet-in relative flex w-full flex-col bg-paper shadow-[var(--shadow-sheet)]",
          "max-h-[88vh] rounded-t-2xl sm:max-h-none sm:h-full sm:w-[min(460px,100vw)] sm:rounded-none sm:border-l sm:border-rule-strong",
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 sm:px-5">
          <h2 className="font-display text-xl leading-tight text-ink">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer && (
          <footer className="safe-bottom border-t border-rule px-4 py-3 sm:px-5">{footer}</footer>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Empty state */

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="font-display text-2xl text-ink">{title}</p>
      {hint && <p className="max-w-sm text-sm text-ink-muted">{hint}</p>}
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 border-b border-rule px-4 py-3">
      <div className="size-[18px] shrink-0 rounded-[5px] bg-sunken" />
      <div className="h-3 flex-1 rounded bg-sunken" />
      <div className="h-3 w-16 rounded bg-sunken" />
    </div>
  );
}
