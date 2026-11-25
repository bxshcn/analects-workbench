import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "src", "data");
const OUTPUT_DIR = path.join(ROOT, "public", "data");
const META_FILE = path.join(OUTPUT_DIR, "meta.json");
const OUTPUT_FILES = [
  "core-graph.json",
  "node-details.json",
  "co-edges.json",
  "verses.json",
  "meta.json",
];

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function rebuildReason() {
  if (process.argv.includes("--force")) return "显式 --force";

  const missing = OUTPUT_FILES.filter(
    (name) => !fs.existsSync(path.join(OUTPUT_DIR, name)),
  );
  if (missing.length > 0) return `缺少生成物: ${missing.join(", ")}`;

  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(META_FILE, "utf8"));
  } catch (error) {
    return `meta.json 无法解析: ${error.message}`;
  }

  const current = {
    nodesSha256: sha256(path.join(SOURCE_DIR, "nodes.json")),
    edgesSha256: sha256(path.join(SOURCE_DIR, "edges.json")),
    versesSha256: sha256(path.join(SOURCE_DIR, "verses.json")),
  };

  for (const [key, value] of Object.entries(current)) {
    if (meta?.source?.[key] !== value) return `源文件已变化: ${key}`;
  }

  return null;
}

const reason = rebuildReason();
if (!reason) {
  console.log("数据包已是最新，跳过 data:build");
  process.exit(0);
}

console.log(`需要重建数据包（${reason}）`);
const result = spawnSync(
  process.execPath,
  [path.join(ROOT, "scripts", "build-data.mjs")],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
