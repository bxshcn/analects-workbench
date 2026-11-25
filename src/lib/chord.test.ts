import { describe, expect, it } from "vitest";
import { computePersonChord } from "./chord";
import type { CoreEdge, CoreNode } from "../types/data";

const nodes: CoreNode[] = [
  { id: "a", type: "person", canonical_name: "甲", source_refs: ["1.1"] },
  { id: "b", type: "person", canonical_name: "乙", source_refs: ["1.1"] },
  { id: "c", type: "person", canonical_name: "丙", source_refs: ["1.1"] },
];

function edge(
  source: string,
  target: string,
  relation: CoreEdge["relation"],
  weight: number,
): CoreEdge {
  return {
    source_id: source,
    target_id: target,
    relation,
    relation_zh: relation,
    directed: true,
    share_refs: Array.from({ length: weight }, (_, index) => `1.${index + 1}`),
    weight,
  };
}

const edges: CoreEdge[] = [
  edge("a", "b", "PRAISES", 2),
  edge("c", "a", "CRITICIZES", 1),
  edge("b", "c", "TEACHES", 1),
];

describe("computePersonChord", () => {
  it("按原始权重分配弧长，并让每个人的子弧总和严格等于弧长", () => {
    const geometry = computePersonChord({
      nodes,
      edges,
      relations: ["PRAISES", "CRITICIZES", "TEACHES"],
      logArc: false,
    });
    const total = geometry.arcValueTotal;
    const available = Math.PI * 2 - geometry.persons.length * 0.01;

    expect(geometry.persons.map((person) => person.node.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    for (const person of geometry.persons) {
      const arcLength = person.endAngle - person.startAngle;
      expect(arcLength).toBeCloseTo((person.rawTotal / total) * available, 8);
      const slices = [...person.outgoing, ...person.incoming];
      const widthTotal = slices.reduce((sum, slice) => sum + slice.width, 0);
      expect(widthTotal).toBeCloseTo(arcLength, 8);
    }
  });

  it("对数弧长改变几何但不改变原始权重与边数", () => {
    const raw = computePersonChord({
      nodes,
      edges,
      relations: ["PRAISES", "CRITICIZES", "TEACHES"],
      logArc: false,
    });
    const log = computePersonChord({
      nodes,
      edges,
      relations: ["PRAISES", "CRITICIZES", "TEACHES"],
      logArc: true,
    });
    expect(log.edgeCount).toBe(raw.edgeCount);
    expect(log.persons.map((person) => person.rawTotal)).toEqual(
      raw.persons.map((person) => person.rawTotal),
    );
    expect(log.persons[0].arcValue).toBeCloseTo(Math.log1p(3), 8);
    const first = log.persons[0];
    const sliceTotal = [...first.outgoing, ...first.incoming].reduce(
      (sum, slice) => sum + slice.width,
      0,
    );
    expect(sliceTotal).toBeCloseTo(first.endAngle - first.startAngle, 8);
  });

  it("子弧排序先出向后入向，同向按关系顺序", () => {
    const geometry = computePersonChord({
      nodes,
      edges,
      relations: ["PRAISES", "CRITICIZES", "TEACHES"],
      logArc: true,
    });
    const personA = geometry.persons.find((person) => person.node.id === "a");
    expect(personA?.outgoing.map((slice) => slice.relation)).toEqual(["PRAISES"]);
    expect(personA?.incoming.map((slice) => slice.relation)).toEqual(["CRITICIZES"]);
    expect(geometry.ribbons).toHaveLength(3);
  });

  it("空关系集合返回空几何", () => {
    const geometry = computePersonChord({
      nodes,
      edges,
      relations: [],
      logArc: true,
    });
    expect(geometry.persons).toEqual([]);
    expect(geometry.ribbons).toEqual([]);
  });
});
