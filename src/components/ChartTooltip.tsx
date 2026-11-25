import type { ReactNode } from "react";

export function ChartTooltip({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <div
      className="pointer-events-none fixed z-50 max-w-[18rem] rounded-md border border-ink/15 bg-paper/95 px-3 py-2 text-[11px] leading-relaxed text-ink shadow-float backdrop-blur-sm"
      style={{ left: x + 14, top: y + 14 }}
      role="tooltip"
    >
      {children}
    </div>
  );
}

export function TooltipLine({
  label,
  value,
  color,
}: {
  label: string;
  value: ReactNode;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-ink-faint">
        {color ? (
          <span className="stat-dot" style={{ backgroundColor: color }} aria-hidden />
        ) : null}
        {label}
      </span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
