import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Loader2, RefreshCw, X } from "lucide-react";
import { Capsule } from "./Capsule";
import { ExpandableGroup, GroupHeader, SourceVerseList } from "./IndexGroups";
import { useAnchorNode } from "./NodeProfile";
import { useAnalectsStore } from "../store/analectsStore";
import {
  buildRelationGroups,
  computeCoreNodeIds,
  sortVerses,
  type IndexEdgeItem,
} from "../lib/graph";
import { prefersReducedMotion } from "../hooks/useElementSize";
import type { CoreNode } from "../types/data";

interface ScrollHintState {
  direction: "up" | "down";
}

export function RelationIndex() {
  const anchorId = useAnalectsStore((state) => state.anchorId);
  const core = useAnalectsStore((state) => state.data.core.data);
  const details = useAnalectsStore((state) => state.data.details.data);
  const coState = useAnalectsStore((state) => state.data.coEdges);
  const detailsStatus = useAnalectsStore((state) => state.data.details.status);
  const verseState = useAnalectsStore((state) => state.data.verses);
  const query = useAnalectsStore((state) => state.query);
  const readingCode = useAnalectsStore((state) => state.readingCode);
  const navigate = useAnalectsStore((state) => state.anchorNode);
  const setQuery = useAnalectsStore((state) => state.setQuery);
  const setReadingCode = useAnalectsStore((state) => state.setReadingCode);
  const retryBackground = useAnalectsStore((state) => state.retryBackground);
  const { node, detailsLoading } = useAnchorNode();
  const [hint, setHint] = useState<ScrollHintState | null>(null);
  const hintTimer = useRef<number | null>(null);
  const detectTimer = useRef<number | null>(null);

  const nodeById = useMemo(() => {
    const map = new Map<string, CoreNode>();
    for (const item of core?.nodes ?? []) map.set(item.id, item);
    for (const item of Object.values(details ?? {})) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return map;
  }, [core, details]);

  const coreIds = useMemo(() => computeCoreNodeIds(core?.edges ?? []), [core]);

  const groups = useMemo(() => {
    if (!anchorId) return [];
    return buildRelationGroups({
      anchorId,
      nodeById,
      strongEdges: core?.edges ?? [],
      coEdges: coState.data?.edges ?? [],
    });
  }, [anchorId, nodeById, core, coState.data]);

  const anchorName =
    node?.canonical_name ?? nodeById.get(anchorId ?? "")?.canonical_name ?? "当前节点";

  const sourceVerses = useMemo(() => {
    const codes = new Set(node?.source_refs ?? []);
    if (codes.size === 0) return [];
    return sortVerses(
      (verseState.data ?? []).filter((verse) => codes.has(verse.code)),
    );
  }, [node, verseState.data]);

  const handleNavigate = (item: IndexEdgeItem) => {
    navigate(item.other.id, { origin: "index" });
  };

  const handleQuery = (item: IndexEdgeItem) => {
    const direction =
      item.direction === "out" || item.direction === "in" ? item.direction : null;
    setQuery({
      anchorId: anchorId as string,
      targetId: item.other.id,
      relation: item.relation,
      direction,
      verseCodes: item.edge.share_refs,
      edgeKey: `${item.edge.source_id}|${item.edge.relation}|${item.edge.target_id}`,
      origin: "capsule",
    });
    scheduleScrollHint();
  };

  const clearHintTimer = () => {
    if (hintTimer.current !== null) {
      window.clearTimeout(hintTimer.current);
      hintTimer.current = null;
    }
    if (detectTimer.current !== null) {
      window.clearTimeout(detectTimer.current);
      detectTimer.current = null;
    }
  };

  const scheduleScrollHint = () => {
    clearHintTimer();
    setHint(null);
    detectTimer.current = window.setTimeout(() => {
      detectTimer.current = null;
      const target = document.getElementById("verse-research");
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const above = rect.bottom <= 120;
      const below = rect.top >= window.innerHeight - 120;
      if (!above && !below) return;
      setHint({ direction: above ? "up" : "down" });
      hintTimer.current = window.setTimeout(() => setHint(null), 3200);
    }, 90);
  };

  const scrollToResearch = () => {
    const target = document.getElementById("verse-research");
    if (target) {
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    }
    clearHintTimer();
    setHint(null);
  };

  useEffect(() => {
    clearHintTimer();
    setHint(null);
    return clearHintTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorId]);

  const isActive = (item: IndexEdgeItem) =>
    readingCode === null &&
    query !== null &&
    query.anchorId === anchorId &&
    query.targetId === item.other.id &&
    query.relation === item.relation &&
    (item.direction === "none"
      ? query.direction === null
      : query.direction === item.direction);

  const versesReady =
    verseState.status === "ready" && detailsStatus === "ready";
  const relationGroupId = (key: string) =>
    `relation-group-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const sourceGroupId = "relation-group-source";
  const hasCoGroup = groups.some(
    (group) => group.key === "none:CO_OCCURS_WITH",
  );
  const quickLinks = [
    ...groups.map((group) => ({
      key: group.key,
      title: group.title,
      count: group.items.length,
      id: relationGroupId(group.key),
    })),
    ...(coState.status !== "ready" && !hasCoGroup
      ? [
          {
            key: "none:CO_OCCURS_WITH",
            title: "共现",
            count: 0,
            id: relationGroupId("none:CO_OCCURS_WITH"),
          },
        ]
      : []),
    {
      key: "source",
      title: "典籍出处",
      count: node?.source_refs.length ?? 0,
      id: sourceGroupId,
    },
  ];

  const jumpToGroup = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  };

  const renderCapsule = (item: IndexEdgeItem) => (
    <Capsule
      key={item.key}
      node={item.other}
      weight={item.edge.weight}
      hasVerses={item.edge.share_refs.length > 0}
      core={coreIds.has(item.other.id)}
      active={isActive(item)}
      versesReady={versesReady}
      onNavigate={() => handleNavigate(item)}
      onQuery={() => handleQuery(item)}
    />
  );

  return (
    <>
      <section
      className="rounded-lg border border-ink/10 bg-white/70 p-4 shadow-paper sm:p-5"
      aria-label="关系索引"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-3">
        <h3 className="text-sm tracking-[0.18em] text-ink">关系索引</h3>
        <p className="text-[10px] text-ink-faint">
          {anchorName} · {groups.reduce((sum, group) => sum + group.items.length, 0)} 条
        </p>
      </div>

      <nav
        className="sticky top-0 z-20 -mx-4 mt-3 border-b border-ink/10 bg-paper/95 px-4 py-2 backdrop-blur-sm sm:-mx-5 sm:px-5"
        aria-label="关系快捷跳转"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[9px] tracking-[0.18em] text-ink-faint">
            跳转
          </span>
          {quickLinks.map((link) => (
            <button
              key={link.key}
              type="button"
              onClick={() => jumpToGroup(link.id)}
              title={`${link.title}，${link.count} 条`}
              className="rounded-full border border-ink/15 bg-white/80 px-2 py-0.5 text-[10px] leading-4 text-ink-soft transition-colors hover:border-vermilion/40 hover:text-vermilion"
            >
              {link.title}
            </button>
          ))}
        </div>
      </nav>

      <div className="mt-4 space-y-5">
        {groups.map((group) => (
          <ExpandableGroup
            key={group.key}
            id={relationGroupId(group.key)}
            title={group.title}
            items={group.items}
            render={renderCapsule}
          />
        ))}

        {coState.status !== "ready" ? (
          <section
            id={relationGroupId("none:CO_OCCURS_WITH")}
            aria-label="共现"
            className="scroll-mt-20"
          >
            <GroupHeader title="共现" count={0} muted />
            {coState.status === "error" ? (
              <div className="mt-2 flex items-center justify-between rounded border border-vermilion/20 bg-vermilion/[0.04] px-3 py-2 text-[11px] text-ink-soft">
                <span>共现数据加载失败</span>
                <button
                  type="button"
                  onClick={() => void retryBackground()}
                  className="flex items-center gap-1 text-vermilion hover:underline"
                >
                  <RefreshCw size={12} strokeWidth={1.5} aria-hidden />
                  重试
                </button>
              </div>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-faint">
                <Loader2
                  size={12}
                  strokeWidth={1.5}
                  className="animate-spin"
                  aria-hidden
                />
                数据加载中
              </p>
            )}
          </section>
        ) : null}

        <section
          id={sourceGroupId}
          aria-label="典籍出处"
          className="scroll-mt-20"
        >
          <GroupHeader
            title="典籍出处"
            count={node?.source_refs.length ?? 0}
            muted={(node?.source_refs.length ?? 0) === 0}
          />
          {detailsLoading && !node ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-faint">
              <Loader2
                size={12}
                strokeWidth={1.5}
                className="animate-spin"
                aria-hidden
              />
              数据加载中
            </p>
          ) : verseState.status === "error" ? (
            <div className="mt-2 flex items-center justify-between rounded border border-vermilion/20 bg-vermilion/[0.04] px-2.5 py-1.5 text-[11px] text-ink-soft">
              <span>章句数据加载失败</span>
              <button
                type="button"
                onClick={() => void retryBackground()}
                className="flex items-center gap-1 text-vermilion hover:underline"
              >
                <RefreshCw size={11} strokeWidth={1.5} aria-hidden />
                重试
              </button>
            </div>
          ) : verseState.status !== "ready" ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-faint">
              <Loader2
                size={12}
                strokeWidth={1.5}
                className="animate-spin"
                aria-hidden
              />
              章句数据加载中
            </p>
          ) : sourceVerses.length === 0 ? (
            <p className="mt-2 text-[11px] text-ink-faint">暂无出处记录</p>
          ) : (
            <SourceVerseList
              verses={sourceVerses}
              readingCode={readingCode}
              onRead={(code) => setReadingCode(code)}
            />
          )}
        </section>
      </div>

      <div className="mt-5 border-t border-ink/10 pt-3 text-[10px] leading-relaxed text-ink-faint">
        <p className="flex items-center gap-1.5">
          <BookOpen size={12} strokeWidth={1.5} aria-hidden />
          点击查原文图标，左侧下部展示双方关联章句。
        </p>
        <p className="mt-1">实线为核心节点，虚线为扩展节点。权重为关联章句数。</p>
      </div>
    </section>

      {hint ? (
        <div
          className="hint-blink fixed inset-x-0 bottom-0 z-50 border-t border-vermilion/40 bg-vermilion px-4 py-2.5 text-paper shadow-[0_-6px_24px_rgba(43,43,43,0.18)]"
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2">
            <p className="text-xs">
              章句已更新，但内容在当前窗口
              {hint.direction === "up" ? "上方" : "下方"}。
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={scrollToResearch}
                className="rounded-full border border-paper/50 px-3 py-1 text-[11px] transition-colors hover:bg-paper/10"
              >
                查看章句
              </button>
              <button
                type="button"
                onClick={() => {
                  clearHintTimer();
                  setHint(null);
                }}
                aria-label="关闭章句提示"
                className="grid h-6 w-6 place-items-center rounded-full text-paper/80 transition-colors hover:bg-paper/10 hover:text-paper"
              >
                <X size={14} strokeWidth={1.5} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


