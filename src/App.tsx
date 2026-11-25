import { useEffect } from "react";
import { AlertTriangle, Crosshair, RefreshCw, X } from "lucide-react";
import { TopTabs } from "./components/TopTabs";
import { PersonChordTab } from "./components/PersonChordTab";
import { BottomPanel } from "./components/BottomPanel";
import { LoadingSkeleton } from "./components/Skeleton";
import { useAnalectsStore } from "./store/analectsStore";
import { useDeepLinkAndHistory } from "./hooks/useDeepLink";
import { useKeyboardElevator, useToastTimer } from "./hooks/useKeyboardElevator";
import { computeCoreNodeIds } from "./lib/graph";

export default function App() {
  const loadCore = useAnalectsStore((state) => state.loadCore);
  const loadBackground = useAnalectsStore((state) => state.loadBackground);
  const core = useAnalectsStore((state) => state.data.core);
  const details = useAnalectsStore((state) => state.data.details);
  const coEdges = useAnalectsStore((state) => state.data.coEdges);
  const verses = useAnalectsStore((state) => state.data.verses);
  const retryBackground = useAnalectsStore((state) => state.retryBackground);

  useDeepLinkAndHistory();
  useKeyboardElevator();
  useToastTimer();

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (core.status === "ready") void loadBackground();
  }, [core.status, loadBackground]);

  const backgroundErrors = [
    details.status === "error" ? "详情" : null,
    coEdges.status === "error" ? "共现" : null,
    verses.status === "error" ? "章句" : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="min-h-dvh bg-paper">
      <div className="relative flex h-[100dvh] min-h-[560px] flex-col overflow-hidden">
        <TopTabs />
        <main className="relative min-h-0 flex-1">
          {core.status === "ready" ? (
            <PersonChordTab />
          ) : core.status === "error" && !core.data ? (
            <CoreError />
          ) : (
            <LoadingSkeleton label="正在加载核心图谱" />
          )}

          <ExtendedBanner />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-4 pb-4">
            <BackgroundError
              errors={backgroundErrors}
              onRetry={() => void retryBackground()}
            />
            <AnchorToast />
          </div>
        </main>
      </div>
      <BottomPanel />
    </div>
  );
}

function CoreError() {
  const loadCore = useAnalectsStore((state) => state.loadCore);
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="max-w-md rounded-lg border border-vermilion/25 bg-paper/90 p-8 text-center shadow-paper">
        <AlertTriangle
          size={26}
          strokeWidth={1.5}
          className="mx-auto mb-3 text-vermilion"
          aria-hidden
        />
        <p className="text-base text-ink">核心图谱加载失败</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          请检查网络或数据包是否已生成，然后重试。
        </p>
        <button
          type="button"
          onClick={() => void loadCore(true)}
          className="mx-auto mt-5 flex min-h-[40px] items-center gap-2 rounded-full border border-vermilion/40 bg-vermilion/[0.07] px-4 text-xs text-vermilion transition-colors hover:bg-vermilion/[0.12]"
        >
          <RefreshCw size={14} strokeWidth={1.5} aria-hidden />
          重试
        </button>
      </div>
    </div>
  );
}

function BackgroundError({
  errors,
  onRetry,
}: {
  errors: string[];
  onRetry: () => void;
}) {
  if (errors.length === 0) return null;
  return (
    <div
      className="pointer-events-auto flex items-center gap-3 rounded-full border border-vermilion/25 bg-paper/95 px-4 py-2 text-[11px] text-ink-soft shadow-paper"
      role="status"
      aria-live="polite"
    >
      <AlertTriangle
        size={13}
        strokeWidth={1.5}
        className="text-vermilion"
        aria-hidden
      />
      <span>{errors.join("、")}数据加载失败，已加载内容保持可用。</span>
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1 text-vermilion hover:underline"
      >
        <RefreshCw size={12} strokeWidth={1.5} aria-hidden />
        重试
      </button>
    </div>
  );
}

function AnchorToast() {
  const toast = useAnalectsStore((state) => state.toast);
  const dismiss = useAnalectsStore((state) => state.dismissToast);
  if (!toast) return null;
  return (
    <div
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-ink/15 bg-paper/95 px-4 py-2 text-[11px] text-ink-soft shadow-paper"
      role="status"
      aria-live="polite"
    >
      <Crosshair
        size={13}
        strokeWidth={1.5}
        className="text-vermilion"
        aria-hidden
      />
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="关闭提示"
        className="grid h-5 w-5 place-items-center rounded-full text-ink-faint hover:text-ink"
      >
        <X size={12} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

function ExtendedBanner() {
  const extended = useAnalectsStore((state) => state.extendedExploration);
  const anchorId = useAnalectsStore((state) => state.anchorId);
  const core = useAnalectsStore((state) => state.data.core.data);
  const details = useAnalectsStore((state) => state.data.details.data);
  const history = useAnalectsStore((state) => state.history);
  const historyIndex = useAnalectsStore((state) => state.historyIndex);
  const returnToLastCore = useAnalectsStore((state) => state.returnToLastCore);
  const dismiss = useAnalectsStore((state) => state.dismissExtendedExploration);

  if (!extended || !anchorId) return null;
  const name =
    core?.nodes.find((node) => node.id === anchorId)?.canonical_name ??
    details?.[anchorId]?.canonical_name ??
    anchorId;
  const coreIds = computeCoreNodeIds(core?.edges ?? []);
  const hasPreviousCore = history
    .slice(0, historyIndex)
    .some((id) => coreIds.has(id));

  return (
    <div
      className="absolute inset-x-0 top-2 z-20 flex justify-center px-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex max-w-[92vw] items-center gap-2 rounded-full border border-ink/15 bg-paper/95 px-3 py-1.5 text-[11px] text-ink-soft shadow-paper">
        <span className="truncate">
          当前正在索引区探索扩展概念：{name}（未参与强语义关系）
        </span>
        {hasPreviousCore ? (
          <button
            type="button"
            onClick={returnToLastCore}
            className="shrink-0 text-vermilion hover:underline"
          >
            返回上一个核心节点
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          aria-label="关闭扩展概念提示"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-ink-faint hover:text-ink"
        >
          <X size={12} strokeWidth={1.5} aria-hidden />
        </button>
      </div>
    </div>
  );
}

