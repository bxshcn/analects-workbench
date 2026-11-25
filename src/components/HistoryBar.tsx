import { useEffect, useMemo, useRef } from "react";
import { Eraser } from "lucide-react";
import { useAnalectsStore } from "../store/analectsStore";
import { NODE_TYPE_COLOR, NODE_TYPE_LABEL } from "../lib/constants";
import { computeCoreNodeIds } from "../lib/graph";
import type { CoreNode } from "../types/data";

export function HistoryBar() {
  const history = useAnalectsStore((state) => state.history);
  const historyIndex = useAnalectsStore((state) => state.historyIndex);
  const core = useAnalectsStore((state) => state.data.core.data);
  const details = useAnalectsStore((state) => state.data.details.data);
  const selectHistory = useAnalectsStore((state) => state.selectHistory);
  const clearHistory = useAnalectsStore((state) => state.clearHistory);
  const listRef = useRef<HTMLDivElement | null>(null);

  const nodeById = useMemo(() => {
    const map = new Map<string, CoreNode>();
    for (const node of core?.nodes ?? []) map.set(node.id, node);
    for (const node of Object.values(details ?? {})) {
      if (!map.has(node.id)) map.set(node.id, node);
    }
    return map;
  }, [core, details]);

  const coreIds = useMemo(
    () => computeCoreNodeIds(core?.edges ?? []),
    [core],
  );

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(
      `[data-history-index="${historyIndex}"]`,
    );
    if (active) {
      active.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }, [historyIndex, history.length]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (container.scrollWidth <= container.clientWidth) return;
      event.preventDefault();
      container.scrollLeft += event.deltaY;
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [history.length]);

  return (
    <div className="sticky top-0 z-30 border-b border-ink/10 bg-paper/95 shadow-[0_1px_0_rgba(43,43,43,0.04)] backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-2 px-3 py-2.5 sm:px-6 lg:px-10">
        <div className="hidden shrink-0 items-center gap-2 pr-2 text-[10px] tracking-[0.2em] text-ink-faint sm:flex">
          <span className="h-3 w-px bg-ink/20" aria-hidden />
          历史
        </div>
        <div className="fade-mask-x min-w-0 flex-1 overflow-hidden">
          {history.length === 0 ? (
            <p className="px-2 py-2 text-xs text-ink-faint">尚无历史节点</p>
          ) : (
            <div
              ref={listRef}
              className="no-scrollbar flex items-center gap-2 overflow-x-auto px-1 py-1"
              role="group"
              aria-label="历史节点"
            >
              {history.map((id, index) => {
                const node = nodeById.get(id);
                const isCore = coreIds.has(id);
                const active = index === historyIndex;
                return (
                  <button
                    key={`${id}-${index}`}
                    data-history-index={index}
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => selectHistory(index)}
                    title={node?.canonical_name ?? id}
                    className={`flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors max-sm:min-h-[44px] ${
                      isCore
                        ? "border-ink/25 bg-white text-ink"
                        : "border-dashed border-ink/30 bg-paper-deep/70 text-ink-soft"
                    } ${
                      active
                        ? "ring-1 ring-vermilion/60 ring-offset-1 ring-offset-paper"
                        : "hover:border-ink/40"
                    }`}
                  >
                    <span
                      className="stat-dot"
                      style={{
                        backgroundColor: node
                          ? NODE_TYPE_COLOR[node.type]
                          : "#8C847A",
                      }}
                      aria-hidden
                    />
                    <span>{node?.canonical_name ?? id}</span>
                    <span className="text-[9px] text-ink-faint">
                      {node ? NODE_TYPE_LABEL[node.type] : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {history.length > 0 ? (
          <button
            type="button"
            onClick={clearHistory}
            aria-label="清空历史，仅保留当前节点"
            title="清空历史"
            className="grid min-h-[36px] min-w-[36px] shrink-0 place-items-center rounded-full border border-ink/15 bg-white text-ink-soft transition-colors hover:border-vermilion/50 hover:text-vermilion max-sm:min-h-[44px] max-sm:min-w-[44px]"
          >
            <Eraser size={16} strokeWidth={1.5} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
