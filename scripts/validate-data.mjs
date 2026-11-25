import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "src", "data");
const OUTPUT_DIR = path.join(ROOT, "public", "data");

const NODE_TYPES = new Set([
  "person",
  "virtue",
  "vice",
  "persona",
  "institution",
  "office",
  "polity",
  "role",
]);

const VISUAL_TYPES = new Set(["person", "virtue", "vice", "persona"]);

const STRONG_RELATIONS = new Set([
  "PRAISES",
  "CRITICIZES",
  "TEACHES",
  "ADVOCATES",
  "WARNS_AGAINST",
  "CONTAINS",
  "CONTRASTS_WITH",
]);

const RELATION_ZH = Object.freeze({
  PRAISES: "赞美",
  CRITICIZES: "批评",
  TEACHES: "品评",
  ADVOCATES: "倡导",
  WARNS_AGAINST: "警戒",
  CONTAINS: "包含",
  CONTRASTS_WITH: "对立",
  CO_OCCURS_WITH: "共现",
});

const EDGE_RELATIONS = new Set(Object.keys(RELATION_ZH));
const SYMMETRIC_RELATIONS = new Set(["CONTRASTS_WITH", "CO_OCCURS_WITH"]);

/**
 * 关系规则说明。校验不比较固定总数，只检查数据对象之间的关系是否成立。
 * 运行 `node scripts/validate-data.mjs --rules` 可打印本表。
 */
const RULES = [
  {
    id: "R01",
    title: "源文件可读取",
    description: "src/data 下的 nodes.json、edges.json、verses.json 必须存在且可解析。",
  },
  {
    id: "R02",
    title: "章句结构",
    description:
      "每章必须有唯一且非空的 id 与 code、1 到 20 的 chapter_num、非空 chapter_title 与 verse；四类注疏字段必须是字符串。",
  },
  {
    id: "R03",
    title: "节点结构",
    description:
      "节点必须包含 id、type、canonical_name、source_refs、gloss、commentary；不得包含 weight、degree 或未知字段。",
  },
  {
    id: "R04",
    title: "节点 ID 唯一",
    description: "所有节点的 id 不得重复。",
  },
  {
    id: "R05",
    title: "节点类型",
    description: "节点 type 必须是 8 类之一：person、virtue、vice、persona、institution、office、polity、role。",
  },
  {
    id: "R06",
    title: "节点出处",
    description:
      "每个节点的 source_refs 必须是非空字符串数组，元素不得重复，且每个元素都必须指向存在的章句 code。",
  },
  {
    id: "R07",
    title: "节点别名",
    description: "alias 可选；若存在，必须是非空字符串数组，元素不得重复。",
  },
  {
    id: "R08",
    title: "边结构",
    description:
      "边必须包含 source_id、target_id、relation、directed、share_refs；不得包含 weight、relation_zh 或未知字段。",
  },
  {
    id: "R09",
    title: "边关系与方向",
    description:
      "relation 必须是 8 类之一；CONTRASTS_WITH 与 CO_OCCURS_WITH 的 directed 必须为 false，其余关系必须为 true。",
  },
  {
    id: "R10",
    title: "边端点",
    description: "source_id 与 target_id 必须存在于 nodes.json，且两端不得是同一个节点。",
  },
  {
    id: "R11",
    title: "边共享章句",
    description:
      "每条边的 share_refs 必须是非空字符串数组，元素不得重复，且每个元素都必须指向存在的章句 code。",
  },
  {
    id: "R12",
    title: "强边端点类型",
    description:
      "强语义边两端必须是可视类型节点：person、virtue、vice、persona。否则核心包会出现缺失端点的边。",
  },
  {
    id: "R13",
    title: "边键唯一",
    description: "source_id、relation、target_id 组成的三元组不得重复。",
  },
  {
    id: "R14",
    title: "无孤儿节点",
    description: "每个节点必须至少被一条边引用；只存在于 nodes.json 而不出现在任何边中的节点视为孤儿。",
  },
  {
    id: "R15",
    title: "核心包节点集合",
    description:
      "core-graph.nodes 必须等于源数据中所有可视类型节点的集合；不得重复，不得包含 gloss、commentary、weight、degree。",
  },
  {
    id: "R16",
    title: "核心包边集合",
    description:
      "core-graph.edges 必须等于源数据中所有强语义边；share_refs、weight、relation_zh、directed 与两端必须与源数据一致；不得含未知字段；两端必须存在于 core-graph.nodes。",
  },
  {
    id: "R17",
    title: "共现包边集合",
    description:
      "co-edges.edges 必须等于源数据中所有 CO_OCCURS_WITH 边的集合；weight、relation_zh、directed 必须正确；两端必须存在于 node-details。",
  },
  {
    id: "R18",
    title: "详情包集合",
    description:
      "node-details 的键集合必须等于源节点集合；每个条目的基础字段、gloss、commentary 必须与源数据一致；不得包含 weight、degree。",
  },
  {
    id: "R19",
    title: "章句包一致",
    description: "public/data/verses.json 必须与 src/data/verses.json 完全一致。",
  },
  {
    id: "R20",
    title: "计数由数据派生",
    description:
      "meta.counts 必须等于根据源数据与生成包实际计算出的数量：nodes、edges、strongEdges、coOccurrenceEdges、verses、coreGraphNodes、coreNodes、extendedNodes。",
  },
  {
    id: "R21",
    title: "关系计数由数据派生",
    description: "meta.relationCounts 必须等于源数据的实际关系分布，并且只包含 8 类关系。",
  },
  {
    id: "R22",
    title: "源文件哈希",
    description: "meta.source 中的三个 SHA-256 必须与当前 src/data 源文件一致。",
  },
  {
    id: "R23",
    title: "包完整性",
    description:
      "源边必须且只能出现在 core-graph 或 co-edges 之一；源节点必须全部出现在 node-details；可视节点必须全部出现在 core-graph。",
  },
  {
    id: "R24",
    title: "派生权重一致",
    description: "所有生成边的 weight 必须等于 share_refs.length 且大于 0；校验不依赖任何固定总数。",
  },
];

const RULE_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

let failures = 0;

function check(condition, ruleId, detail) {
  if (condition) return;
  failures += 1;
  const rule = RULE_BY_ID.get(ruleId);
  const title = rule ? rule.title : "未知规则";
  console.error(`FAIL [${ruleId}] ${title}: ${detail}`);
}

function readJson(file, ruleId, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    check(false, ruleId, `无法读取 ${label}: ${error.message}`);
    return null;
  }
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function countBy(items, key) {
  const result = {};
  for (const item of items) {
    result[item[key]] = (result[item[key]] || 0) + 1;
  }
  return result;
}

function printRules() {
  console.log("数据校验规则（关系规则，不写死总数）：");
  for (const rule of RULES) {
    console.log(`  ${rule.id} ${rule.title}：${rule.description}`);
  }
}

function validateSource() {
  const nodes = readJson(path.join(SOURCE_DIR, "nodes.json"), "R01", "src/data/nodes.json");
  const edges = readJson(path.join(SOURCE_DIR, "edges.json"), "R01", "src/data/edges.json");
  const verses = readJson(path.join(SOURCE_DIR, "verses.json"), "R01", "src/data/verses.json");
  if (!nodes || !edges || !verses) return null;

  const verseCodes = new Set();
  const verseIds = new Set();
  const allowedVerseKeys = new Set([
    "id",
    "code",
    "chapter_num",
    "chapter_title",
    "verse",
    "gloss",
    "annotation",
    "commentary",
    "critique",
  ]);

  for (const verse of verses) {
    check(typeof verse.id === "string" && verse.id.length > 0, "R02", "章句 id 必须是非空字符串");
    check(!verseIds.has(verse.id), "R02", `章句 id 重复: ${verse.id}`);
    verseIds.add(verse.id);
    check(typeof verse.code === "string" && verse.code.length > 0, "R02", "章句 code 必须是非空字符串");
    check(!verseCodes.has(verse.code), "R02", `章句 code 重复: ${verse.code}`);
    verseCodes.add(verse.code);
    check(
      Number.isInteger(verse.chapter_num) && verse.chapter_num >= 1 && verse.chapter_num <= 20,
      "R02",
      `章句 ${verse.code} 的 chapter_num 必须是 1 到 20 的整数`,
    );
    check(
      typeof verse.chapter_title === "string" && verse.chapter_title.length > 0,
      "R02",
      `章句 ${verse.code} 缺少 chapter_title`,
    );
    check(
      typeof verse.verse === "string" && verse.verse.length > 0,
      "R02",
      `章句 ${verse.code} 缺少 verse 原文`,
    );
    for (const field of ["gloss", "annotation", "commentary", "critique"]) {
      check(
        typeof verse[field] === "string",
        "R02",
        `章句 ${verse.code} 的 ${field} 必须是字符串`,
      );
    }
    for (const key of Object.keys(verse)) {
      check(allowedVerseKeys.has(key), "R02", `章句 ${verse.code} 出现未知字段: ${key}`);
    }
  }

  const nodeIds = new Set();
  const nodeTypes = new Map();
  const nodeById = new Map();
  const allowedNodeKeys = new Set([
    "id",
    "type",
    "canonical_name",
    "source_refs",
    "gloss",
    "commentary",
    "alias",
  ]);

  for (const node of nodes) {
    check(typeof node.id === "string" && node.id.length > 0, "R03", "节点 id 必须是非空字符串");
    check(!nodeIds.has(node.id), "R04", `节点 id 重复: ${node.id}`);
    nodeIds.add(node.id);
    nodeTypes.set(node.id, node.type);
    nodeById.set(node.id, node);
    check(NODE_TYPES.has(node.type), "R05", `节点 ${node.id} 的类型未知: ${node.type}`);
    check(
      typeof node.canonical_name === "string" && node.canonical_name.length > 0,
      "R03",
      `节点 ${node.id} 缺少 canonical_name`,
    );
    check(typeof node.gloss === "string", "R03", `节点 ${node.id} 的 gloss 必须是字符串`);
    check(
      typeof node.commentary === "string",
      "R03",
      `节点 ${node.id} 的 commentary 必须是字符串`,
    );
    for (const key of Object.keys(node)) {
      check(allowedNodeKeys.has(key), "R03", `节点 ${node.id} 出现未知字段: ${key}`);
    }
    check(!("weight" in node), "R03", `节点 ${node.id} 不得包含 weight`);
    check(!("degree" in node), "R03", `节点 ${node.id} 不得包含 degree`);

    check(Array.isArray(node.source_refs), "R06", `节点 ${node.id} 的 source_refs 必须是数组`);
    if (Array.isArray(node.source_refs)) {
      check(node.source_refs.length > 0, "R06", `节点 ${node.id} 的 source_refs 不得为空`);
      const seen = new Set();
      for (const code of node.source_refs) {
        check(typeof code === "string" && code.length > 0, "R06", `节点 ${node.id} 的 source_refs 含非法值`);
        check(!seen.has(code), "R06", `节点 ${node.id} 的 source_refs 含重复项: ${code}`);
        seen.add(code);
        check(verseCodes.has(code), "R06", `节点 ${node.id} 的 source_refs 悬空: ${code}`);
      }
    }

    if (node.alias !== undefined) {
      check(Array.isArray(node.alias), "R07", `节点 ${node.id} 的 alias 必须是数组`);
      if (Array.isArray(node.alias)) {
        const seen = new Set();
        for (const alias of node.alias) {
          check(typeof alias === "string" && alias.length > 0, "R07", `节点 ${node.id} 的 alias 含非法值`);
          check(!seen.has(alias), "R07", `节点 ${node.id} 的 alias 含重复项: ${alias}`);
          seen.add(alias);
        }
      }
    }
  }

  const edgeKeys = new Set();
  const used = new Set();
  const allowedEdgeKeys = new Set([
    "source_id",
    "target_id",
    "relation",
    "directed",
    "share_refs",
    "source",
  ]);

  for (const edge of edges) {
    for (const key of Object.keys(edge)) {
      check(allowedEdgeKeys.has(key), "R08", `边 ${edge.source_id} 出现未知字段: ${key}`);
    }
    check(!("weight" in edge), "R08", `边 ${edge.source_id} 不得包含 weight`);
    check(!("relation_zh" in edge), "R08", `边 ${edge.source_id} 不得包含 relation_zh`);
    check(typeof edge.source_id === "string", "R08", "边 source_id 必须是字符串");
    check(typeof edge.target_id === "string", "R08", "边 target_id 必须是字符串");
    check(typeof edge.directed === "boolean", "R08", "边 directed 必须是布尔值");
    check(Array.isArray(edge.share_refs), "R08", `边 ${edge.source_id} 的 share_refs 必须是数组`);
    check(EDGE_RELATIONS.has(edge.relation), "R09", `未知关系: ${edge.relation}`);
    if (SYMMETRIC_RELATIONS.has(edge.relation)) {
      check(edge.directed === false, "R09", `对称关系 directed 必须为 false: ${edge.relation}`);
    } else {
      check(edge.directed === true, "R09", `有向关系 directed 必须为 true: ${edge.relation}`);
    }
    if (edge.source !== undefined) {
      check(typeof edge.source === "string", "R08", `边 ${edge.source_id} 的 source 必须是字符串`);
    }

    check(nodeIds.has(edge.source_id), "R10", `边 source_id 悬空: ${edge.source_id}`);
    check(nodeIds.has(edge.target_id), "R10", `边 target_id 悬空: ${edge.target_id}`);
    check(edge.source_id !== edge.target_id, "R10", `边两端不得相同: ${edge.source_id}`);

    if (Array.isArray(edge.share_refs)) {
      check(edge.share_refs.length > 0, "R11", `边 ${edge.source_id} 的 share_refs 不得为空`);
      const seen = new Set();
      for (const code of edge.share_refs) {
        check(typeof code === "string" && code.length > 0, "R11", `边 ${edge.source_id} 的 share_refs 含非法值`);
        check(!seen.has(code), "R11", `边 ${edge.source_id} 的 share_refs 含重复项: ${code}`);
        seen.add(code);
        check(verseCodes.has(code), "R11", `边 share_refs 悬空: ${code}`);
      }
    }

    if (STRONG_RELATIONS.has(edge.relation)) {
      const sourceType = nodeTypes.get(edge.source_id);
      const targetType = nodeTypes.get(edge.target_id);
      check(
        VISUAL_TYPES.has(sourceType),
        "R12",
        `强边源节点不是可视类型: ${edge.source_id} (${sourceType})`,
      );
      check(
        VISUAL_TYPES.has(targetType),
        "R12",
        `强边目标节点不是可视类型: ${edge.target_id} (${targetType})`,
      );
    }

    const key = `${edge.source_id}|${edge.relation}|${edge.target_id}`;
    check(!edgeKeys.has(key), "R13", `重复边: ${key}`);
    edgeKeys.add(key);
    used.add(edge.source_id);
    used.add(edge.target_id);
  }

  for (const node of nodes) {
    check(used.has(node.id), "R14", `孤儿节点: ${node.id}`);
  }

  return { nodes, edges, verses, verseCodes, nodeIds, nodeTypes, nodeById, edgeKeys, used };
}

function edgeKey(edge) {
  return `${edge.source_id}|${edge.relation}|${edge.target_id}`;
}

function sameArray(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validatePackages(source) {
  const coreGraph = readJson(path.join(OUTPUT_DIR, "core-graph.json"), "R15", "public/data/core-graph.json");
  const nodeDetails = readJson(path.join(OUTPUT_DIR, "node-details.json"), "R18", "public/data/node-details.json");
  const coPackage = readJson(path.join(OUTPUT_DIR, "co-edges.json"), "R17", "public/data/co-edges.json");
  const verses = readJson(path.join(OUTPUT_DIR, "verses.json"), "R19", "public/data/verses.json");
  const meta = readJson(path.join(OUTPUT_DIR, "meta.json"), "R20", "public/data/meta.json");
  if (!coreGraph || !nodeDetails || !coPackage || !verses || !meta) return;

  const sourceById = new Map(source.nodes.map((node) => [node.id, node]));

  check(Array.isArray(coreGraph.nodes), "R15", "core-graph.nodes 必须是数组");
  check(Array.isArray(coreGraph.edges), "R16", "core-graph.edges 必须是数组");
  if (!Array.isArray(coreGraph.nodes) || !Array.isArray(coreGraph.edges)) return;

  const coreNodeIds = new Set();
  const allowedCoreNodeKeys = new Set([
    "id",
    "type",
    "canonical_name",
    "source_refs",
    "alias",
  ]);
  const allowedGeneratedEdgeKeys = new Set([
    "source_id",
    "target_id",
    "relation",
    "relation_zh",
    "directed",
    "share_refs",
    "weight",
    "source",
  ]);

  for (const node of coreGraph.nodes) {
    check(typeof node.id === "string" && node.id.length > 0, "R15", "core-graph 节点缺少 id");
    check(!coreNodeIds.has(node.id), "R15", `core-graph 节点重复: ${node.id}`);
    coreNodeIds.add(node.id);
    const original = sourceById.get(node.id);
    check(!!original, "R15", `core-graph 节点不在源数据中: ${node.id}`);
    check(VISUAL_TYPES.has(node.type), "R15", `core-graph 节点不是可视类型: ${node.id}`);
    check(!("gloss" in node), "R15", `core-graph 节点不得包含 gloss: ${node.id}`);
    check(!("commentary" in node), "R15", `core-graph 节点不得包含 commentary: ${node.id}`);
    check(!("weight" in node), "R15", `core-graph 节点不得包含 weight: ${node.id}`);
    check(!("degree" in node), "R15", `core-graph 节点不得包含 degree: ${node.id}`);
    for (const key of Object.keys(node)) {
      check(allowedCoreNodeKeys.has(key), "R15", `core-graph 节点出现未知字段 ${key}: ${node.id}`);
    }
    if (original) {
      check(node.type === original.type, "R15", `core-graph 节点 type 与源不一致: ${node.id}`);
      check(
        node.canonical_name === original.canonical_name,
        "R15",
        `core-graph 节点名称与源不一致: ${node.id}`,
      );
      check(
        sameArray(node.source_refs, original.source_refs),
        "R15",
        `core-graph 节点 source_refs 与源不一致: ${node.id}`,
      );
      check(
        sameArray(node.alias ?? null, original.alias ?? null),
        "R15",
        `core-graph 节点 alias 与源不一致: ${node.id}`,
      );
    }
  }

  const visualIds = new Set(
    source.nodes.filter((node) => VISUAL_TYPES.has(node.type)).map((node) => node.id),
  );
  check(
    coreNodeIds.size === visualIds.size && [...visualIds].every((id) => coreNodeIds.has(id)),
    "R15",
    "core-graph 节点集合必须等于源数据中的全部可视类型节点",
  );

  const strongEdges = source.edges.filter((edge) => STRONG_RELATIONS.has(edge.relation));
  const strongKeys = new Set(strongEdges.map(edgeKey));
  const strongByKey = new Map(strongEdges.map((edge) => [edgeKey(edge), edge]));
  const coreEdgeKeys = new Set();

  for (const edge of coreGraph.edges) {
    const key = edgeKey(edge);
    check(!coreEdgeKeys.has(key), "R16", `core-graph 边重复: ${key}`);
    coreEdgeKeys.add(key);
    check(strongKeys.has(key), "R16", `core-graph 出现非源强边: ${key}`);
    for (const field of Object.keys(edge)) {
      check(
        allowedGeneratedEdgeKeys.has(field),
        "R16",
        `core-graph 边出现未知字段 ${field}: ${key}`,
      );
    }
    const sourceEdge = strongByKey.get(key);
    if (sourceEdge) {
      check(
        sameArray(edge.share_refs, sourceEdge.share_refs),
        "R16",
        `core-graph 边 share_refs 与源不一致: ${key}`,
      );
      check(
        edge.directed === sourceEdge.directed,
        "R16",
        `core-graph 边 directed 与源不一致: ${key}`,
      );
    }
    check(EDGE_RELATIONS.has(edge.relation), "R16", `core-graph 出现未知关系: ${edge.relation}`);
    check(
      Array.isArray(edge.share_refs) && edge.share_refs.length > 0,
      "R24",
      `core-graph 边的 share_refs 不得为空: ${key}`,
    );
    check(
      typeof edge.weight === "number" && edge.weight > 0 && edge.weight === (edge.share_refs || []).length,
      "R24",
      `core-graph 边 weight 必须等于 share_refs.length 且大于 0: ${key}`,
    );
    check(
      edge.relation_zh === RELATION_ZH[edge.relation],
      "R16",
      `core-graph 边 relation_zh 不符合映射: ${edge.relation}`,
    );
    check(
      edge.directed === !SYMMETRIC_RELATIONS.has(edge.relation),
      "R16",
      `core-graph 边 directed 与关系不一致: ${edge.relation}`,
    );
    check(coreNodeIds.has(edge.source_id), "R16", `core-graph 边 source 不在节点集合中: ${edge.source_id}`);
    check(coreNodeIds.has(edge.target_id), "R16", `core-graph 边 target 不在节点集合中: ${edge.target_id}`);
    for (const code of edge.share_refs || []) {
      check(source.verseCodes.has(code), "R16", `core-graph 边 share_refs 悬空: ${code}`);
    }
  }

  check(
    coreEdgeKeys.size === strongKeys.size && [...strongKeys].every((key) => coreEdgeKeys.has(key)),
    "R16",
    "core-graph 边集合必须等于源数据中的全部强语义边",
  );

  check(
    nodeDetails !== null && typeof nodeDetails === "object" && !Array.isArray(nodeDetails),
    "R18",
    "node-details 必须是对象映射",
  );
  check(
    coPackage !== null && typeof coPackage === "object" && Array.isArray(coPackage.edges),
    "R17",
    "co-edges 必须包含 edges 数组",
  );
  check(
    meta !== null && typeof meta === "object" && !Array.isArray(meta),
    "R20",
    "meta 必须是对象",
  );
  if (
    nodeDetails === null ||
    typeof nodeDetails !== "object" ||
    Array.isArray(nodeDetails) ||
    coPackage === null ||
    typeof coPackage !== "object" ||
    !Array.isArray(coPackage.edges) ||
    meta === null ||
    typeof meta !== "object" ||
    Array.isArray(meta)
  ) {
    return;
  }

  const allowedDetailKeys = new Set([
    "id",
    "type",
    "canonical_name",
    "source_refs",
    "gloss",
    "commentary",
    "alias",
  ]);
  const detailIds = new Set(Object.keys(nodeDetails));

  for (const node of source.nodes) {
    const detail = nodeDetails[node.id];
    check(!!detail, "R18", `node-details 缺少节点: ${node.id}`);
    if (!detail) continue;
    check(detail.id === node.id, "R18", `node-details 的 id 不一致: ${node.id}`);
    check(detail.type === node.type, "R18", `node-details 的 type 不一致: ${node.id}`);
    check(
      detail.canonical_name === node.canonical_name,
      "R18",
      `node-details 的 canonical_name 不一致: ${node.id}`,
    );
    check(
      sameArray(detail.source_refs, node.source_refs),
      "R18",
      `node-details 的 source_refs 不一致: ${node.id}`,
    );
    check(detail.gloss === node.gloss, "R18", `node-details 的 gloss 不一致: ${node.id}`);
    check(
      detail.commentary === node.commentary,
      "R18",
      `node-details 的 commentary 不一致: ${node.id}`,
    );
    check(
      sameArray(detail.alias ?? null, node.alias ?? null),
      "R18",
      `node-details 的 alias 不一致: ${node.id}`,
    );
    check(!("weight" in detail), "R18", `node-details 不得包含 weight: ${node.id}`);
    check(!("degree" in detail), "R18", `node-details 不得包含 degree: ${node.id}`);
    for (const key of Object.keys(detail)) {
      check(allowedDetailKeys.has(key), "R18", `node-details 出现未知字段 ${key}: ${node.id}`);
    }
  }

  check(
    detailIds.size === source.nodeIds.size && [...source.nodeIds].every((id) => detailIds.has(id)),
    "R18",
    "node-details 键集合必须等于源数据全部节点",
  );

  const coEdges = source.edges.filter((edge) => edge.relation === "CO_OCCURS_WITH");
  const coKeys = new Set(coEdges.map(edgeKey));
  const coByKey = new Map(coEdges.map((edge) => [edgeKey(edge), edge]));
  const packageCoKeys = new Set();

  for (const edge of coPackage.edges) {
    const key = edgeKey(edge);
    check(!packageCoKeys.has(key), "R17", `co-edges 边重复: ${key}`);
    packageCoKeys.add(key);
    check(coKeys.has(key), "R17", `co-edges 出现非源共现边: ${key}`);
    for (const field of Object.keys(edge)) {
      check(
        allowedGeneratedEdgeKeys.has(field),
        "R17",
        `co-edges 边出现未知字段 ${field}: ${key}`,
      );
    }
    const sourceEdge = coByKey.get(key);
    if (sourceEdge) {
      check(
        sameArray(edge.share_refs, sourceEdge.share_refs),
        "R17",
        `co-edges 边 share_refs 与源不一致: ${key}`,
      );
      check(
        edge.directed === sourceEdge.directed,
        "R17",
        `co-edges 边 directed 与源不一致: ${key}`,
      );
    }
    check(edge.relation === "CO_OCCURS_WITH", "R17", `co-edges 出现非共现关系: ${edge.relation}`);
    check(
      Array.isArray(edge.share_refs) && edge.share_refs.length > 0,
      "R24",
      `co-edges 边的 share_refs 不得为空: ${key}`,
    );
    check(
      typeof edge.weight === "number" && edge.weight > 0 && edge.weight === (edge.share_refs || []).length,
      "R24",
      `co-edges 边 weight 必须等于 share_refs.length 且大于 0: ${key}`,
    );
    check(edge.relation_zh === RELATION_ZH[edge.relation], "R17", `co-edges relation_zh 不符合映射: ${key}`);
    check(edge.directed === false, "R17", `co-edges 的 directed 必须为 false: ${key}`);
    check(detailIds.has(edge.source_id), "R17", `co-edges 边 source 不在详情包中: ${edge.source_id}`);
    check(detailIds.has(edge.target_id), "R17", `co-edges 边 target 不在详情包中: ${edge.target_id}`);
    for (const code of edge.share_refs || []) {
      check(source.verseCodes.has(code), "R17", `co-edges 边 share_refs 悬空: ${code}`);
    }
  }

  check(
    packageCoKeys.size === coKeys.size && [...coKeys].every((key) => packageCoKeys.has(key)),
    "R17",
    "co-edges 边集合必须等于源数据全部共现边",
  );

  check(
    JSON.stringify(verses) === JSON.stringify(source.verses),
    "R19",
    "public/data/verses.json 必须与 src/data/verses.json 完全一致",
  );

  const coreNodeIdSet = new Set();
  for (const edge of strongEdges) {
    coreNodeIdSet.add(edge.source_id);
    coreNodeIdSet.add(edge.target_id);
  }

  const expectedCounts = {
    nodes: source.nodes.length,
    edges: source.edges.length,
    strongEdges: strongEdges.length,
    coOccurrenceEdges: coEdges.length,
    verses: source.verses.length,
    coreGraphNodes: visualIds.size,
    coreNodes: coreNodeIdSet.size,
    extendedNodes: source.nodes.length - coreNodeIdSet.size,
  };

  check(meta.counts !== null && typeof meta.counts === "object", "R20", "meta.counts 必须是对象");
  if (meta.counts && typeof meta.counts === "object") {
    for (const [key, expected] of Object.entries(expectedCounts)) {
      check(
        meta.counts[key] === expected,
        "R20",
        `meta.counts.${key} 应为 ${expected}，实际 ${meta.counts[key]}`,
      );
    }
  }

  const actualRelationCounts = countBy(source.edges, "relation");
  check(
    meta.relationCounts !== null && typeof meta.relationCounts === "object",
    "R21",
    "meta.relationCounts 必须是对象",
  );
  if (meta.relationCounts && typeof meta.relationCounts === "object") {
    for (const relation of EDGE_RELATIONS) {
      const expected = actualRelationCounts[relation] || 0;
      check(
        meta.relationCounts[relation] === expected,
        "R21",
        `meta.relationCounts.${relation} 应为 ${expected}，实际 ${meta.relationCounts[relation]}`,
      );
    }
    for (const relation of Object.keys(meta.relationCounts)) {
      check(EDGE_RELATIONS.has(relation), "R21", `meta.relationCounts 出现未知关系: ${relation}`);
    }
  }

  check(meta.source !== null && typeof meta.source === "object", "R22", "meta.source 必须是对象");
  if (meta.source && typeof meta.source === "object") {
    check(
      meta.source.nodesSha256 === sha256(path.join(SOURCE_DIR, "nodes.json")),
      "R22",
      "meta.source.nodesSha256 与当前 nodes.json 不一致",
    );
    check(
      meta.source.edgesSha256 === sha256(path.join(SOURCE_DIR, "edges.json")),
      "R22",
      "meta.source.edgesSha256 与当前 edges.json 不一致",
    );
    check(
      meta.source.versesSha256 === sha256(path.join(SOURCE_DIR, "verses.json")),
      "R22",
      "meta.source.versesSha256 与当前 verses.json 不一致",
    );
  }

  const allSourceKeys = new Set(source.edges.map(edgeKey));
  const allPackageKeys = new Set([...coreEdgeKeys, ...packageCoKeys]);
  check(
    allPackageKeys.size === allSourceKeys.size &&
      [...allSourceKeys].every((key) => allPackageKeys.has(key)),
    "R23",
    "源边必须且只能出现在 core-graph 或 co-edges 中",
  );

  check(
    coreNodeIds.size === visualIds.size && [...visualIds].every((id) => coreNodeIds.has(id)),
    "R23",
    "可视节点必须全部出现在 core-graph 中",
  );
}

function main() {
  if (process.argv.includes("--rules")) {
    printRules();
    return;
  }

  const source = validateSource();
  if (source) validatePackages(source);

  if (failures > 0) {
    console.error(`数据校验失败：${failures} 项`);
    process.exit(1);
  }

  const strongEdges = source.edges.filter((edge) => STRONG_RELATIONS.has(edge.relation));
  const coEdges = source.edges.filter((edge) => edge.relation === "CO_OCCURS_WITH");
  const visualNodes = source.nodes.filter((node) => VISUAL_TYPES.has(node.type));
  const coreNodeIds = new Set();
  for (const edge of strongEdges) {
    coreNodeIds.add(edge.source_id);
    coreNodeIds.add(edge.target_id);
  }

  console.log("数据校验通过");
  console.log("校验方式：关系规则驱动，不比较任何固定总数。");
  console.log("当前数据快照（仅报告，不作为校验条件）：");
  console.log(`  节点 ${source.nodes.length}；可视节点 ${visualNodes.length}`);
  console.log(
    `  边 ${source.edges.length}；强语义边 ${strongEdges.length}；共现边 ${coEdges.length}`,
  );
  console.log(
    `  核心节点 ${coreNodeIds.size}；扩展节点 ${source.nodes.length - coreNodeIds.size}`,
  );
  console.log(`  章句 ${source.verses.length}`);
  console.log(`  关系分布 ${JSON.stringify(countBy(source.edges, "relation"))}`);
  console.log("规则 R01 到 R24；运行 node scripts/validate-data.mjs --rules 查看说明。");
}

main();

