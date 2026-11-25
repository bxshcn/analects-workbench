import { HistoryBar } from "./HistoryBar";
import { NodeProfile } from "./NodeProfile";
import { RelationIndex } from "./RelationIndex";
import { VerseResearch } from "./VerseResearch";
import { useAnalectsStore } from "../store/analectsStore";
import { BookOpen } from "lucide-react";

export function BottomPanel() {
  const anchorId = useAnalectsStore((state) => state.anchorId);

  return (
    <section
      id="index-panel"
      className="flex h-[100dvh] min-h-[640px] w-full flex-col border-t border-ink/10 bg-paper"
      aria-label="《论语》概念索引与章句考据"
    >
      <HistoryBar />
      <div className="mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 px-4 pb-6 pt-6 sm:px-6 lg:px-10">
        {!anchorId ? (
          <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto rounded-lg border border-dashed border-ink/15 bg-paper-deep/30 px-6 py-14 text-center no-scrollbar">
            <div className="max-w-md">
              <BookOpen
                size={28}
                strokeWidth={1.5}
                className="mx-auto mb-4 text-ink-faint"
                aria-hidden
              />
              <p className="text-base tracking-[0.16em] text-ink-soft">
                索引区等待锚定
              </p>
              <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                在首屏弦图中点击人物，即可在此查阅档案、关系索引与原典章句。
                也可直接使用地址中的深链参数恢复查阅状态。
              </p>
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-8 overflow-y-auto no-scrollbar md:grid-cols-3 md:overflow-hidden">
            <div className="min-h-0 min-w-0 md:col-span-2 md:overflow-y-auto md:overscroll-contain md:pr-8 no-scrollbar">
              <div className="space-y-6">
                <NodeProfile />
                <div id="verse-research" className="scroll-mt-4">
                  <VerseResearch />
                </div>
              </div>
            </div>
            <aside className="min-h-0 min-w-0 border-t border-ink/10 pt-6 md:col-span-1 md:overflow-y-auto md:overscroll-contain md:border-l md:border-t-0 md:pl-8 md:pt-0 no-scrollbar">
              <RelationIndex />
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
