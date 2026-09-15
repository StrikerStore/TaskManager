"use client";

/**
 * Split layout for the signed-out pages: an editorial panel on the left at
 * desktop widths, collapsing to a compact header on phones.
 */
export function AuthFrame({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="relative flex flex-col justify-between overflow-hidden border-b border-rule bg-sunken px-5 py-6 lg:w-[42%] lg:border-b-0 lg:border-r lg:px-10 lg:py-10">
        {/* Oversized rule-work: the one piece of pure decoration in the app. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full opacity-[0.07]"
          style={{
            background:
              "repeating-conic-gradient(from 0deg, var(--ink) 0deg 4deg, transparent 4deg 8deg)",
          }}
        />
        <p className="font-display text-3xl leading-none tracking-tight lg:text-4xl">
          Task<span className="italic text-signal">board</span>
        </p>

        <div className="hidden lg:block">
          <p className="max-w-sm font-display text-4xl leading-[1.05] tracking-tight text-ink">
            One shared list.
            <br />
            <span className="italic text-signal">Everything</span> the team owes each other.
          </p>
          <ul className="mt-8 space-y-2 font-mono text-[12px] uppercase tracking-[0.12em] text-ink-muted">
            <li>— Add a task in one line</li>
            <li>— Filter by project, person, due date</li>
            <li>— Keep private tasks to yourself</li>
          </ul>
        </div>

        <p className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted lg:block">
          Built for small teams
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-8 lg:px-10">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl leading-tight tracking-tight lg:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 mb-6 text-sm text-ink-muted">{subtitle}</p>}
          {children}
          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
