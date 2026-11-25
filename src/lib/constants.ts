import type { Direction, NodeType, Relation } from "../types/data";

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  person: "人物",
  virtue: "德性",
  vice: "恶性",
  persona: "人格",
  institution: "制度",
  office: "官职",
  polity: "邦国",
  role: "角色",
};

export const NODE_TYPE_ORDER: NodeType[] = [
  "person",
  "virtue",
  "vice",
  "persona",
  "institution",
  "office",
  "polity",
  "role",
];

export const STRONG_RELATIONS: Relation[] = [
  "PRAISES",
  "CRITICIZES",
  "TEACHES",
  "ADVOCATES",
  "WARNS_AGAINST",
  "CONTAINS",
  "CONTRASTS_WITH",
];

export const RELATION_ORDER: Relation[] = [
  "PRAISES",
  "CRITICIZES",
  "TEACHES",
  "ADVOCATES",
  "WARNS_AGAINST",
  "CONTAINS",
  "CONTRASTS_WITH",
  "CO_OCCURS_WITH",
];

export const RELATION_ZH: Record<Relation, string> = {
  PRAISES: "赞美",
  CRITICIZES: "批评",
  TEACHES: "品评",
  ADVOCATES: "倡导",
  WARNS_AGAINST: "警戒",
  CONTAINS: "包含",
  CONTRASTS_WITH: "对立",
  CO_OCCURS_WITH: "共现",
};

export const PASSIVE_RELATION_ZH: Partial<Record<Relation, string>> = {
  PRAISES: "受赞",
  CRITICIZES: "受批",
  TEACHES: "受评",
  ADVOCATES: "见倡",
  WARNS_AGAINST: "见戒",
  CONTAINS: "隶属",
};

export const SYMMETRIC_RELATIONS: Relation[] = [
  "CONTRASTS_WITH",
  "CO_OCCURS_WITH",
];

export const TAB1_RELATIONS: Relation[] = ["PRAISES", "CRITICIZES", "TEACHES"];
export const TAB1_DEFAULT_RELATIONS: Relation[] = ["PRAISES"];

export const NODE_TYPE_COLOR: Record<NodeType, string> = {
  person: "#B33A2B",
  virtue: "#3E6B8A",
  vice: "#8A6D3B",
  persona: "#4F7A63",
  institution: "#7C6F63",
  office: "#7C6F63",
  polity: "#7C6F63",
  role: "#7C6F63",
};

export const PAD_ANGLE = 0.01;

/**
 * 为人物节点生成稳定、彼此可区分的颜色。
 * 使用节点 id 的哈希决定色相，避免切换筛选后颜色跳变。
 */
export function personColor(id: string): string {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export function isSymmetricRelation(relation: Relation): boolean {
  return SYMMETRIC_RELATIONS.includes(relation);
}

export function relationLabel(
  relation: Relation,
  direction: Direction | null,
): string {
  if (direction === "in") {
    return PASSIVE_RELATION_ZH[relation] ?? RELATION_ZH[relation];
  }
  return RELATION_ZH[relation];
}
