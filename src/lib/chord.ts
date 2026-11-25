import type { CoreEdge, CoreNode, Relation } from "../types/data";
import { PAD_ANGLE, RELATION_ORDER } from "./constants";

export interface PersonArcSlice {
  edge: CoreEdge;
  end: "source" | "target";
  relation: Relation;
  startAngle: number;
  endAngle: number;
  width: number;
}

export interface PersonArc {
  node: CoreNode;
  rawTotal: number;
  arcValue: number;
  startAngle: number;
  endAngle: number;
  outgoing: PersonArcSlice[];
  incoming: PersonArcSlice[];
}

export interface ChordRibbon {
  edge: CoreEdge;
  relation: Relation;
  source: PersonArc;
  target: PersonArc;
  sourceStartAngle: number;
  sourceEndAngle: number;
  targetStartAngle: number;
  targetEndAngle: number;
}

export interface PersonChordGeometry {
  persons: PersonArc[];
  ribbons: ChordRibbon[];
  arcValueTotal: number;
  rawTotal: number;
  edgeCount: number;
}

function compareName(
  left: { canonical_name: string },
  right: { canonical_name: string },
): number {
  return left.canonical_name.localeCompare(right.canonical_name, "zh-Hans-CN");
}

function sortSlices(left: PersonArcSlice, right: PersonArcSlice): number {
  if (left.end !== right.end) return left.end === "source" ? -1 : 1;
  const relationDelta =
    RELATION_ORDER.indexOf(left.relation) - RELATION_ORDER.indexOf(right.relation);
  if (relationDelta !== 0) return relationDelta;
  if (right.edge.weight !== left.edge.weight) return right.edge.weight - left.edge.weight;
  return left.edge.target_id.localeCompare(right.edge.target_id);
}

/**
 * Tab1 有向弦图几何。
 * 每个人物按 arcValue 占比获得圆周弧段，段内按关联权重切分子弧，
 * 源端与目标端按各自 rawTotal 折算，因此同一条边两端可以有不同的宽度，
 * 形成自然收束效果。padAngle 从总圆周中扣除。
 */
export function computePersonChord(params: {
  nodes: CoreNode[];
  edges: CoreEdge[];
  relations: Relation[];
  logArc: boolean;
  padAngle?: number;
}): PersonChordGeometry {
  const { nodes, edges, relations, logArc } = params;
  const padAngle = params.padAngle ?? PAD_ANGLE;
  const relationSet = new Set(relations);
  const selected = edges.filter(
    (edge) => relationSet.has(edge.relation) && edge.relation !== "CO_OCCURS_WITH",
  );
  const personById = new Map(
    nodes.filter((node) => node.type === "person").map((node) => [node.id, node]),
  );

  const rawTotals = new Map<string, number>();
  for (const edge of selected) {
    if (!personById.has(edge.source_id) || !personById.has(edge.target_id)) continue;
    rawTotals.set(
      edge.source_id,
      (rawTotals.get(edge.source_id) ?? 0) + edge.weight,
    );
    rawTotals.set(
      edge.target_id,
      (rawTotals.get(edge.target_id) ?? 0) + edge.weight,
    );
  }

  const persons: PersonArc[] = [...rawTotals.entries()]
    .map(([id, rawTotal]) => {
      const node = personById.get(id) as CoreNode;
      return {
        node,
        rawTotal,
        arcValue: logArc ? Math.log1p(rawTotal) : rawTotal,
        startAngle: 0,
        endAngle: 0,
        outgoing: [] as PersonArcSlice[],
        incoming: [] as PersonArcSlice[],
      };
    })
    .sort(
      (left, right) =>
        right.arcValue - left.arcValue || compareName(left.node, right.node),
    );

  const arcValueTotal = persons.reduce((sum, person) => sum + person.arcValue, 0);
  const available = Math.max(0, Math.PI * 2 - persons.length * padAngle);
  if (arcValueTotal <= 0 || persons.length === 0) {
    return { persons: [], ribbons: [], arcValueTotal: 0, rawTotal: 0, edgeCount: 0 };
  }

  const personIndex = new Map(persons.map((person, index) => [person.node.id, index]));

  let cursor = 0;
  for (const person of persons) {
    const angle = (person.arcValue / arcValueTotal) * available;
    person.startAngle = cursor;
    person.endAngle = cursor + angle;
    cursor = person.endAngle + padAngle;
    for (const edge of selected) {
      if (edge.source_id !== person.node.id && edge.target_id !== person.node.id) continue;
      const end = edge.source_id === person.node.id ? "source" : "target";
      const arcLength = person.endAngle - person.startAngle;
      const width = (edge.weight / person.rawTotal) * arcLength;
      const slice: PersonArcSlice = {
        edge,
        end,
        relation: edge.relation,
        startAngle: 0,
        endAngle: 0,
        width,
      };
      if (end === "source") person.outgoing.push(slice);
      else person.incoming.push(slice);
    }
    person.outgoing.sort(sortSlices);
    person.incoming.sort(sortSlices);
    let sliceCursor = person.startAngle;
    for (const slice of [...person.outgoing, ...person.incoming]) {
      slice.startAngle = sliceCursor;
      slice.endAngle = sliceCursor + slice.width;
      sliceCursor = slice.endAngle;
    }
    if (Math.abs(sliceCursor - person.endAngle) > 1e-6) {
      person.endAngle = sliceCursor;
    }
  }

  const ribbons: ChordRibbon[] = [];
  for (const edge of selected) {
    const sourceIndex = personIndex.get(edge.source_id);
    const targetIndex = personIndex.get(edge.target_id);
    if (sourceIndex === undefined || targetIndex === undefined) continue;
    const source = persons[sourceIndex];
    const target = persons[targetIndex];
    const sourceSlice = source.outgoing.find((slice) => slice.edge === edge);
    const targetSlice = target.incoming.find((slice) => slice.edge === edge);
    if (!sourceSlice || !targetSlice) continue;
    ribbons.push({
      edge,
      relation: edge.relation,
      source,
      target,
      sourceStartAngle: sourceSlice.startAngle,
      sourceEndAngle: sourceSlice.endAngle,
      targetStartAngle: targetSlice.startAngle,
      targetEndAngle: targetSlice.endAngle,
    });
  }

  return {
    persons,
    ribbons,
    arcValueTotal,
    rawTotal: persons.reduce((sum, person) => sum + person.rawTotal, 0),
    edgeCount: selected.length,
  };
}

