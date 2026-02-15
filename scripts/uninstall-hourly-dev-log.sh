#!/usr/bin/env bash
set -euo pipefail

LABEL="com.hero.ai-grading.hourly-dev-log"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
RUNTIME_SCRIPT_PATH="$HOME/Library/Application Support/ai-grading/hourly-dev-log.sh"
GUI_DOMAIN="gui/$(id -u)"

if launchctl print "${GUI_DOMAIN}/${LABEL}" >/dev/null 2>&1; then
  launchctl bootout "${GUI_DOMAIN}" "${PLIST_PATH}" >/dev/null 2>&1 || true
fi

launchctl disable "${GUI_DOMAIN}/${LABEL}" >/dev/null 2>&1 || true

if [[ -f "${PLIST_PATH}" ]]; then
  rm -f "${PLIST_PATH}"
fi

if [[ -f "${RUNTIME_SCRIPT_PATH}" ]]; then
  rm -f "${RUNTIME_SCRIPT_PATH}"
fi

echo "已卸载：${LABEL}"
