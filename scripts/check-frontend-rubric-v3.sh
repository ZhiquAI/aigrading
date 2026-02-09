#!/usr/bin/env bash
set -u -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/aigradingfrontend"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT_PATH="${ROOT_DIR}/AI评分细则模块重构/前端评分细则验收报告-${TIMESTAMP}.md"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

add_pass() {
  echo "- [x] $1" >> "${REPORT_PATH}"
  PASS_COUNT=$((PASS_COUNT + 1))
}

add_fail() {
  echo "- [ ] $1" >> "${REPORT_PATH}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

add_skip() {
  echo "- [-] $1" >> "${REPORT_PATH}"
  SKIP_COUNT=$((SKIP_COUNT + 1))
}

header() {
  cat > "${REPORT_PATH}" <<EOF
# 前端评分细则验收报告

- 时间：$(date '+%Y-%m-%d %H:%M:%S')
- 工程根目录：\`${ROOT_DIR}\`
- 前端目录：\`${FRONTEND_DIR}\`

## 自动化检查
EOF
}

check_file() {
  local file_path="$1"
  if [[ -f "${ROOT_DIR}/${file_path}" ]]; then
    add_pass "文件存在：\`${file_path}\`"
  else
    add_fail "文件缺失：\`${file_path}\`"
  fi
}

check_grep() {
  local file_path="$1"
  local pattern="$2"
  local label="$3"
  if grep -q "${pattern}" "${ROOT_DIR}/${file_path}" 2>/dev/null; then
    add_pass "${label}"
  else
    add_fail "${label}"
  fi
}

run_build() {
  if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
    add_skip "跳过构建检查（SKIP_BUILD=1）"
    return 0
  fi

  if [[ ! -d "${FRONTEND_DIR}" ]]; then
    add_fail "前端目录不存在，无法构建"
    return 0
  fi

  local build_log
  build_log="$(mktemp)"
  (
    cd "${FRONTEND_DIR}" || exit 1
    npm run build >"${build_log}" 2>&1
  )
  local code=$?
  if [[ ${code} -eq 0 ]]; then
    add_pass "前端构建通过：\`npm run build\`"
  else
    add_fail "前端构建失败：\`npm run build\`（日志：${build_log}）"
    echo "" >> "${REPORT_PATH}"
    echo "### 构建失败日志" >> "${REPORT_PATH}"
    echo '```text' >> "${REPORT_PATH}"
    sed -n '1,120p' "${build_log}" >> "${REPORT_PATH}"
    echo '```' >> "${REPORT_PATH}"
  fi
  rm -f "${build_log}"
}

ask_manual_case() {
  local id="$1"
  local title="$2"

  if [[ ! -t 0 ]]; then
    add_skip "${id} ${title}（非交互模式，未打勾）"
    return 0
  fi

  while true; do
    read -r -p "${id} ${title} 是否通过？(y/n/s): " answer
    case "${answer}" in
      y|Y)
        add_pass "${id} ${title}"
        return 0
        ;;
      n|N)
        add_fail "${id} ${title}"
        return 0
        ;;
      s|S)
        add_skip "${id} ${title}"
        return 0
        ;;
      *)
        echo "请输入 y / n / s"
        ;;
    esac
  done
}

main() {
  header

  check_file "aigradingfrontend/types/rubric-v3.ts"
  check_file "aigradingfrontend/utils/rubric-convert.ts"
  check_file "aigradingfrontend/services/rubric-templates.ts"
  check_file "aigradingfrontend/src/components/v2/views/rubric-editors/PointAccumulationEditor.tsx"
  check_file "aigradingfrontend/src/components/v2/views/rubric-editors/SequentialLogicEditor.tsx"
  check_file "aigradingfrontend/src/components/v2/views/rubric-editors/RubricMatrixEditor.tsx"

  check_grep "aigradingfrontend/src/components/v2/views/RubricCreateModal.tsx" "version: '3.0'" "RubricCreateModal 已使用 v3 输出"
  check_grep "aigradingfrontend/src/components/v2/views/RubricCreateModal.tsx" "createRubricTemplate" "RubricCreateModal 已接入模板保存"
  check_grep "aigradingfrontend/src/components/v2/views/RubricCreateModal.tsx" "recommendRubricTemplates" "RubricCreateModal 已接入模板推荐"
  check_grep "aigradingfrontend/src/components/v2/views/GradingViewV2.tsx" "needsReview" "GradingViewV2 已接入低置信度暂停字段"
  check_grep "aigradingfrontend/src/components/v2/views/RubricView.tsx" "template" "RubricView 含模板库视图逻辑"

  run_build

  cat >> "${REPORT_PATH}" <<EOF

## 手工验收打勾
EOF

  ask_manual_case "S01" "v2 导入后自动转 v3 并可保存"
  ask_manual_case "S02" "三策略编辑器可创建并保存"
  ask_manual_case "S03" "另存为模板成功，模板库可见"
  ask_manual_case "S04" "模板推荐可返回并可应用"
  ask_manual_case "S05" "模板应用/删除权限行为正确"
  ask_manual_case "S06" "低置信度触发暂停并提示复核"
  ask_manual_case "S07" "正常自动流程可提交并入历史"
  ask_manual_case "S08" "规则库检索/导出/入口无回归"

  cat >> "${REPORT_PATH}" <<EOF

## 汇总
- 通过：${PASS_COUNT}
- 失败：${FAIL_COUNT}
- 跳过：${SKIP_COUNT}
EOF

  echo "验收报告已生成：${REPORT_PATH}"

  if [[ ${FAIL_COUNT} -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
