export type NodeType =
  | "person"
  | "virtue"
  | "vice"
  | "persona"
  | "institution"
  | "office"
  | "polity"
  | "role";

export type Relation =
  | "PRAISES"
  | "CRITICIZES"
  | "TEACHES"
  | "ADVOCATES"
  | "WARNS_AGAINST"
  | "CONTAINS"
  | "CONTRASTS_WITH"
  | "CO_OCCURS_WITH";

export type Direction = "out" | "in";

export interface CoreNode {
  id: string;
  type: NodeType;
  canonical_name: string;
  source_refs: string[];
  alias?: string[];
}

export interface DetailNode extends CoreNode {
  gloss: string;
  commentary: string;
}

export interface CoreEdge {
  source_id: string;
  target_id: string;
  relation: Relation;
  relation_zh: string;
  directed: boolean;
  share_refs: string[];
  weight: number;
  source?: string;
}

export type CoEdge = CoreEdge;

export interface Verse {
  id: string;
  code: string;
  chapter_num: number;
  chapter_title: string;
  verse: string;
  gloss: string;
  annotation: string;
  commentary: string;
  critique: string;
}

export interface CoreGraphPackage {
  nodes: CoreNode[];
  edges: CoreEdge[];
}

export interface CoEdgePackage {
  edges: CoEdge[];
}

export type NodeDetailMap = Record<string, DetailNode>;

export interface MetaPackage {
  version: number;
  generatedAt: string;
  source: {
    nodesSha256: string;
    edgesSha256: string;
    versesSha256: string;
  };
  counts: Record<string, number>;
  relationCounts: Record<string, number>;
  weightRule: string;
  note: string;
}
