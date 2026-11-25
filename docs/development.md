# 开发说明

本文档汇总开发命令、目录结构、技术实现与验收信息。面向读者的项目介绍与本地运行步骤见根目录 `README.md`。

## 开发命令

```bash
npm install
npm run dev             # 本地开发；首次会自动生成 public/data
npm run build           # 生产构建；prebuild 会按需重建数据包
npm test                # 单元测试与 DOM 冒烟测试；pretest 会按需重建数据包
npm run data:check      # 仅当 src/data 变化时重建，并执行 R01 到 R24 校验
npm run data:force      # 强制重建 public/data 与 scripts/output
npm run data:rules      # 查看全部数据校验规则说明
npm run deploy          # 构建并部署到 Cloudflare Workers
npm run deploy:dry-run  # 构建并本地校验 Worker 配置，不上传
npm run preview:worker  # 构建并用 wrangler dev 本地预览
```

`public/data/` 与 `scripts/output/` 都是生成物，已在 `.gitignore` 中忽略、不入库。`npm run dev`、`npm test`、`npm run build` 会通过 `predev`、`pretest`、`prebuild` 调用 `scripts/ensure-data.mjs`：它比对 `public/data/meta.json` 记录的源文件 SHA-256，只有 `src/data` 变化或生成物缺失时才执行 `scripts/build-data.mjs`，否则直接跳过。

## 目录

```text
docs/                  需求与验收清单
wrangler.jsonc         Cloudflare Workers 静态资源配置
src/data/              数据源（运行时只读），禁止直接 import
public/data/           浏览器实际 fetch 的五个数据包（生成物，不入库）
public/og-preview.jpg  1200×630 社交预览图（当前为占位图）
scripts/               数据构建、按需重建与校验脚本
scripts/output/        构建报告与数据快照（生成物，不入库）
src/components/        图表、索引区与通用 UI
src/hooks/             数据加载、URL 深链、键盘电梯、尺寸观察
src/lib/               几何、分组、排序、高亮与 URL 工具
src/store/             单一 useAnalectsStore
src/types/             数据契约类型
```

## 技术要点

- D3 v7 的 `d3-chord` ribbon 与 `d3-shape` arc 驱动几何，React 负责 SVG DOM。
- Tab1 使用自定义有向弦图几何：源端贴外圈，目标端内缩 6px，支持 `log1p` 弧长与平滑补间；关系为互斥单选，人物使用稳定独立颜色。
- 底部索引左右两栏独立滚动；右侧按关系与方向分组，主动、被动、对立、共现依次排列，并提供吸顶快捷跳转。
- 每个关系分组默认 15 项并可分批展开；当查原文结果不在视窗内时显示可点击的底部色带提示。
- 章句原文与四类注疏字段均按 Markdown 解析渲染，原文中的关系双方关键词高亮保持不变。
- 底部索引保留胶囊双热区、章句卡片与最长匹配高亮；每个关系分组与出处列表均分批渲染。
- URL 只同步锚点、目标、关系与方向，不写入历史、筛选或对数开关。

## 数据与验收

- 数据源（运行时只读）：`src/data/{nodes,edges,verses}.json`。
- 构建产物（不入库）：`public/data/{core-graph,node-details,co-edges,verses,meta}.json` 与 `scripts/output/`。
- `scripts/ensure-data.mjs` 以 `meta.source.*Sha256` 判断是否需要重建；`npm run data:check` 负责按需重建并执行 R01 到 R24 全量校验。
- CI 见 `.github/workflows/ci.yml`：`npm ci` 后依次执行 `data:check`、`npm test`、`npm run build`。
- 数据统计不硬编码，统一查看 `scripts/output/data-snapshot.md` 与 `scripts/output/data-snapshot.json`。
- 验收清单见 `docs/acceptance.md`。

## 部署

线上地址：<https://analects.bxshcn.workers.dev>

- `npm run deploy`：构建并部署到 Cloudflare Workers。
- `npm run deploy:dry-run`：构建并校验 Worker 配置，不上传。
- `npm run preview:worker`：构建并用 `wrangler dev` 本地预览。

首次部署需要先运行 `npx wrangler login`，并在 Cloudflare 账户中注册 `workers.dev` 子域。

## 待确认事项

`public/og-preview.jpg` 为 1200×630 占位图，正式发布前需替换为正式视觉稿。

## 无障碍与响应式

支持 SVG 键盘焦点、Enter 触发、Esc 清除锁定、j 与 k 快速跳转、`prefers-reduced-motion`、移动端 100dvh 与 768/1024 断点布局。
