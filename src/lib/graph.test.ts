import { describe, expect, it } from "vitest";
import {
  buildRelationGroups,
  compareVerseCode,
  findVerseEdge,
  formatTriple,
} from "./graph";
import type { CoreEdge, CoreNode } from "../types/data";

function node(
  id: string,
  type: CoreNode["type"],
  name: string,
): CoreNode {
  return { id, type, canonical_name: name, source_refs: ["1.1"] };
}

const nodes = [
  node("a", "person", "甲"),
  node("b", "person", "乙"),
  node("c", "person", "丙"),
  node("d", "virtue", "德"),
  node("e", "vice", "恶"),
];

function strong(
  source: string,
  target: string,
  relation: CoreEdge["relation"],
  weight = 1,
): CoreEdge {
  return {
    source_id: source,
    target_id: target,
    relation,
    relation_zh: relation,
    directed: relation !== "CONTRASTS_WITH",
    share_refs: ["1.1"],
    weight,
  };
}

describe("formatTriple", () => {
  it("主动与被动使用规定的中文名", () => {
    expect(formatTriple("孔子", "仲由", "TEACHES", "out")).toBe(
      "孔子 · 品评 · 仲由",
    );
    expect(formatTriple("仲由", "孔子", "TEACHES", "in")).toBe(
      "仲由 · 受评于 · 孔子",
    );
    expect(formatTriple("有道", "无道", "CONTRASTS_WITH", null)).toBe(
      "有道 · 对立 · 无道",
    );
  });
});

describe("buildRelationGroups", () => {
  it("按主动、被动、对立、共现分组并排序", () => {
    const strongEdges = [
      strong("a", "b", "PRAISES", 2),
      strong("a", "c", "TEACHES", 5),
      strong("c", "a", "CRITICIZES", 1),
      strong("a", "d", "CONTRASTS_WITH", 3),
    ];
    const coEdges = [
      {
        ...strong("a", "e", "CO_OCCURS_WITH", 4),
        directed: false,
      },
    ];
    const groups = buildRelationGroups({
      anchorId: "a",
      nodeById: new Map(nodes.map((item) => [item.id, item])),
      strongEdges,
      coEdges,
    });
    expect(groups.map((group) => group.key)).toEqual([
      "out:PRAISES",
      "out:TEACHES",
      "in:CRITICIZES",
      "none:CONTRASTS_WITH",
      "none:CO_OCCURS_WITH",
    ]);
    expect(groups.map((group) => group.title)).toEqual([
      "赞美",
      "品评",
      "受批",
      "对立",
      "共现",
    ]);
    expect(groups[0].items.map((item) => item.relation)).toEqual(["PRAISES"]);
    expect(groups[1].items.map((item) => item.relation)).toEqual(["TEACHES"]);
    expect(groups[0].items[0].other.canonical_name).toBe("乙");
    expect(groups[2].items[0].other.canonical_name).toBe("丙");
    expect(groups[3].items[0].direction).toBe("none");
    expect(groups[4].items[0].direction).toBe("none");
  });

  it("空组自动隐藏", () => {
    const groups = buildRelationGroups({
      anchorId: "a",
      nodeById: new Map(nodes.map((item) => [item.id, item])),
      strongEdges: [strong("a", "b", "PRAISES", 1)],
      coEdges: [],
    });
    expect(groups.map((group) => group.key)).toEqual(["out:PRAISES"]);
  });
});

describe("章句查找", () => {
  const edges = [
    strong("a", "b", "TEACHES", 1),
    strong("d", "e", "CONTRASTS_WITH", 1),
  ];

  it("有向关系区分方向", () => {
    expect(findVerseEdge(edges, "a", "b", "TEACHES", "out")).not.toBeNull();
    expect(findVerseEdge(edges, "a", "b", "TEACHES", "in")).toBeNull();
    expect(findVerseEdge(edges, "b", "a", "TEACHES", "in")).not.toBeNull();
  });

  it("对称关系忽略方向", () => {
    expect(findVerseEdge(edges, "d", "e", "CONTRASTS_WITH", null)).not.toBeNull();
    expect(findVerseEdge(edges, "e", "d", "CONTRASTS_WITH", null)).not.toBeNull();
  });

  it("章句号按数字升序", () => {
    expect(compareVerseCode("2.1", "10.1")).toBeLessThan(0);
    expect(compareVerseCode("1.2", "1.10")).toBeLessThan(0);
  });
});
