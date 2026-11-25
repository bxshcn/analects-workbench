import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import type {
  CoreEdge,
  CoreGraphPackage,
  CoreNode,
  NodeDetailMap,
  Verse,
} from "./types/data";

const nodes: CoreNode[] = [
  { id: "per-a", type: "person", canonical_name: "甲", source_refs: ["1.1"] },
  { id: "per-b", type: "person", canonical_name: "乙", source_refs: ["1.1"] },
  { id: "virt-ren", type: "virtue", canonical_name: "仁", source_refs: ["1.1"] },
  { id: "vice-ning", type: "vice", canonical_name: "佞", source_refs: ["1.1"] },
  {
    id: "prsa-junzi",
    type: "persona",
    canonical_name: "君子",
    source_refs: ["1.1"],
  },
];

function edge(
  source: string,
  target: string,
  relation: CoreEdge["relation"],
): CoreEdge {
  return {
    source_id: source,
    target_id: target,
    relation,
    relation_zh: relation,
    directed: relation !== "CONTRASTS_WITH" && relation !== "CO_OCCURS_WITH",
    share_refs: ["1.1"],
    weight: 1,
  };
}

const core: CoreGraphPackage = {
  nodes,
  edges: [
    edge("per-a", "per-b", "PRAISES"),
    edge("per-b", "per-a", "CRITICIZES"),
    edge("per-a", "virt-ren", "ADVOCATES"),
    edge("per-a", "vice-ning", "WARNS_AGAINST"),
    edge("prsa-junzi", "virt-ren", "CONTAINS"),
    edge("virt-ren", "vice-ning", "CONTRASTS_WITH"),
  ],
};

const details: NodeDetailMap = Object.fromEntries(
  nodes.map((node) => [
    node.id,
    {
      ...node,
      gloss: `${node.canonical_name}之训`,
      commentary: `${node.canonical_name}之疏`,
    },
  ]),
);

const verses: Verse[] = [
  {
    id: "verse-01-01",
    code: "1.1",
    chapter_num: 1,
    chapter_title: "学而",
    verse: "甲赞美乙。",
    gloss: "甲之训",
    annotation: "",
    commentary: "甲之疏",
    critique: "",
  },
];

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  } as Response;
}

describe("App smoke", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.includes("core-graph.json")) return jsonResponse(core);
        if (url.includes("node-details.json")) return jsonResponse(details);
        if (url.includes("co-edges.json")) return jsonResponse({ edges: [] });
        if (url.includes("verses.json")) return jsonResponse(verses);
        return { ok: false, status: 404, json: async () => ({}) } as Response;
      }),
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    });
    Element.prototype.scrollIntoView = vi.fn();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("首屏渲染、关系单选、锚定与查原文流程", async () => {
    render(<App />);

    expect(await screen.findByText("人物关系有向弦图")).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();

    const praise = screen.getByLabelText("赞美") as HTMLInputElement;
    const criticize = screen.getByLabelText("批评") as HTMLInputElement;
    expect(praise.checked).toBe(true);
    expect(criticize.checked).toBe(false);
    fireEvent.click(criticize);
    expect(criticize.checked).toBe(true);
    expect(praise.checked).toBe(false);
    fireEvent.click(praise);
    expect(praise.checked).toBe(true);
    expect(criticize.checked).toBe(false);

    fireEvent.click(
      await screen.findByRole("button", { name: /^甲，人物/ }),
    );
    expect(
      await screen.findByText("已锚定 甲 · 按 j 查看索引详情"),
    ).toBeTruthy();
    expect(await screen.findByText("概要释义")).toBeTruthy();
    expect(await screen.findByText("甲之训")).toBeTruthy();
    expect(screen.getByLabelText("关系快捷跳转")).toBeTruthy();

    await waitFor(() => {
      expect(window.location.search).toContain("node=per-a");
    });

    const queryButtons = await screen.findAllByLabelText("查原文：乙");
    fireEvent.click(queryButtons[0]);
    expect(await screen.findByText("甲 · 赞美 · 乙")).toBeTruthy();
    expect((await screen.findAllByText("[学而·1.1]")).length).toBeGreaterThan(0);

    fireEvent.click(await screen.findByRole("button", { name: "展开注疏" }));
    expect(await screen.findAllByText("甲之训")).not.toHaveLength(0);

    await waitFor(() => {
      expect(window.location.search).toContain("target=per-b");
      expect(window.location.search).toContain("rel=PRAISES");
      expect(window.location.search).toContain("dir=out");
    });
  });
});
