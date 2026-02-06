#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALLOWLIST_REGEX="aigradingbackend/src/lib/rubric-v3.ts|aigradingfrontend/utils/rubric-convert.ts"

FAILED=0

check_pattern() {
  local pattern="$1"
  local label="$2"
  local matches
  local filtered

  matches="$(grep -RInE --include='*.ts' --include='*.tsx' --exclude-dir=node_modules "${pattern}" \
    "${ROOT_DIR}/aigradingfrontend" "${ROOT_DIR}/aigradingbackend" || true)"

  if [[ -z "${matches}" ]]; then
    echo "[PASS] ${label}"
    return 0
  fi

  filtered="$(echo "${matches}" | grep -vE "${ALLOWLIST_REGEX}" || true)"
  if [[ -z "${filtered}" ]]; then
    echo "[PASS] ${label} (命中白名单)"
    return 0
  fi

  echo "[FAIL] ${label}"
  echo "${filtered}"
  FAILED=1
}

check_pattern "types/rubric(['\"]|$)" "禁止引用旧类型文件 types/rubric"
check_pattern "\\banswerPoints\\b" "禁止出现旧字段 answerPoints"
check_pattern "\\bgradingNotes\\b" "禁止出现旧字段 gradingNotes"
check_pattern "version\\s*[:=]\\s*['\"]2\\.0['\"]" "禁止使用旧版本号 2.0"
check_pattern "\"version\"\\s*:\\s*\"2\\.0\"" "禁止 JSON 中出现 version=2.0"

if [[ "${FAILED}" -ne 0 ]]; then
  echo "[rubric-v3-guard] 检查失败"
  exit 1
fi

echo "[rubric-v3-guard] 检查通过"
