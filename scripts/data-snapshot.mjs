import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const VISUAL_TYPES = new Set(["person", "virtue", "vice", "persona"]);

function hasAlias(node) {
  return Array.isArray(node.alias) && node.alias.length > 0;
}

function countByType(ids, nodeById) {
  const counts = {};
  for (const id of ids) {
    const type = nodeById.get(id)?.type ?? "unknown";
    counts[type] = (counts[type] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function packageStats(packageNames, outputDir) {
  return packageNames.map((name) => {
    const file = path.join(outputDir, name);
    const bytes = fs.statSync(file).size;
    return {
      name,
      bytes,
      gzipBytes: gzipSync(fs.readFileSync(file)).length,
    };
  });
}

function tab1Stats(relations, edges, personIds, nodeById) {
  const selectedEdges = edges.filter((edge) => relations.includes(edge.relation));
  const involved = new Set();
  const totals = new Map();

  for (const edge of selectedEdges) {
    const weight = edge.weight;
    for (const id of [edge.source_id, edge.target_id]) {
      if (!personIds.has(id)) continue;
      involved.add(id);
      totals.set(id, (totals.get(id) || 0) + weight);
    }
  }

  const personWeightTotal = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const edgeWeightTotal = selectedEdges.reduce((sum, edge) => sum + edge.weight, 0);
  const totalLogValue = [...totals.values()].reduce((sum, value) => sum + Math.log1p(value), 0);
  const kongzi = [...nodeById.values()].find(
    (node) => node.type === "person" && node.canonical_name === "孔子",
  );
  const kongziRaw = kongzi ? totals.get(kongzi.id) || 0 : 0;
  const topByRaw = [...totals.entries()]
    .map(([id, rawTotal]) => ({
      id,
      canonical_name: nodeById.get(id)?.canonical_name ?? id,
      rawTotal,
      log1p: Math.log1p(rawTotal),
    }))
    .sort((left, right) => right.rawTotal - left.rawTotal)
    .slice(0, 5);

  return {
    relations,
    personCount: involved.size,
    edgeCount: selectedEdges.length,
    edgeWeightTotal,
    personWeightTotal,
    topByRaw,
    kongzi: kongzi
      ? {
          id: kongzi.id,
          canonical_name: kongzi.canonical_name,
          rawTotal: kongziRaw,
          log1p: Math.log1p(kongziRaw),
          rawShare: personWeightTotal > 0 ? kongziRaw / personWeightTotal : 0,
          logShare: totalLogValue > 0 ? Math.log1p(kongziRaw) / totalLogValue : 0,
        }
      : null,
  };
}

export function buildSnapshot({ nodes, edges, verses, coreEdges, meta }) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const personIds = new Set(nodes.filter((node) => node.type === "person").map((node) => node.id));
  const visualIds = new Set(
    nodes.filter((node) => VISUAL_TYPES.has(node.type)).map((node) => node.id),
  );
  const nonVisualIds = new Set(
    nodes.filter((node) => !VISUAL_TYPES.has(node.type)).map((node) => node.id),
  );
  const coreIds = new Set();
  for (const edge of coreEdges) {
    coreIds.add(edge.source_id);
    coreIds.add(edge.target_id);
  }
  const visualExtendedIds = new Set([...visualIds].filter((id) => !coreIds.has(id)));
  const verseText = verses.map((verse) => verse.verse).join("");

  const persons = nodes.filter((node) => node.type === "person");
  const aliasNeeded = persons
    .filter((node) => hasAlias(node) && !verseText.includes(node.canonical_name))
    .map((node) => ({
      id: node.id,
      canonical_name: node.canonical_name,
      alias: node.alias,
    }))
    .sort((left, right) => left.canonical_name.localeCompare(right.canonical_name, "zh-Hans-CN"));
  const singleCharAliasOnly = persons
    .filter((node) => hasAlias(node) && node.alias.every((alias) => alias.length === 1))
    .map((node) => ({
      id: node.id,
      canonical_name: node.canonical_name,
      alias: node.alias,
    }))
    .sort((left, right) => left.canonical_name.localeCompare(right.canonical_name, "zh-Hans-CN"));
  const noAliasAbsentConcepts = nodes
    .filter(
      (node) =>
        ["virtue", "vice", "persona"].includes(node.type) &&
        !hasAlias(node) &&
        !verseText.includes(node.canonical_name),
    )
    .map((node) => ({
      id: node.id,
      canonical_name: node.canonical_name,
      type: node.type,
    }))
    .sort((left, right) => left.canonical_name.localeCompare(right.canonical_name, "zh-Hans-CN"));


  const emptyCommentaryFields = verses.filter((verse) =>
    ["gloss", "annotation", "commentary", "critique"].some(
      (field) => !verse[field] || !verse[field].trim(),
    ),
  ).length;
  const edgesWithoutShareRefs = edges.filter(
    (edge) => !Array.isArray(edge.share_refs) || edge.share_refs.length === 0,
  ).length;
  const nodesWithoutSourceRefs = nodes.filter(
    (node) => !Array.isArray(node.source_refs) || node.source_refs.length === 0,
  ).length;

  const relationCounts = {};
  for (const edge of edges) {
    relationCounts[edge.relation] = (relationCounts[edge.relation] || 0) + 1;
  }

  return {
    generatedAt: meta.generatedAt,
    note: "由 scripts/build-data.mjs 生成；仅参考，不作为校验条件。",
    source: meta.source,
    counts: meta.counts,
    relationCounts,
    coreGraph: {
      visualNodes: visualIds.size,
      coreNodes: coreIds.size,
      extendedNodes: nodes.length - coreIds.size,
      visualExtendedNodes: visualExtendedIds.size,
      nonVisualNodes: nonVisualIds.size,
      coreNodesByType: countByType(coreIds, nodeById),
      visualExtendedByType: countByType(visualExtendedIds, nodeById),
      nonVisualByType: countByType(nonVisualIds, nodeById),
    },
    tab1: {
      defaultView: tab1Stats(["PRAISES"], edges, personIds, nodeById),
      allThree: tab1Stats(["PRAISES", "CRITICIZES", "TEACHES"], edges, personIds, nodeById),
    },
    highlight: {
      persons: persons.length,
      personsWithAlias: persons.filter(hasAlias).length,
      aliasNeededCount: aliasNeeded.length,
      aliasNeeded,
      singleCharAliasOnlyCount: singleCharAliasOnly.length,
      singleCharAliasOnly,
      noAliasAbsentConceptCount: noAliasAbsentConcepts.length,
      noAliasAbsentConcepts,
    },
    integrity: {
      verses: verses.length,
      versesWithEmptyCommentaryField: emptyCommentaryFields,
      edges: edges.length,
      edgesWithoutShareRefs,
      nodes: nodes.length,
      nodesWithoutSourceRefs,
    },
  };
}


function formatBytes(bytes) {
  return `${bytes} B（${(bytes / 1024).toFixed(1)} KB）`;
}

function formatShare(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function mdCell(value) {
  return String(value).replace(/\|/g, "\\|");
}

function aliasList(alias) {
  return Array.isArray(alias) && alias.length > 0 ? alias.join("、") : "无";
}

function makeTable(push) {
  return (headers, rows) => {
    push(`| ${headers.map(mdCell).join(" | ")} |`);
    push(`|${headers.map(() => "---").join("|")}|`);
    for (const row of rows) push(`| ${row.map(mdCell).join(" | ")} |`);
    push();
  };
}

function renderTab1(lines, tab1) {
  const push = (line = "") => lines.push(line);
  const table = makeTable(push);
  push("## Tab1 人物关系");
  push();
  for (const [label, stats] of [
    ["默认（赞美）", tab1.defaultView],
    ["三项全选（赞美 + 批评 + 品评）", tab1.allThree],
  ]) {
    push(`### ${label}`);
    push();
    table(
      ["项目", "数值"],
      [
        ["参与人物", stats.personCount],
        ["边数", stats.edgeCount],
        ["边权重合计", stats.edgeWeightTotal],
        ["人物端权重合计（弧长占比分母）", stats.personWeightTotal],
      ],
    );
    if (stats.kongzi) {
      table(
        ["孔子弧长", "值"],
        [
          ["原始权重", stats.kongzi.rawTotal],
          ["log1p 值", stats.kongzi.log1p.toFixed(4)],
          ["原始权重占比", formatShare(stats.kongzi.rawShare)],
          ["对数弧长占比", formatShare(stats.kongzi.logShare)],
        ],
      );
    }
    push("#### 原始权重 Top 5");
    push();
    table(
      ["名称", "原始权重", "log1p"],
      stats.topByRaw.map((node) => [node.canonical_name, node.rawTotal, node.log1p.toFixed(4)]),
    );
  }
}

export function renderSnapshotMarkdown(snapshot, packages) {
  const lines = [];
  const push = (line = "") => lines.push(line);
  const table = makeTable(push);

  push("# 数据快照");
  push();
  push("> 由 `node scripts/build-data.mjs` 自动生成；仅参考，不作为校验条件。");
  push();

  push("## 基础计数");
  push();
  table(
    ["项目", "数量"],
    [
      ["节点", snapshot.counts.nodes],
      ["可视节点", snapshot.counts.coreGraphNodes],
      ["核心节点", snapshot.counts.coreNodes],
      ["扩展节点", snapshot.counts.extendedNodes],
      ["边", snapshot.counts.edges],
      ["强语义边", snapshot.counts.strongEdges],
      ["共现边", snapshot.counts.coOccurrenceEdges],
      ["章句", snapshot.counts.verses],
    ],
  );

  push("## 关系分布");
  push();
  table(
    ["关系", "边数"],
    Object.entries(snapshot.relationCounts).map(([relation, count]) => [relation, count]),
  );

  push("## 数据包体积");
  push();
  table(
    ["文件", "原始体积", "gzip 体积"],
    packages.map((item) => [item.name, formatBytes(item.bytes), formatBytes(item.gzipBytes)]),
  );

  renderTab1(lines, snapshot.tab1);


  push("## 核心与扩展");
  push();
  table(
    ["项目", "数量"],
    [
      ["可视节点", snapshot.coreGraph.visualNodes],
      ["核心节点", snapshot.coreGraph.coreNodes],
      ["可视扩展节点", snapshot.coreGraph.visualExtendedNodes],
      ["非可视节点", snapshot.coreGraph.nonVisualNodes],
    ],
  );
  push("### 核心节点类型");
  push();
  table(
    ["类型", "数量"],
    Object.entries(snapshot.coreGraph.coreNodesByType).map(([type, count]) => [type, count]),
  );
  push("### 可视扩展节点类型");
  push();
  table(
    ["类型", "数量"],
    Object.entries(snapshot.coreGraph.visualExtendedByType).map(([type, count]) => [type, count]),
  );
  push("### 非可视节点类型");
  push();
  table(
    ["类型", "数量"],
    Object.entries(snapshot.coreGraph.nonVisualByType).map(([type, count]) => [type, count]),
  );


  push("## 高亮与别名");
  push();
  table(
    ["项目", "数量"],
    [
      ["人物总数", snapshot.highlight.persons],
      ["有别名的人物", snapshot.highlight.personsWithAlias],
      ["需要别名参与高亮的人物", snapshot.highlight.aliasNeededCount],
      ["仅有单字别名的人物", snapshot.highlight.singleCharAliasOnlyCount],
      ["无别名且本名不在原文的概念/人格", snapshot.highlight.noAliasAbsentConceptCount],
    ],
  );
  push("### 需要别名参与高亮的人物");
  push();
  table(
    ["id", "名称", "别名"],
    snapshot.highlight.aliasNeeded.map((node) => [
      node.id,
      node.canonical_name,
      aliasList(node.alias),
    ]),
  );
  push("### 仅有单字别名的人物");
  push();
  table(
    ["id", "名称", "别名"],
    snapshot.highlight.singleCharAliasOnly.map((node) => [
      node.id,
      node.canonical_name,
      aliasList(node.alias),
    ]),
  );
  push("### 无别名且本名不在原文的概念/人格");
  push();
  table(
    ["id", "名称", "类型"],
    snapshot.highlight.noAliasAbsentConcepts.map((node) => [
      node.id,
      node.canonical_name,
      node.type,
    ]),
  );

  push("## 数据完整性");
  push();
  table(
    ["项目", "数量"],
    [
      ["章句", snapshot.integrity.verses],
      ["四类注疏存在空字段的章句", snapshot.integrity.versesWithEmptyCommentaryField],
      ["边", snapshot.integrity.edges],
      ["share_refs 为空的边", snapshot.integrity.edgesWithoutShareRefs],
      ["节点", snapshot.integrity.nodes],
      ["source_refs 为空的节点", snapshot.integrity.nodesWithoutSourceRefs],
    ],
  );

  return lines.join("\n") + "\n";
}

