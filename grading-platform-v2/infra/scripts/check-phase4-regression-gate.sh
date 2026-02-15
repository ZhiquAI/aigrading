#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORT_PATH="${1:-$ROOT_DIR/docs/migration/phase-4-dual-platform-e2e-report.md}"

if [[ ! -f "$REPORT_PATH" ]]; then
  echo "[phase4-gate] Report not found: $REPORT_PATH"
  exit 2
fi

failures=()

if grep -Fq 'Overall status: `Pending' "$REPORT_PATH"; then
  failures+=("overall status is still pending")
fi

if grep -Fq '| 智学网（zhixue） | Pending |' "$REPORT_PATH"; then
  failures+=("zhixue platform status is pending")
fi

if grep -Fq '| 好分数（haofenshu） | Pending |' "$REPORT_PATH"; then
  failures+=("haofenshu platform status is pending")
fi

total_pending="$(awk -F'|' '/^\| Total / {gsub(/ /, "", $5); print $5}' "$REPORT_PATH" | head -n 1)"
if [[ -z "$total_pending" ]]; then
  failures+=("scoreboard total pending cell is missing")
elif ! [[ "$total_pending" =~ ^[0-9]+$ ]]; then
  failures+=("scoreboard total pending is not numeric: $total_pending")
elif [[ "$total_pending" -gt 0 ]]; then
  failures+=("scoreboard total pending is $total_pending (must be 0)")
fi

if [[ "${#failures[@]}" -gt 0 ]]; then
  echo "[phase4-gate] BLOCKED: manual dual-platform regression is not complete."
  for item in "${failures[@]}"; do
    echo "  - $item"
  done
  echo "[phase4-gate] Report: $REPORT_PATH"
  exit 1
fi

echo "[phase4-gate] PASS: dual-platform regression report is release-ready."
echo "[phase4-gate] Report: $REPORT_PATH"
