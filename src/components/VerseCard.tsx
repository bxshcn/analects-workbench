import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { MarkdownText } from "./MarkdownText";
import type { Verse } from "../types/data";

const NOTE_FIELDS: Array<{ key: keyof Verse; label: string }> = [
  { key: "gloss", label: "译" },
  { key: "annotation", label: "注" },
  { key: "commentary", label: "疏" },
  { key: "critique", label: "评" },
];

export function VerseCard({
  verse,
  keywords,
  expanded,
  onToggle,
}: {
  verse: Verse;
  keywords: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  const notesId = `verse-notes-${id}`;
  const notes = NOTE_FIELDS.filter(({ key }) => {
    const value = verse[key];
    return typeof value === "string" && value.trim().length > 0;
  });

  return (
    <article className="rounded-lg border border-ink/10 bg-white/85 shadow-[0_1px_0_rgba(43,43,43,0.03)]">
      <div className="flex items-center justify-between gap-3 border-b border-ink/[0.07] px-4 py-2.5">
        <p className="text-[11px] tracking-[0.16em] text-ink-faint">
          [{verse.chapter_title}·{verse.code}]
        </p>
        {notes.length > 0 ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={notesId}
            className="flex min-h-[32px] items-center gap-1 text-[11px] text-ink-soft transition-colors hover:text-vermilion max-sm:min-h-[44px]"
          >
            {expanded ? "收起注疏" : "展开注疏"}
            <ChevronDown
              size={14}
              strokeWidth={1.5}
              aria-hidden
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        ) : null}
      </div>

      <div className="px-4 pb-4 pt-3">
        <MarkdownText
          text={verse.verse}
          keywords={keywords}
          className="text-[15px] leading-[2.05] tracking-[0.01em] text-ink"
        />

        {notes.length > 0 ? (
          <div
            id={notesId}
            className={`grid transition-[grid-template-rows] duration-300 ease-paper ${
              expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="mt-4 grid gap-3 border-t border-dashed border-ink/10 pt-3">
                {notes.map(({ key, label }) => (
                  <div key={key} className="flex gap-2.5">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[3px] border border-ink/15 bg-paper-deep/50 text-[10px] text-ink-faint">
                      {label}
                    </span>
                    <MarkdownText
                      text={String(verse[key])}
                      className="min-w-0 flex-1 text-[12.5px] leading-[1.95] text-ink-soft"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
