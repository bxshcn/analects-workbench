export function LoadingSkeleton({ label = "数据加载中" }: { label?: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center p-6"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="w-full max-w-md space-y-4">
        <div className="mx-auto h-40 w-40 animate-pulse rounded-full border border-paper-line bg-paper-deep/70" />
        <div className="mx-auto h-3 w-2/3 animate-pulse rounded-full bg-paper-line" />
        <div className="mx-auto h-3 w-1/2 animate-pulse rounded-full bg-paper-line/70" />
        <p className="pt-2 text-center text-xs tracking-[0.2em] text-ink-faint">{label}</p>
      </div>
    </div>
  );
}

export function InlineSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-3 animate-pulse rounded-full bg-paper-line/80"
          style={{ width: `${92 - index * 13}%` }}
        />
      ))}
    </div>
  );
}
