import type { ReactNode } from "react";

export function Topbar({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-center justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[9px] font-extrabold uppercase tracking-wider text-brand-600">{eyebrow}</p>
        )}
        <h1 className="text-[27px] font-normal text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}
