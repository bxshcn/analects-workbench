# 数据源说明

本目录是本项目维护的唯一数据源，运行时只读；人物、关系、章句与注疏的修订直接在本目录进行。

数据规模、关系分布与数据包体积在构建后统一查看：

- `scripts/output/data-snapshot.md`：人类可读快照；
- `scripts/output/data-snapshot.json`：结构化快照；
- `scripts/output/data-report.json`：调试用节点统计。

校验脚本不比较任何固定数字。数据增删后，数量可以变化；校验只检查对象之间的关系是否成立。

## 源字段

### nodes.json

| 字段 | 说明 |
|---|---|
| `id` | 节点唯一标识 |
| `type` | `person`、`virtue`、`vice`、`persona`、`institution`、`office`、`polity`、`role` |
| `canonical_name` | 规范名称 |
| `source_refs` | 该节点出现的章句 `code` 列表 |
| `gloss` | 训诂/概要释义 |
| `commentary` | 注疏/扩展释义 |
| `alias` | 可选别名数组 |

必填字段：`id`、`type`、`canonical_name`、`source_refs`、`gloss`、`commentary`；`alias` 可选。`source_refs` 至少包含一个章句 `code`。

### edges.json

| 字段 | 说明 |
|---|---|
| `source_id` | 源节点 `id` |
| `target_id` | 目标节点 `id` |
| `relation` | 8 类关系之一 |
| `directed` | 有向为 `true`；`CONTRASTS_WITH` 与 `CO_OCCURS_WITH` 为 `false` |
| `share_refs` | 该边关联的章句 `code` 列表 |
| `source` | 可选出处说明 |

必填字段：`source_id`、`target_id`、`relation`、`directed`、`share_refs`；`source` 可选。`share_refs` 至少包含一个章句 `code`。

### verses.json

| 字段 | 说明 |
|---|---|
| `id` | 章句唯一标识 |
| `code` | 章句号，如 `12.1` |
| `chapter_num` | 篇序号 1 到 20 |
| `chapter_title` | 篇名 |
| `verse` | 原文 |
| `gloss` | 译文/训诂 |
| `annotation` | 注释 |
| `commentary` | 疏解 |
| `critique` | 评析 |

全部字段必填；`gloss`、`annotation`、`commentary`、`critique` 必须是字符串，可为空字符串。

## 派生规则

`relation_zh` 与 `edge.weight` 只在拆分数据包阶段注入，不写回本目录。

### relation_zh

| 关系 | relation_zh |
|---|---|
| `PRAISES` | 赞美 |
| `CRITICIZES` | 批评 |
| `TEACHES` | 品评 |
| `ADVOCATES` | 倡导 |
| `WARNS_AGAINST` | 警戒 |
| `CONTAINS` | 包含 |
| `CONTRASTS_WITH` | 对立 |
| `CO_OCCURS_WITH` | 共现 |

被动/入向中文名由 UI 按关系与方向派生：受赞、受批、受评、见倡、见戒、隶属。

### edge.weight

`edge.weight = share_refs.length`；`share_refs` 不得为空。当前保留的边均有章句。

`node.degree` 与 `node.weight` 只在 `scripts/output/data-report.json` 中生成，用于统计与调试，不进入前端数据包，也不被 App 读取。其他数据相关统计统一写入 `scripts/output/data-snapshot.md` 与 `scripts/output/data-snapshot.json`。

## 构建与校验

```bash
npm run data:ensure     # 仅在 src/data 变化或生成物缺失时重建
npm run data:build      # 无条件重建
npm run data:validate   # R01 到 R24 全量校验
npm run data:rules      # 查看全部关系规则说明
```

`public/data` 与 `scripts/output` 均为生成物，已在 `.gitignore` 中忽略、不入库。`npm run dev`、`npm test`、`npm run build` 会通过 `pre*` 钩子自动调用 `npm run data:ensure`。

构建输出：

| 文件 | 内容 |
|---|---|
| `public/data/core-graph.json` | 全部可视类型节点与全部强语义边；边包含派生 `weight` 与 `relation_zh` |
| `public/data/node-details.json` | 键为节点 `id` 的对象映射，包含全部节点的 `id`、`type`、`canonical_name`、`source_refs`、`gloss`、`commentary` 与可选 `alias` |
| `public/data/co-edges.json` | 全部共现边；边包含派生 `weight` 与 `relation_zh` |
| `public/data/verses.json` | 全部章句，与 `src/data/verses.json` 完全一致 |
| `public/data/meta.json` | `version`、`generatedAt`、`source`（三个源文件 SHA-256）、`counts`、`relationCounts`、`weightRule`、`note` |
| `scripts/output/data-report.json` | 调试统计：`generatedAt`、`counts`、`relationCounts`、`topByDegree`、`topByWeight`、`nodes`（含 `degree`、`weight`、`inWeight`、`outWeight`、`relationWeights`、`strongWeight`、`coWeight`、`isCore`）与 `weights` 汇总 |
| `scripts/output/data-snapshot.md` | 人类可读快照：基础计数、关系分布、数据包体积、Tab1 人物关系、核心/扩展、别名与高亮、完整性 |
| `scripts/output/data-snapshot.json` | 与 Markdown 同源的结构化快照，并包含 `packages` 体积统计 |

`public/data` 与 `scripts/output` 是生成物，不要手工编辑；下次 `npm run data:build` 会覆盖它们。

## 校验规则

校验脚本 `scripts/validate-data.mjs` 采用关系规则，不写死节点、边、章句总数。核心规则：

| 规则 | 说明 |
|---|---|
| R01 源文件可读取 | `src/data/nodes.json`、`edges.json`、`verses.json` 必须存在且可解析为 JSON |
| R02 章句结构 | `id` 与 `code` 唯一且非空；`chapter_num` 为 1 到 20 的整数；`chapter_title`、`verse` 为非空字符串；`gloss`、`annotation`、`commentary`、`critique` 为字符串（可为空）；不得含未知字段 |
| R03 节点结构 | 必须包含 `id`、`type`、`canonical_name`、`source_refs`、`gloss`、`commentary`；`id`、`canonical_name` 非空，`gloss`、`commentary` 为字符串；不得含 `weight`、`degree` 或未知字段 |
| R04 节点 ID 唯一 | 所有节点 `id` 不得重复 |
| R05 节点类型 | `type` 必须是 8 类之一：`person`、`virtue`、`vice`、`persona`、`institution`、`office`、`polity`、`role` |
| R06 节点出处 | `source_refs` 必须是非空字符串数组、元素不得重复，且全部指向存在的章句 `code` |
| R07 节点别名 | `alias` 可选；若存在，必须是非空字符串数组且元素不得重复 |
| R08 边结构 | 必须包含 `source_id`、`target_id`、`relation`、`directed`、`share_refs`；`source` 可选但必须是字符串；不得含 `weight`、`relation_zh` 或未知字段 |
| R09 边关系与方向 | `relation` 必须是 8 类之一；`CONTRASTS_WITH` 与 `CO_OCCURS_WITH` 的 `directed` 必须为 `false`，其余为 `true` |
| R10 边端点 | 两端节点必须存在，且不能是同一个节点 |
| R11 边共享章句 | `share_refs` 必须是非空字符串数组、元素不得重复，且全部指向存在的章句 `code` |
| R12 强边端点类型 | 7 类强语义边的两端必须是可视类型节点：`person`、`virtue`、`vice`、`persona` |
| R13 边键唯一 | `source_id`、`relation`、`target_id` 三元组不得重复 |
| R14 无孤儿节点 | 每个节点至少被一条边（含共现边）引用 |
| R15 核心包节点集合 | `core-graph.nodes` 必须等于源数据全部可视类型节点；只允许 `id`、`type`、`canonical_name`、`source_refs`、`alias`，且字段值须与源一致；不得含 `gloss`、`commentary`、`weight`、`degree` 或未知字段 |
| R16 核心包边集合 | `core-graph.edges` 必须等于源数据全部强语义边；`share_refs` 与 `directed` 须与源一致；`relation_zh` 须符合映射；`weight` 须等于 `share_refs.length` 且大于 0；两端须存在于 `core-graph.nodes`；除可选 `source` 外不得含未知字段 |
| R17 共现包边集合 | `co-edges.edges` 必须等于源数据全部共现边；`relation` 须为 `CO_OCCURS_WITH`，`directed` 须为 `false`；`share_refs` 须与源一致；`relation_zh` 须为“共现”；`weight` 须等于 `share_refs.length` 且大于 0；两端须存在于 `node-details`；除可选 `source` 外不得含未知字段 |
| R18 详情包集合 | `node-details` 必须是键为节点 `id` 的对象映射，键集合等于全部源节点；`id`、`type`、`canonical_name`、`source_refs`、`gloss`、`commentary`、`alias` 须与源一致；不得含 `weight`、`degree` 或未知字段 |
| R19 章句包一致 | `public/data/verses.json` 必须与 `src/data/verses.json` 完全一致，包括条目顺序与字段顺序 |
| R20 计数由数据派生 | `meta.counts` 必须与当前数据计算值一致，包含 `nodes`、`edges`、`strongEdges`、`coOccurrenceEdges`、`verses`、`coreGraphNodes`、`coreNodes`、`extendedNodes` |
| R21 关系计数由数据派生 | `meta.relationCounts` 必须包含全部 8 类关系，且每类计数等于当前边分布；出现未知关系键即失败 |
| R22 源文件哈希 | `meta.source.nodesSha256`、`edgesSha256`、`versesSha256` 必须分别与当前三个源文件的 SHA-256 一致 |
| R23 包完整性 | 每条源边必须且只能出现在 `core-graph` 或 `co-edges` 中；全部可视节点必须出现在 `core-graph` 中 |
| R24 派生权重一致 | 核心包与共现包中所有生成边的 `weight` 必须等于 `share_refs.length` 且大于 0 |

新增或修改数据时必须满足上述规则，例如：

- 新增人物必须同时加入 `nodes.json`，并且被至少一条边引用。
- 新增边时，两端节点必须已存在；`share_refs` 不得为空且必须指向存在的章句。
- 强语义边只能连接可视类型节点。
- 不得添加重复边、自环边或孤儿节点。
- 源 `edges.json` 不得写 `weight`、`relation_zh`；它们在拆分阶段生成。

修改完成后运行 `npm run data:check`，确认 R01 到 R24 全部通过后再提交 Pull Request。

App 只允许 `fetch` `public/data`，禁止直接 import 本目录的 JSON。
