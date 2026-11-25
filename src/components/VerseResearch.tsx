import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronsUp, Loader2, RefreshCw } from "lucide-react";
import { VerseCard } from "./VerseCard";
import { useAnalectsStore } from "../store/analectsStore";
import { formatTriple, sortVerses } from "../lib/graph";
import { buildHighlightKeywords } from "../lib/highlight";
import type { CoreNode } from "../types/data";

export function VerseResearch() {
  const anchorId = useAnalectsStore((state) => state.anchorId);
  const core = useAnalectsStore((state) => state.data.core.data);
  const details = useAnalectsStore((state) => state.data.details.data);
  const verseState = useAnalectsStore((state) => state.data.verses);
  const query = useAnalectsStore((state) => state.query);
  const readingCode = useAnalectsStore((state) => state.readingCode);
  const setReadingCode = useAnalectsStore((state) => state.setReadingCode);
  const retryBackground = useAnalectsStore((state) => state.retryBackground);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const nodeById = useMemo(() => {
    const map = new Map<string, CoreNode>();
    for (const item of core?.nodes ?? []) map.set(item.id, item);
    for (const item of Object.values(details ?? {})) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return map;
  }, [core, details]);

  const verseByCode = useMemo(
    () => new Map((verseState.data ?? []).map((verse) => [verse.code, verse])),
    [verseState.data],
  );

  useEffect(() => {
    setExpanded(new Set());
  }, [query?.edgeKey, query?.direction, readingCode]);

  const anchor = anchorId ? nodeById.get(anchorId) ?? null : null;
  const target = query ? nodeById.get(query.targetId) ?? null : null;
  const readingVerse = readingCode ? verseByCode.get(readingCode) ?? null : null;

  const queryVerses = useMemo(() => {
    if (!query || readingCode) return [];
    const verses = query.verseCodes
      .map((code) => verseByCode.get(code))
      .filter((verse): verse is NonNullable<typeof verse> => Boolean(verse));
    return sortVerses(verses);
  }, [query, readingCode, verseByCode]);

  const activeVerses = readingCode ? (readingVerse ? [readingVerse] : []) : queryVerses;
  const expandedCount = activeVerses.filter((verse) => expanded.has(verse.code)).length;

  const toggleVerse = (code: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const headerTriple =
    query && anchor && target
      ? formatTriple(
          anchor.canonical_name,
          target.canonical_name,
          query.relation,
          query.direction,
        )
      : null;

  if (!query && !readingCode) {
    return (
      <section
        className="grid min-h-[24vh] place-items-center rounded-lg border border-dashed border-ink/15 bg-white/40 px-6 py-12 text-center"
        aria-label="关系章句考据区"
      >
        <div className="max-w-md">
          <BookOpen
            size={22}
            strokeWidth={1.5}
            className="mx-auto mb-3 text-ink-faint"
            aria-hidden
          />
          <p className="text-[13px] leading-[1.9] text-ink-soft">
            点击右侧关系索引栏中的查原文图标，在此调阅双方相关的《论语》章句。
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-lg border border-ink/10 bg-white/60 shadow-paper"
      aria-label="关系章句考据区"
    >
      <div className="sticky top-0 z-20 rounded-t-lg border-b border-ink/10 bg-paper px-4 py-3 shadow-[0_4px_12px_rgba(43,43,43,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            {readingCode ? (
              <>
                <p className="text-[10px] tracking-[0.2em] text-ink-faint">典籍出处</p>
                <p className="mt-0.5 truncate text-sm text-ink">
                  {readingVerse
                    ? `[${readingVerse.chapter_title}·${readingVerse.code}]`
                    : `[${readingCode}]`}
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] tracking-[0.2em] text-ink-faint">关系语境</p>
                <p className="mt-0.5 truncate text-sm text-ink">{headerTriple}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-ink-faint">
              匹配章句 {readingCode ? activeVerses.length : query?.verseCodes.length ?? 0}
            </span>
            {query ? (
              <button
                type="button"
                onClick={() => setExpanded(new Set())}
                disabled={expandedCount === 0}
                className={`flex min-h-[32px] items-center gap-1 rounded-full border px-2.5 text-[11px] transition-colors max-sm:min-h-[44px] ${
                  expandedCount > 0
                    ? "border-vermilion/40 bg-vermilion/[0.07] text-vermilion hover:bg-vermilion/[0.12]"
                    : "border-ink/10 text-ink-faint/60"
                }`}
              >
                <ChevronsUp size={13} strokeWidth={1.5} aria-hidden />
                折叠全部注疏
              </button>
            ) : null}
            {readingCode && query ? (
              <button
                type="button"
                onClick={() => setReadingCode(null)}
                className="min-h-[32px] text-[11px] text-ink-faint hover:text-vermilion max-sm:min-h-[44px]"
              >
                返回关系语境
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-4 pb-5 pt-4">
        {verseState.status === "error" ? (
          <div className="flex items-center justify-between rounded border border-vermilion/20 bg-vermilion/[0.04] px-3 py-2 text-xs text-ink-soft">
            <span>章句数据加载失败</span>
            <button
              type="button"
              onClick={() => void retryBackground()}
              className="flex items-center gap-1 text-vermilion hover:underline"
            >
              <RefreshCw size={12} strokeWidth={1.5} aria-hidden />
              重试
            </button>
          </div>
        ) : verseState.status !== "ready" ? (
          <p
            className="flex items-center gap-2 py-8 text-xs text-ink-faint"
            role="status"
          >
            <Loader2
              size={14}
              strokeWidth={1.5}
              className="animate-spin"
              aria-hidden
            />
            章句数据加载中
          </p>
        ) : activeVerses.length === 0 ? (
          <p className="py-8 text-center text-xs text-ink-faint">暂无关联章句</p>
        ) : (
          <div className="space-y-4">
            {activeVerses.map((verse) => {
              const keywordNodes = readingCode
                ? anchor
                  ? [anchor]
                  : []
                : [anchor, target].filter((item): item is CoreNode => Boolean(item));
              const keywords = buildHighlightKeywords(keywordNodes, verse.verse);
              return (
                <VerseCard
                  key={verse.code}
                  verse={verse}
                  keywords={keywords}
                  expanded={expanded.has(verse.code)}
                  onToggle={() => toggleVerse(verse.code)}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

