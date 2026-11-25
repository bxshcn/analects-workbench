import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computePersonChord } from "./chord";
import type { CoreGraphPackage } from "../types/data";

function readJson<T>(file: string): T {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "public", "data", file), "utf8"),
  ) as T;
}

const core = readJson<CoreGraphPackage>("core-graph.json");

describe("真实数据几何", () => {
  it("Tab1 默认与三项全选均能生成完整弦图", () => {
    for (const relations of [
      ["PRAISES"],
      ["PRAISES", "CRITICIZES", "TEACHES"],
    ] as const) {
      const geometry = computePersonChord({
        nodes: core.nodes,
        edges: core.edges,
        relations: [...relations],
        logArc: true,
      });
      expect(geometry.persons.length).toBeGreaterThan(0);
      expect(geometry.ribbons).toHaveLength(geometry.edgeCount);
      for (const person of geometry.persons) {
        const arcLength = person.endAngle - person.startAngle;
        const sliceLength = [...person.outgoing, ...person.incoming].reduce(
          (sum, slice) => sum + slice.width,
          0,
        );
        expect(sliceLength).toBeCloseTo(arcLength, 6);
      }
    }
  });
});
