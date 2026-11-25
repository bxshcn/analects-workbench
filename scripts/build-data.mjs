import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { buildSnapshot, packageStats, renderSnapshotMarkdown } from "./data-snapshot.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "src", "data");
const OUTPUT_DIR = path.join(ROOT, "public", "data");
const REPORT_DIR = path.join(ROOT, "scripts", "output");

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

/**
 * relation_zh 只在拆分阶段注入。源 edges.json 不包含该字段。
 * 主动/出向中文名以本表为准；被动/入向中文名由 UI 按关系与方向派生。
 */
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function validateSource(nodes, edges, verses) {
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
    assert(typeof verse.id === "string" && verse.id.length > 0, "verse.id 缺失");
    assert(!verseIds.has(verse.id), `verse.id 重复: ${verse.id}`);
    verseIds.add(verse.id);
    assert(typeof verse.code === "string" && verse.code.length > 0, "verse.code 缺失");
    assert(!verseCodes.has(verse.code), `verse.code 重复: ${verse.code}`);
    verseCodes.add(verse.code);
    assert(
      Number.isInteger(verse.chapter_num) && verse.chapter_num >= 1 && verse.chapter_num <= 20,
      `verse.chapter_num 必须是 1 到 20 的整数: ${verse.code}`,
    );
    assert(
      typeof verse.chapter_title === "string" && verse.chapter_title.length > 0,
      `verse.chapter_title 缺失: ${verse.code}`,
    );
    assert(
      typeof verse.verse === "string" && verse.verse.length > 0,
      `verse.verse 缺失: ${verse.code}`,
    );
    for (const field of ["gloss", "annotation", "commentary", "critique"]) {
      assert(typeof verse[field] === "string", `verse.${field} 必须是字符串: ${verse.code}`);
    }
    for (const key of Object.keys(verse)) {
      assert(allowedVerseKeys.has(key), `verse 出现未知字段 ${key}: ${verse.code}`);
    }
  }

  const nodeIds = new Set();
  const nodeTypes = new Map();
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
    assert(typeof node.id === "string" && node.id.length > 0, "node.id 缺失");
    assert(!nodeIds.has(node.id), `node.id 重复: ${node.id}`);
    nodeIds.add(node.id);
    nodeTypes.set(node.id, node.type);
    assert(NODE_TYPES.has(node.type), `未知节点类型: ${node.type}`);
    assert(
      typeof node.canonical_name === "string" && node.canonical_name.length > 0,
      `节点缺少 canonical_name: ${node.id}`,
    );
    assert(typeof node.gloss === "string", `节点 gloss 必须是字符串: ${node.id}`);
    assert(typeof node.commentary === "string", `节点 commentary 必须是字符串: ${node.id}`);
    for (const key of Object.keys(node)) {
      assert(allowedNodeKeys.has(key), `源 nodes.json 出现非法字段 ${key}: ${node.id}`);
    }
    assert(!("weight" in node), `源 nodes.json 不得包含 weight: ${node.id}`);
    assert(!("degree" in node), `源 nodes.json 不得包含 degree: ${node.id}`);
    assert(Array.isArray(node.source_refs), `source_refs 不是数组: ${node.id}`);
    assert(node.source_refs.length > 0, `source_refs 不得为空: ${node.id}`);
    const sourceRefSet = new Set();
    for (const code of node.source_refs) {
      assert(!sourceRefSet.has(code), `source_refs 含重复项: ${node.id} 的 ${code}`);
      sourceRefSet.add(code);
      assert(verseCodes.has(code), `source_refs 悬空: ${node.id} 的 ${code}`);
    }
    if (node.alias !== undefined) {
      assert(Array.isArray(node.alias), `alias 不是数组: ${node.id}`);
      assert(node.alias.length > 0, `alias 不得为空数组: ${node.id}`);
      const aliasSet = new Set();
      for (const alias of node.alias) {
        assert(typeof alias === "string" && alias.length > 0, `alias 非法: ${node.id}`);
        assert(!aliasSet.has(alias), `alias 含重复项: ${node.id} 的 ${alias}`);
        aliasSet.add(alias);
      }
    }
  }

  const allowedEdgeKeys = new Set([
    "source_id",
    "target_id",
    "relation",
    "directed",
    "share_refs",
    "source",
  ]);
  const edgeKeys = new Set();
  const used = new Set();

  for (const edge of edges) {
    assert(typeof edge.source_id === "string", "edge.source_id 缺失");
    assert(typeof edge.target_id === "string", "edge.target_id 缺失");
    assert(nodeIds.has(edge.source_id), `edge.source_id 悬空: ${edge.source_id}`);
    assert(nodeIds.has(edge.target_id), `edge.target_id 悬空: ${edge.target_id}`);
    assert(edge.source_id !== edge.target_id, `边两端不得相同: ${edge.source_id}`);
    assert(EDGE_RELATIONS.has(edge.relation), `未知关系类型: ${edge.relation}`);
    assert(!("weight" in edge), `源 edges.json 不得包含 weight: ${edge.source_id}`);
    assert(!("relation_zh" in edge), `源 edges.json 不得包含 relation_zh: ${edge.source_id}`);
    for (const key of Object.keys(edge)) {
      assert(allowedEdgeKeys.has(key), `源 edges.json 出现非法字段 ${key}: ${edge.source_id}`);
    }
    assert(typeof edge.directed === "boolean", `directed 不是布尔值: ${edge.source_id}`);
    if (SYMMETRIC_RELATIONS.has(edge.relation)) {
      assert(edge.directed === false, `对称关系 directed 必须为 false: ${edge.relation}`);
    } else {
      assert(edge.directed === true, `有向关系 directed 必须为 true: ${edge.relation}`);
    }
    assert(Array.isArray(edge.share_refs), `share_refs 不是数组: ${edge.source_id}`);
    assert(edge.share_refs.length > 0, `share_refs 不得为空: ${edge.source_id}`);
    const shareRefSet = new Set();
    for (const code of edge.share_refs) {
      assert(!shareRefSet.has(code), `share_refs 含重复项: ${edge.source_id} 的 ${code}`);
      shareRefSet.add(code);
      assert(verseCodes.has(code), `share_refs 悬空: ${edge.relation} 的 ${code}`);
    }
    if (STRONG_RELATIONS.has(edge.relation)) {
      assert(
        VISUAL_TYPES.has(nodeTypes.get(edge.source_id)),
        `强语义边源节点不是可视类型: ${edge.source_id}`,
      );
      assert(
        VISUAL_TYPES.has(nodeTypes.get(edge.target_id)),
        `强语义边目标节点不是可视类型: ${edge.target_id}`,
      );
    }
    if (edge.source !== undefined) {
      assert(typeof edge.source === "string", `edge.source 必须是字符串: ${edge.source_id}`);
    }
    const key = `${edge.source_id}|${edge.relation}|${edge.target_id}`;
    assert(!edgeKeys.has(key), `重复边: ${key}`);
    edgeKeys.add(key);
    used.add(edge.source_id);
    used.add(edge.target_id);
  }

  for (const node of nodes) {
    assert(used.has(node.id), `孤儿节点: ${node.id}`);
  }

  return { verseCodes, nodeIds };
}

function deriveEdge(edge) {
  const refs = Array.isArray(edge.share_refs) ? edge.share_refs : [];
  const weight = refs.length;
  return {
    source_id: edge.source_id,
    target_id: edge.target_id,
    relation: edge.relation,
    relation_zh: RELATION_ZH[edge.relation],
    directed: edge.directed,
    share_refs: refs,
    weight,
    ...(edge.source !== undefined ? { source: edge.source } : {}),
  };
}

function buildNodeStats(nodes, edges) {
  const stats = new Map();
  for (const node of nodes) {
    stats.set(node.id, {
      id: node.id,
      type: node.type,
      canonical_name: node.canonical_name,
      degree: 0,
      weight: 0,
      inWeight: 0,
      outWeight: 0,
      relationWeights: {},
      strongWeight: 0,
      coWeight: 0,
      isCore: false,
    });
  }

  for (const edge of edges) {
    const weight = edge.weight;
    const source = stats.get(edge.source_id);
    const target = stats.get(edge.target_id);
    source.degree += 1;
    target.degree += 1;
    source.weight += weight;
    target.weight += weight;
    source.outWeight += weight;
    target.inWeight += weight;
    source.relationWeights[edge.relation] =
      (source.relationWeights[edge.relation] || 0) + weight;
    target.relationWeights[edge.relation] =
      (target.relationWeights[edge.relation] || 0) + weight;
  }

  for (const stat of stats.values()) {
    for (const relation of STRONG_RELATIONS) {
      stat.strongWeight += stat.relationWeights[relation] || 0;
    }
    stat.coWeight = stat.relationWeights.CO_OCCURS_WITH || 0;
    stat.isCore = stat.strongWeight > 0;
  }

  return [...stats.values()];
}

function toCoreNode(node) {
  return {
    id: node.id,
    type: node.type,
    canonical_name: node.canonical_name,
    source_refs: node.source_refs,
    ...(node.alias !== undefined ? { alias: node.alias } : {}),
  };
}

function toDetailNode(node) {
  return {
    id: node.id,
    type: node.type,
    canonical_name: node.canonical_name,
    source_refs: node.source_refs,
    gloss: node.gloss,
    commentary: node.commentary,
    ...(node.alias !== undefined ? { alias: node.alias } : {}),
  };
}

function main() {
  const nodesFile = path.join(SOURCE_DIR, "nodes.json");
  const edgesFile = path.join(SOURCE_DIR, "edges.json");
  const versesFile = path.join(SOURCE_DIR, "verses.json");

  const nodes = readJson(nodesFile);
  const sourceEdges = readJson(edgesFile);
  const verses = readJson(versesFile);

  validateSource(nodes, sourceEdges, verses);

  const edges = sourceEdges.map(deriveEdge);
  const coreEdges = edges.filter((edge) => STRONG_RELATIONS.has(edge.relation));
  const coEdges = edges.filter((edge) => edge.relation === "CO_OCCURS_WITH");
  const coreNodes = nodes.filter((node) => VISUAL_TYPES.has(node.type)).map(toCoreNode);
  const detailNodes = nodes.map(toDetailNode);
  const nodeStats = buildNodeStats(nodes, edges);

  const relationCounts = {};
  for (const relation of EDGE_RELATIONS) {
    relationCounts[relation] = 0;
  }
  for (const edge of edges) {
    relationCounts[edge.relation] += 1;
  }

  const coreGraph = {
    nodes: coreNodes,
    edges: coreEdges,
  };

  const nodeDetails = Object.fromEntries(detailNodes.map((node) => [node.id, node]));

  const coEdgePackage = {
    edges: coEdges,
  };

  const meta = {
    version: 2,
    generatedAt: new Date().toISOString(),
    source: {
      nodesSha256: sha256(nodesFile),
      edgesSha256: sha256(edgesFile),
      versesSha256: sha256(versesFile),
    },
    counts: {
      nodes: nodes.length,
      edges: edges.length,
      strongEdges: coreEdges.length,
      coOccurrenceEdges: coEdges.length,
      verses: verses.length,
      coreGraphNodes: coreNodes.length,
      coreNodes: nodeStats.filter((stat) => stat.isCore).length,
      extendedNodes: nodeStats.filter((stat) => !stat.isCore).length,
    },
    relationCounts,
    weightRule:
      "edge.weight = share_refs.length；share_refs 不得为空。仅用于前端图形与排序。",
    note:
      "node.degree 与 node.weight 仅写入 scripts/output/data-report.json，不进入前端数据包。",
  };

  const report = {
    generatedAt: meta.generatedAt,
    counts: meta.counts,
    relationCounts,
    topByDegree: [...nodeStats].sort((a, b) => b.degree - a.degree).slice(0, 20),
    topByWeight: [...nodeStats].sort((a, b) => b.weight - a.weight).slice(0, 20),
    nodes: nodeStats,
    weights: {
      edgeWeightRule: "share_refs.length",
      totalEdgeWeight: edges.reduce((sum, edge) => sum + edge.weight, 0),
      totalStrongWeight: coreEdges.reduce((sum, edge) => sum + edge.weight, 0),
      totalCoWeight: coEdges.reduce((sum, edge) => sum + edge.weight, 0),
    },
  };

  const packages = [
    "core-graph.json",
    "node-details.json",
    "co-edges.json",
    "verses.json",
    "meta.json",
  ];

  writeJson(path.join(OUTPUT_DIR, "core-graph.json"), coreGraph);
  writeJson(path.join(OUTPUT_DIR, "node-details.json"), nodeDetails);
  writeJson(path.join(OUTPUT_DIR, "co-edges.json"), coEdgePackage);
  writeJson(path.join(OUTPUT_DIR, "verses.json"), verses);
  writeJson(path.join(OUTPUT_DIR, "meta.json"), meta);
  writeJson(path.join(REPORT_DIR, "data-report.json"), report);

  const packageSizes = packageStats(packages, OUTPUT_DIR);
  const snapshot = buildSnapshot({ nodes, edges, verses, coreEdges, meta });
  writeJson(path.join(REPORT_DIR, "data-snapshot.json"), {
    ...snapshot,
    packages: packageSizes,
  });
  fs.writeFileSync(
    path.join(REPORT_DIR, "data-snapshot.md"),
    renderSnapshotMarkdown(snapshot, packageSizes),
  );

  console.log("数据包生成完成");
  console.log(`节点: ${nodes.length}`);
  console.log(`边: ${edges.length}（强语义 ${coreEdges.length}，共现 ${coEdges.length}）`);
  console.log(`章句: ${verses.length}`);
  console.log(`关系分布: ${JSON.stringify(relationCounts)}`);
  console.log(`核心/扩展节点: ${meta.counts.coreNodes}/${meta.counts.extendedNodes}`);
  for (const item of packageSizes) {
    console.log(`  ${item.name}: ${(item.bytes / 1024).toFixed(1)} KB`);
  }
  console.log(`调试报告: ${path.join(REPORT_DIR, "data-report.json")}`);
  console.log(`数据快照: ${path.join(REPORT_DIR, "data-snapshot.md")}`);
  console.log(`数据快照 JSON: ${path.join(REPORT_DIR, "data-snapshot.json")}`);
}

main();

