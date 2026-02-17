#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

const searchPattern =
  "(/api/ai/grade|/api/rubric\\b|/api/exams\\b|/api/activation|proxy_mode|47\\.242\\.35\\.64|v2\\.html|extension-app\\.legacy-heroui\\.active-view)";

const args = [
  "-n",
  searchPattern,
  "apps/extension-app/src",
  "--glob",
  "!**/node_modules/**"
];

const result = spawnSync("rg", args, {
  cwd: repoRoot,
  encoding: "utf8"
});

if (result.error) {
  console.error("[check-no-legacy-frontend-chain] 运行 rg 失败：", result.error.message);
  process.exit(1);
}

if (result.status === 0) {
  console.error("[check-no-legacy-frontend-chain] 检测到旧前端链路残留，请清理后再提交：");
  if (result.stdout.trim()) {
    console.error(result.stdout.trim());
  }
  process.exit(1);
}

if (result.status === 1) {
  console.log("[check-no-legacy-frontend-chain] 已确认：extension-app 无旧前端链路残留。");
  process.exit(0);
}

console.error("[check-no-legacy-frontend-chain] 检查失败：", result.stderr.trim() || "unknown error");
process.exit(result.status ?? 1);
