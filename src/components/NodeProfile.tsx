import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText, Info } from "lucide-react";
import { useAnalectsStore } from "../store/analectsStore";
import { NODE_TYPE_COLOR, NODE_TYPE_LABEL } from "../lib/constants";
import { InlineSkeleton } from "./Skeleton";
import type { CoreNode, DetailNode } from "../types/data";

export function useAnchorNode(): {
  node: CoreNode | DetailNode | null;
  detail: DetailNode | null;
  detailsLoading: boolean;
  detailsError: boolean;
  isCore: boolean;
} {
  const anchorId = useAnalectsStore((state) => state.anchorId);
  const core = useAnalectsStore((state) => state.data.core.data);
  const detailsState = useAnalectsStore((state) => state.data.details);
  return useMemo(() => {
    const coreNode = core?.nodes.find((node) => node.id === anchorId) ?? null;
    const detail = anchorId
      ? (detailsState.data?.[anchorId] ?? null)
      : null;
    const node = coreNode ?? detail;
    const isCore = (core?.edges ?? []).some(
      (edge) => edge.source_id === anchorId || edge.target_id === anchorId,
    );
    return {
      node,
      detail,
      detailsLoading:
        detailsState.status === "loading" || detailsState.status === "idle",
      detailsError: detailsState.status === "error",
      isCore,
    };
  }, [anchorId, core, detailsState]);
}

export function NodeProfile() {
  const { node, detail, detailsLoading, detailsError, isCore } = useAnchorNode();
  const [expanded, setExpanded] = useState(false);
  const anchorId = useAnalectsStore((state) => state.anchorId);

  useEffect(() => {
    setExpanded(false);
  }, [anchorId]);

  if (!node) {
    return null;
  }

  const gloss = detail?.gloss;
  const commentary = detail?.commentary;

  return (
    <section
      className="rounded-lg border border-ink/10 bg-white/80 p-5 shadow-paper sm:p-6"
      aria-label="当前节点档案"
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h2 className="text-2xl tracking-[0.08em] text-ink">{node.canonical_name}</h2>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]"
          style={{
            borderColor: `${NODE_TYPE_COLOR[node.type]}55`,
            color: NODE_TYPE_COLOR[node.type],
            backgroundColor: `${NODE_TYPE_COLOR[node.type]}0D`,
          }}
        >
          <span
            className="stat-dot"
            style={{ backgroundColor: NODE_TYPE_COLOR[node.type] }}
            aria-hidden
          />
          {NODE_TYPE_LABEL[node.type]}
        </span>
        <span className="text-[10px] tracking-[0.16em] text-ink-faint">
          {isCore ? "核心节点" : "扩展节点"}
        </span>
        {node.source_refs.length > 0 ? (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-faint">
            <FileText size={13} strokeWidth={1.5} aria-hidden />
            出处 {node.source_refs.length}
          </span>
        ) : null}
      </div>

      {node.alias && node.alias.length > 0 ? (
        <p className="mt-2 text-xs text-ink-faint">
          别名：{node.alias.join("、")}
        </p>
      ) : null}

      <div className="mt-4 border-t border-ink/10 pt-4">
        <p className="mb-2 text-[10px] tracking-[0.22em] text-ink-faint">概要释义</p>
        {detailsLoading && !detail ? (
          <InlineSkeleton lines={3} />
        ) : detailsError && !detail ? (
          <p className="text-xs text-ink-faint">
            详情数据加载失败，请使用首屏底部错误条重试。
          </p>
        ) : (
          <p className="whitespace-pre-line text-[13.5px] leading-[1.9] text-ink-soft">
            {gloss || "暂无概要释义"}
          </p>
        )}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls="node-commentary"
          disabled={detailsLoading && !detail}
          className="flex min-h-[40px] items-center gap-2 text-xs text-ink-soft transition-colors hover:text-vermilion disabled:cursor-wait disabled:opacity-60"
        >
          <Info size={14} strokeWidth={1.5} aria-hidden />
          {expanded ? "收起扩展释义" : "展开扩展释义"}
          <ChevronDown
            size={15}
            strokeWidth={1.5}
            aria-hidden
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        <div
          id="node-commentary"
          className={`grid transition-[grid-template-rows] duration-300 ease-paper ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="mt-2 rounded-md border border-ink/10 bg-paper-deep/30 p-4">
              {detailsLoading && !detail ? (
                <InlineSkeleton lines={4} />
              ) : (
                <p className="whitespace-pre-line text-[13px] leading-[1.95] text-ink-soft">
                  {commentary || "暂无扩展释义"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
