import type { CoreNode } from "../types/data";

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 高亮规则：
 * 1. 关键词 = canonical_name + 长度不小于 2 的 alias。
 * 2. 单字别名仅在该节点没有任何本名或多字别名命中时启用。
 * 3. 只处理当前关系双方的关键词。
 */
export function buildHighlightKeywords(
  nodes: Array<Pick<CoreNode, "canonical_name" | "alias">>,
  text: string,
): string[] {
  const keywords = new Set<string>();
  for (const node of nodes) {
    const canonical = node.canonical_name;
    const multiAliases = (node.alias ?? []).filter((alias) => alias.length >= 2);
    const mainCandidates = [canonical, ...multiAliases].filter(Boolean);
    if (mainCandidates.some((candidate) => text.includes(candidate))) {
      for (const candidate of mainCandidates) keywords.add(candidate);
      continue;
    }
    const singleAliases = (node.alias ?? []).filter((alias) => alias.length === 1);
    const hitSingle = singleAliases.filter((alias) => text.includes(alias));
    for (const alias of hitSingle) keywords.add(alias);
  }
  return [...keywords].sort((left, right) => right.length - left.length);
}

export function splitHighlight(text: string, keywords: string[]): HighlightSegment[] {
  const usable = [...new Set(keywords.filter((keyword) => keyword.length > 0))].sort(
    (left, right) => right.length - left.length,
  );
  if (usable.length === 0) return [{ text, matched: false }];

  const pattern = new RegExp(usable.map(escapeRegExp).join("|"), "g");
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ text: text.slice(cursor, index), matched: false });
    segments.push({ text: match[0], matched: true });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), matched: false });
  return segments.length > 0 ? segments : [{ text, matched: false }];
}

export function hasHighlight(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => keyword.length > 0 && text.includes(keyword));
}
