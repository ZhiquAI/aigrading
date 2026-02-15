#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-}"
PREFERRED_LOG_FILE="${PREFERRED_LOG_FILE:-}"
FALLBACK_LOG_FILE="${HOME}/Library/Application Support/ai-grading/DEVELOPMENT_LOG.md"

HOUR_LABEL="$(date '+%Y-%m-%d %H:00')"
NOW_LABEL="$(date '+%Y-%m-%d %H:%M:%S')"

if [[ -z "${PREFERRED_LOG_FILE}" ]]; then
  if [[ -n "${PROJECT_ROOT}" ]]; then
    PREFERRED_LOG_FILE="${PROJECT_ROOT}/DEVELOPMENT_LOG.md"
  else
    PREFERRED_LOG_FILE=""
  fi
fi

choose_log_file() {
  local target="$1"
  if [[ -z "${target}" ]]; then
    return 1
  fi
  mkdir -p "$(dirname "${target}")" 2>/dev/null || return 1
  touch "${target}" 2>/dev/null || return 1
  printf '%s\n' "${target}"
  return 0
}

if LOG_FILE="$(choose_log_file "${PREFERRED_LOG_FILE}")"; then
  :
else
  LOG_FILE="$(choose_log_file "${FALLBACK_LOG_FILE}")"
fi

if [[ ! -f "$LOG_FILE" ]]; then
  cat > "$LOG_FILE" <<'EOF'
# 开发记录（按小时）

> 说明：每小时追加一条记录，按时间倒序或顺序均可，但需保持一致。

## 日志

EOF
fi

if grep -q "^## ${HOUR_LABEL}$" "$LOG_FILE" 2>/dev/null; then
  exit 0
fi

BRANCH="unknown"
CHANGES=""
if [[ -n "${PROJECT_ROOT}" && -d "${PROJECT_ROOT}" ]]; then
  BRANCH="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
  CHANGES="$(git -C "$PROJECT_ROOT" status --short 2>/dev/null | head -n 20 || true)"
fi

{
  echo
  echo "## ${HOUR_LABEL}"
  echo
  echo "### 自动记录时间"
  echo "- ${NOW_LABEL}"
  echo
  echo "### 本小时完成"
  echo "- 待补充"
  echo
  echo "### 问题与处理"
  echo "- 问题：待补充"
  echo "- 处理：待补充"
  echo
  echo "### 下一小时计划"
  echo "- 待补充"
  echo
  echo "### Git 快照"
  echo "- 分支：${BRANCH}"
  if [[ -n "${CHANGES}" ]]; then
    echo "- 工作区变更（最多 20 条）："
    while IFS= read -r line; do
      echo "  - ${line}"
    done <<< "${CHANGES}"
  else
    echo "- 工作区变更：无"
  fi
} >> "$LOG_FILE"
