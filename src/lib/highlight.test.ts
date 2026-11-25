import { describe, expect, it } from "vitest";
import { buildHighlightKeywords, splitHighlight } from "./highlight";

describe("buildHighlightKeywords", () => {
  it("本名命中时包含本名与多字别名", () => {
    const keywords = buildHighlightKeywords(
      [{ canonical_name: "端木赐", alias: ["子贡", "赐"] }],
      "子贡问曰",
    );
    expect(keywords).toContain("子贡");
    expect(keywords).toContain("端木赐");
    expect(keywords).not.toContain("赐");
  });

  it("没有任何本名或多字别名命中时才启用单字别名", () => {
    const keywords = buildHighlightKeywords(
      [{ canonical_name: "商汤", alias: ["汤"] }],
      "汤之盘铭曰",
    );
    expect(keywords).toEqual(["汤"]);
  });

  it("本名与别名都不在原文时不强行高亮", () => {
    const keywords = buildHighlightKeywords(
      [{ canonical_name: "道听途说", alias: [] }],
      "学而时习之",
    );
    expect(keywords).toEqual([]);
  });

  it("只处理传入的关系双方", () => {
    const keywords = buildHighlightKeywords(
      [
        { canonical_name: "孔子", alias: [] },
        { canonical_name: "颜回", alias: ["子渊"] },
      ],
      "孔子曰：回也不愚。",
    );
    expect(keywords).toContain("孔子");
    expect(keywords).not.toContain("颜回");
  });
});

describe("splitHighlight", () => {
  it("最长匹配优先，避免短词覆盖长词", () => {
    const segments = splitHighlight("子贡与子路", ["子", "子贡", "子路"]);
    const matched = segments.filter((segment) => segment.matched);
    expect(matched.map((segment) => segment.text)).toEqual(["子贡", "子路"]);
  });

  it("没有关键词时返回原文", () => {
    expect(splitHighlight("原文", [])).toEqual([
      { text: "原文", matched: false },
    ]);
  });

  it("正则特殊字符作为普通文本处理", () => {
    const segments = splitHighlight("《诗》云", ["《诗》"]);
    expect(segments.some((segment) => segment.matched)).toBe(true);
  });
});
