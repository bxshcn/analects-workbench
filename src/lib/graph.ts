import {
  NODE_TYPE_ORDER,
  PASSIVE_RELATION_ZH,
  RELATION_ORDER,
  RELATION_ZH,
  isSymmetricRelation,
} from "./constants";
import type {
  CoEdge,
  CoreEdge,
  CoreNode,
  Direction,
  Relation,
  Verse,
} from "../types/data";

export function edgeKey(
  edge: Pick<CoreEdge, "source_id" | "relation" | "target_id">,
): string {
  return `${edge.source_id}|${edge.relation}|${edge.target_id}`;
}

export function symmetricEdgeKey(
  edge: Pick<CoreEdge, "source_id" | "relation" | "target_id">,
): string {
  if (isSymmetricRelation(edge.relation)) {
    const [left, right] = [edge.source_id, edge.target_id].sort();
    return `${left}|${edge.relation}|${right}`;
  }
  return edgeKey(edge);
}

export function computeCoreNodeIds(edges: CoreEdge[]): Set<string> {
  const ids = new Set<string>();
  for (const edge of edges) {
    ids.add(edge.source_id);
    ids.add(edge.target_id);
  }
  return ids;
}

export function touchNode(
  edge: Pick<CoreEdge, "source_id" | "target_id">,
  nodeId: string,
): boolean {
  return edge.source_id === nodeId || edge.target_id === nodeId;
}

export function otherEnd(
  edge: Pick<CoreEdge, "source_id" | "target_id">,
  nodeId: string,
): string {
  return edge.source_id === nodeId ? edge.target_id : edge.source_id;
}

export function formatTriple(
  anchorName: string,
  targetName: string,
  relation: Relation,
  direction: Direction | null,
): string {
  if (isSymmetricRelation(relation) || direction === null) {
    return `${anchorName} · ${RELATION_ZH[relation]} · ${targetName}`;
  }
  if (direction === "in") {
    return `${anchorName} · ${PASSIVE_RELATION_ZH[relation] ?? RELATION_ZH[relation]}于 · ${targetName}`;
  }
  return `${anchorName} · ${RELATION_ZH[relation]} · ${targetName}`;
}

export interface IndexEdgeItem {
  key: string;
  relation: Relation;
  direction: Direction | "none";
  edge: CoreEdge | CoEdge;
  other: CoreNode;
}

export type RelationGroupKey = string;

export interface RelationGroupData {
  key: RelationGroupKey;
  title: string;
  items: IndexEdgeItem[];
}

function compareNames(left: string, right: string): number {
  return left.localeCompare(right, "zh-Hans-CN");
}

function sortItems(items: IndexEdgeItem[]): IndexEdgeItem[] {
  return [...items].sort((left, right) => {
    const typeDelta =
      NODE_TYPE_ORDER.indexOf(left.other.type) - NODE_TYPE_ORDER.indexOf(right.other.type);
    if (typeDelta !== 0) return typeDelta;
    if (right.edge.weight !== left.edge.weight) return right.edge.weight - left.edge.weight;
    return compareNames(left.other.canonical_name, right.other.canonical_name);
  });
}

const DIRECTED_RELATIONS = RELATION_ORDER.filter(
  (relation) => !isSymmetricRelation(relation),
);

export function buildRelationGroups(params: {
  anchorId: string;
  nodeById: Map<string, CoreNode>;
  strongEdges: CoreEdge[];
  coEdges: CoEdge[];
}): RelationGroupData[] {
  const { anchorId, nodeById, strongEdges, coEdges } = params;
  const buckets = new Map<string, IndexEdgeItem[]>();
  const push = (key: string, item: IndexEdgeItem) => {
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  };

  const resolve = (id: string): CoreNode | null => nodeById.get(id) ?? null;

  for (const edge of strongEdges) {
    if (!touchNode(edge, anchorId)) continue;
    const other = resolve(otherEnd(edge, anchorId));
    if (!other) continue;
    const item: IndexEdgeItem = {
      key: edgeKey(edge),
      relation: edge.relation,
      direction: "out",
      edge,
      other,
    };
    if (edge.relation === "CONTRASTS_WITH") {
      item.direction = "none";
      push("none:CONTRASTS_WITH", item);
    } else if (edge.source_id === anchorId) {
      push(`out:${edge.relation}`, item);
    } else {
      item.direction = "in";
      push(`in:${edge.relation}`, item);
    }
  }

  for (const edge of coEdges) {
    if (!touchNode(edge, anchorId)) continue;
    const other = resolve(otherEnd(edge, anchorId));
    if (!other) continue;
    push("none:CO_OCCURS_WITH", {
      key: symmetricEdgeKey(edge),
      relation: edge.relation,
      direction: "none",
      edge,
      other,
    });
  }

  const specs: Array<{ key: string; title: string }> = [
    ...DIRECTED_RELATIONS.map((relation) => ({
      key: `out:${relation}`,
      title: RELATION_ZH[relation],
    })),
    ...DIRECTED_RELATIONS.map((relation) => ({
      key: `in:${relation}`,
      title: PASSIVE_RELATION_ZH[relation] ?? RELATION_ZH[relation],
    })),
    { key: "none:CONTRASTS_WITH", title: RELATION_ZH.CONTRASTS_WITH },
    { key: "none:CO_OCCURS_WITH", title: RELATION_ZH.CO_OCCURS_WITH },
  ];

  return specs
    .map((spec) => ({
      key: spec.key,
      title: spec.title,
      items: sortItems(buckets.get(spec.key) ?? []),
    }))
    .filter((group) => group.items.length > 0);
}

export function compareVerseCode(left: string, right: string): number {
  const [leftChapter, leftVerse] = left.split(".").map(Number);
  const [rightChapter, rightVerse] = right.split(".").map(Number);
  if (leftChapter !== rightChapter) return leftChapter - rightChapter;
  return (leftVerse || 0) - (rightVerse || 0);
}

export function sortVerses(verses: Verse[]): Verse[] {
  return [...verses].sort(
    (left, right) =>
      left.chapter_num - right.chapter_num || compareVerseCode(left.code, right.code),
  );
}

export function findVerseEdge(
  edges: CoreEdge[],
  anchorId: string,
  targetId: string,
  relation: Relation,
  direction: Direction | null,
): CoreEdge | null {
  for (const edge of edges) {
    if (edge.relation !== relation) continue;
    if (isSymmetricRelation(relation)) {
      const pairMatches =
        (edge.source_id === anchorId && edge.target_id === targetId) ||
        (edge.source_id === targetId && edge.target_id === anchorId);
      if (pairMatches) return edge;
      continue;
    }
    if (direction === "in") {
      if (edge.source_id === targetId && edge.target_id === anchorId) return edge;
    } else if (edge.source_id === anchorId && edge.target_id === targetId) {
      return edge;
    }
  }
  return null;
}
