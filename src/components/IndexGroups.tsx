import { useEffect, useState, type ReactNode } from "react";
import { VerseCapsule } from "./Capsule";
import type { IndexEdgeItem } from "../lib/graph";
import type { Verse } from "../types/data";

export function GroupHeader({
  title,
  count,
  muted,
}: {
  title: string;
  count: number;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between border-b border-dashed border-ink/10 pb-1 ${
        muted ? "opacity-60" : ""
      }`}
    >
      <h4 className="text-[11px] tracking-[0.2em] text-ink-soft">{title}</h4>
      <span className="text-[10px] text-ink-faint">{count}</span>
    </div>
  );
}

export function ExpandableGroup({
  title,
  items,
  render,
  id,
}: {
  title: string;
  items: IndexEdgeItem[];
  render: (item: IndexEdgeItem) => ReactNode;
  id?: string;
}) {
  const [visible, setVisible] = useState(15);
  const signature = items.map((item) => item.key).join("|");
  useEffect(() => {
    setVisible(15);
  }, [signature]);
  const expanded = visible > 15;
  const shown = items.slice(0, visible);
  return (
    <section id={id} aria-label={title} className="scroll-mt-20">
      <GroupHeader title={title} count={items.length} />
      <div className="mt-2 flex flex-wrap gap-2">
        {shown.map((item) => render(item))}
      </div>
      {items.length > 15 ? (
        <div className="mt-2 flex gap-3 text-[11px]">
          {visible < items.length ? (
            <button
              type="button"
              onClick={() =>
                setVisible((value) => Math.min(items.length, value + 50))
              }
              className="text-vermilion hover:underline"
            >
              展开全部
            </button>
          ) : null}
          {expanded ? (
            <button
              type="button"
              onClick={() => setVisible(15)}
              className="text-ink-faint hover:text-ink"
            >
              收起
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function SourceVerseList({
  verses,
  readingCode,
  onRead,
}: {
  verses: Verse[];
  readingCode: string | null;
  onRead: (code: string) => void;
}) {
  const [visible, setVisible] = useState(15);
  const signature = verses.map((verse) => verse.code).join("|");
  useEffect(() => {
    setVisible(15);
  }, [signature]);
  const shown = verses.slice(0, visible);
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        {shown.map((verse) => (
          <VerseCapsule
            key={verse.code}
            label={`[${verse.chapter_title}·${verse.code}]`}
            active={readingCode === verse.code}
            onClick={() => onRead(verse.code)}
          />
        ))}
      </div>
      {verses.length > 15 ? (
        <div className="mt-2 flex gap-3 text-[11px]">
          {visible < verses.length ? (
            <button
              type="button"
              onClick={() =>
                setVisible((value) => Math.min(verses.length, value + 50))
              }
              className="text-vermilion hover:underline"
            >
              展开全部
            </button>
          ) : null}
          {visible > 15 ? (
            <button
              type="button"
              onClick={() => setVisible(15)}
              className="text-ink-faint hover:text-ink"
            >
              收起
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
