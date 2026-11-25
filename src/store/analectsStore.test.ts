import { beforeEach, describe, expect, it } from "vitest";
import { useAnalectsStore } from "./analectsStore";
import type { CoreEdge, CoreGraphPackage, CoreNode } from "../types/data";

const nodes: CoreNode[] = [
  { id: "per-a", type: "person", canonical_name: "甲", source_refs: ["1.1"] },
  { id: "per-b", type: "person", canonical_name: "乙", source_refs: ["1.1"] },
  { id: "virt-ren", type: "virtue", canonical_name: "仁", source_refs: ["1.1"] },
  { id: "vice-ning", type: "vice", canonical_name: "佞", source_refs: ["1.1"] },
];

const edges: CoreEdge[] = [
  {
    source_id: "per-a",
    target_id: "per-b",
    relation: "PRAISES",
    relation_zh: "赞美",
    directed: true,
    share_refs: ["1.1"],
    weight: 1,
  },
  {
    source_id: "per-a",
    target_id: "virt-ren",
    relation: "ADVOCATES",
    relation_zh: "倡导",
    directed: true,
    share_refs: ["1.1"],
    weight: 1,
  },
  {
    source_id: "virt-ren",
    target_id: "vice-ning",
    relation: "CONTRASTS_WITH",
    relation_zh: "对立",
    directed: false,
    share_refs: ["1.1"],
    weight: 1,
  },
];

const core: CoreGraphPackage = { nodes, edges };

function reset(): void {
  useAnalectsStore.setState({
    data: {
      core: { status: "ready", data: core, error: null },
      details: { status: "ready", data: {}, error: null },
      coEdges: { status: "ready", data: { edges: [] }, error: null },
      verses: { status: "ready", data: [], error: null },
    },
    tab1Relations: ["PRAISES"],
    logArc: true,
    focus: null,
    hover: null,
    anchorId: null,
    history: [],
    historyIndex: -1,
    query: null,
    readingCode: null,
    extendedExploration: false,
    toast: null,
    hydrated: true,
  });
}

describe("useAnalectsStore", () => {
  beforeEach(reset);

  it("默认关系与对数弧长", () => {
    const state = useAnalectsStore.getState();
    expect(state.tab1Relations).toEqual(["PRAISES"]);
    expect(state.logArc).toBe(true);
  });

  it("Tab1 关系互斥单选，对数开关独立", () => {
    useAnalectsStore.getState().selectTab1Relation("TEACHES");
    useAnalectsStore.getState().setLogArc(false);
    let next = useAnalectsStore.getState();
    expect(next.tab1Relations).toEqual(["TEACHES"]);
    expect(next.logArc).toBe(false);
    useAnalectsStore.getState().selectTab1Relation("CRITICIZES");
    next = useAnalectsStore.getState();
    expect(next.tab1Relations).toEqual(["CRITICIZES"]);
  });

  it("点击同一节点不重复写历史，超过 50 条丢弃最旧记录", () => {
    useAnalectsStore.getState().anchorNode("per-a", { origin: "index" });
    useAnalectsStore.getState().anchorNode("per-a", { origin: "index" });
    expect(useAnalectsStore.getState().history).toEqual(["per-a"]);
    for (let index = 0; index < 55; index += 1) {
      useAnalectsStore.getState().anchorNode(`n-${index}`, { origin: "index" });
    }
    const next = useAnalectsStore.getState();
    expect(next.history).toHaveLength(50);
    expect(next.history[next.historyIndex]).toBe("n-54");
  });

  it("回溯历史会截断后续记录，清空历史保留当前节点", () => {
    useAnalectsStore.getState().anchorNode("per-a", { origin: "index" });
    useAnalectsStore.getState().anchorNode("per-b", { origin: "index" });
    useAnalectsStore.getState().anchorNode("virt-ren", { origin: "index" });
    useAnalectsStore.getState().selectHistory(0);
    let next = useAnalectsStore.getState();
    expect(next.history).toEqual(["per-a"]);
    expect(next.anchorId).toBe("per-a");
    useAnalectsStore.getState().clearHistory();
    next = useAnalectsStore.getState();
    expect(next.history).toEqual(["per-a"]);
    expect(next.historyIndex).toBe(0);
  });

  it("扩展节点探索可返回最近的核心节点", () => {
    useAnalectsStore.getState().anchorNode("per-a", { origin: "index" });
    useAnalectsStore.getState().anchorNode("inst-missing", { origin: "index" });
    let next = useAnalectsStore.getState();
    expect(next.extendedExploration).toBe(true);
    next.returnToLastCore();
    next = useAnalectsStore.getState();
    expect(next.anchorId).toBe("per-a");
    expect(next.extendedExploration).toBe(false);
  });

  it("边点击锚定源节点并激活目标章句", () => {
    useAnalectsStore.getState().anchorEdge(edges[0]);
    const state = useAnalectsStore.getState();
    expect(state.anchorId).toBe("per-a");
    expect(state.focus).toMatchObject({ kind: "edge" });
    expect(state.query?.targetId).toBe("per-b");
    expect(state.query?.direction).toBe("out");
    expect(state.query?.verseCodes).toEqual(["1.1"]);
  });

  it("深链应用锚点、历史与查询", () => {
    useAnalectsStore.getState().applyDeepLink({
      nodeId: "per-a",
      query: {
        anchorId: "per-a",
        targetId: "per-b",
        relation: "PRAISES",
        direction: "out",
        verseCodes: ["1.1"],
        edgeKey: "per-a|PRAISES|per-b",
        origin: "deepLink",
      },
      extended: false,
    });
    const state = useAnalectsStore.getState();
    expect(state.anchorId).toBe("per-a");
    expect(state.history).toEqual(["per-a"]);
    expect(state.query?.targetId).toBe("per-b");
    expect(state.focus).toMatchObject({ kind: "edge" });
  });
});
