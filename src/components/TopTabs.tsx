import { BookOpen, Users } from "lucide-react";
import { useAnalectsStore } from "../store/analectsStore";

export function TopTabs() {
  const core = useAnalectsStore((state) => state.data.core.data);

  return (
    <header className="relative z-30 grid h-14 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-ink/10 bg-paper/90 px-3 backdrop-blur-sm sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-vermilion/50 bg-vermilion/[0.06] text-[15px] text-vermilion">
          論
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-semibold tracking-[0.14em] text-ink">
            《论语》知识图谱
          </p>
          <p className="hidden text-[10px] tracking-[0.2em] text-ink-faint lg:block">
            原典 · 注疏 · 概念索引
          </p>
        </div>
      </div>

      <div className="hidden items-center gap-1.5 justify-self-center rounded-full border border-ink/10 bg-paper/80 px-4 py-1.5 text-xs tracking-[0.08em] text-ink-soft sm:flex">
        <Users size={15} strokeWidth={1.5} aria-hidden />
        人物关系网络
      </div>

      <div className="hidden items-center justify-end gap-3 text-[10px] tracking-[0.16em] text-ink-faint lg:flex">
        {core ? (
          <>
            <span className="flex items-center gap-1">
              <BookOpen size={13} strokeWidth={1.5} aria-hidden />
              {core.nodes.length} 节点
            </span>
            <span>{core.edges.length} 关系</span>
          </>
        ) : null}
        <span>j 索引</span>
        <span>k 顶部</span>
      </div>
    </header>
  );
}
