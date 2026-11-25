# 只读数据源

本目录是本项目的唯一数据源，来源于：

`../analects-viz/src/data/{nodes.json,edges.json,verses.json}`

复制到本项目后已做如下裁剪，源数据本身不再修改：

| 文件 | 裁剪内容 |
|---|---|
| `nodes.json` | 删除 `weight`、`degree`；删除未被任何剩余边引用的节点 |
| `edges.json` | 删除原数据第 4 类人物关系；删除 `weight`；删除 `relation_zh` |
| `verses.json` | 原样复制，作为章句唯一权威源 |

数据规模、关系分布与数据包体积不再写入本文件。构建后统一查看：

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

源文件不包含 `weight` 与 `degree`。

### edges.json

| 字段 | 说明 |
|---|---|
| `source_id` | 源节点 `id` |
| `target_id` | 目标节点 `id` |
| `relation` | 8 类关系之一 |
| `directed` | 有向为 `true`；`CONTRASTS_WITH` 与 `CO_OCCURS_WITH` 为 `false` |
| `share_refs` | 该边关联的章句 `code` 列表 |
| `source` | 可选出处说明 |

源文件不包含 `weight` 与 `relation_zh`。

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
| `public/data/core-graph.json` | 当前全部可视类型节点 + 当前全部强语义边（含派生 `weight` 与 `relation_zh`） |
| `public/data/node-details.json` | 当前全部节点的基础元数据 + `gloss` + `commentary` |
| `public/data/co-edges.json` | 当前全部共现边（含派生 `weight` 与 `relation_zh`） |
| `public/data/verses.json` | 当前全部章句 |
| `public/data/meta.json` | 由当前数据派生的计数、版本、源文件 SHA-256、关系分布 |
| `scripts/output/data-report.json` | 调试统计：`node.degree`、`node.weight`、关系权重、Top 节点 |
| `scripts/output/data-snapshot.md` | 人类可读数据快照：计数、关系分布、包体积、Tab1、核心/扩展、别名与完整性 |
| `scripts/output/data-snapshot.json` | 与 Markdown 同源的结构化数据快照 |

## 校验规则

校验脚本 `scripts/validate-data.mjs` 采用关系规则，不写死节点、边、章句总数。核心规则：

| 规则 | 说明 |
|---|---|
| R01 源文件可读取 | 三个源 JSON 必须存在且可解析 |
| R02 章句结构 | 唯一且非空 `id` 与 `code`、1 到 20 的 `chapter_num`、非空 `chapter_title` 与 `verse`；注疏字段必须是字符串 |
| R03 节点结构 | 必填字段齐全；不得包含 `weight`、`degree` 或未知字段 |
| R04 节点 ID 唯一 | 节点 `id` 不得重复 |
| R05 节点类型 | 必须是 8 类之一 |
| R06 节点出处 | `source_refs` 非空、无重复、全部指向存在的章句 |
| R07 节点别名 | `alias` 若存在，必须是非空字符串数组且无重复 |
| R08 边结构 | 必填字段齐全；不得包含 `weight`、`relation_zh` 或未知字段 |
| R09 边关系与方向 | 关系必须是 8 类之一；对称关系 `directed` 为 `false`，其余为 `true` |
| R10 边端点 | 两端节点必须存在，且不能是同一个节点 |
| R11 边共享章句 | `share_refs` 非空、无重复、全部指向存在的章句 |
| R12 强边端点类型 | 强语义边两端必须是可视类型节点 |
| R13 边键唯一 | `source_id`、`relation`、`target_id` 三元组不得重复 |
| R14 无孤儿节点 | 每个节点至少被一条边引用 |
| R15 核心包节点集合 | 必须等于源数据全部可视类型节点；不得含 `gloss`、`commentary`、`weight`、`degree` |
| R16 核心包边集合 | 必须等于源数据全部强语义边；`share_refs`、`weight`、`relation_zh`、`directed` 与端点必须与源一致，且不得含未知字段 |
| R17 共现包边集合 | 必须等于源数据全部共现边；`share_refs`、`weight`、`relation_zh`、`directed` 与端点必须与源一致，且不得含未知字段 |
| R18 详情包集合 | 键集合必须等于源节点集合；字段与源一致 |
| R19 章句包一致 | `public/data/verses.json` 必须与源章句完全一致 |
| R20 计数由数据派生 | `meta.counts` 必须等于按当前数据计算出的数量 |
| R21 关系计数由数据派生 | `meta.relationCounts` 必须等于当前关系分布 |
| R22 源文件哈希 | `meta.source` 的 SHA-256 必须与当前源文件一致 |
| R23 包完整性 | 源边必须且只能出现在核心包或共现包；源节点必须全部出现在详情包 |
| R24 派生权重一致 | 所有生成边 `weight` 必须等于 `share_refs.length` 且大于 0 |

新增或修改数据时必须满足上述规则，例如：

- 新增人物必须同时加入 `nodes.json`，并且被至少一条边引用。
- 新增边时，两端节点必须已存在；`share_refs` 不得为空且必须指向存在的章句。
- 强语义边只能连接可视类型节点。
- 不得添加重复边、自环边或孤儿节点。
- 源 `edges.json` 不得写 `weight`、`relation_zh`；它们在拆分阶段生成。

App 只允许 `fetch` `public/data`，禁止直接 import 本目录的 JSON。
