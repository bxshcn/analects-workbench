import { BookOpen, Loader2 } from "lucide-react";
import { NODE_TYPE_COLOR } from "../lib/constants";
import type { CoreNode } from "../types/data";

export function Capsule({
  node,
  weight,
  hasVerses,
  core,
  active,
  versesReady,
  onNavigate,
  onQuery,
}: {
  node: CoreNode;
  weight: number;
  hasVerses: boolean;
  core: boolean;
  active: boolean;
  versesReady: boolean;
  onNavigate: () => void;
  onQuery: () => void;
}) {
  const borderClass = core
    ? "border-ink/20 bg-white"
    : "border-dashed border-ink/30 bg-paper-deep/50";

  if (!hasVerses) {
    return (
      <button
        type="button"
        onClick={onNavigate}
        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs text-ink-soft transition-colors hover:border-vermilion/50 hover:text-vermilion max-sm:min-h-[44px] ${borderClass}`}
        title={node.canonical_name}
      >
        <span
          className="stat-dot"
          style={{ backgroundColor: NODE_TYPE_COLOR[node.type] }}
          aria-hidden
        />
        <span>{node.canonical_name}</span>
      </button>
    );
  }

  return (
    <span
      className={`inline-flex min-h-[36px] items-stretch overflow-hidden rounded-full border text-xs transition-colors max-sm:min-h-[44px] ${
        active ? "border-vermilion/60 ring-1 ring-vermilion/30" : borderClass
      }`}
    >
      <button
        type="button"
        onClick={onNavigate}
        className="flex items-center gap-1.5 px-3 text-ink-soft transition-colors hover:bg-ink/[0.04] hover:text-vermilion"
        title={`${node.canonical_name} · 权重 ${weight}`}
      >
        <span
          className="stat-dot"
          style={{ backgroundColor: NODE_TYPE_COLOR[node.type] }}
          aria-hidden
        />
        <span className="max-w-[10rem] truncate">{node.canonical_name}</span>
        <span className="text-ink-faint/50" aria-hidden>
          ·
        </span>
        <span className="tabular-nums text-ink-faint">{weight}</span>
      </button>
      <span className="w-px shrink-0 bg-ink/10" aria-hidden />
      <button
        type="button"
        onClick={onQuery}
        disabled={!versesReady}
        aria-label={`查原文：${node.canonical_name}`}
        title={versesReady ? "查原文" : "章句数据加载中"}
        className={`grid min-w-[36px] place-items-center transition-colors max-sm:min-w-[44px] ${
          active
            ? "bg-vermilion/10 text-vermilion"
            : "text-ink-faint hover:bg-ink/[0.04] hover:text-vermilion"
        } disabled:cursor-wait disabled:opacity-50`}
      >
        {versesReady ? (
          <BookOpen size={14} strokeWidth={1.5} aria-hidden />
        ) : (
          <Loader2 size={14} strokeWidth={1.5} className="animate-spin" aria-hidden />
        )}
      </button>
    </span>
  );
}

export function VerseCapsule({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-[36px] items-center rounded-full border px-3 text-xs transition-colors max-sm:min-h-[44px] ${
        active
          ? "border-vermilion/60 bg-vermilion/[0.08] text-vermilion-deep"
          : "border-ink/20 bg-white text-ink-soft hover:border-vermilion/40 hover:text-vermilion"
      }`}
    >
      {label}
    </button>
  );
}
