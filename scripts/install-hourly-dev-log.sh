#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_SCRIPT_PATH="$ROOT_DIR/scripts/hourly-dev-log.sh"
LABEL="com.hero.ai-grading.hourly-dev-log"
RUNTIME_DIR="$HOME/Library/Application Support/ai-grading"
SCRIPT_PATH="$RUNTIME_DIR/hourly-dev-log.sh"
PREFERRED_LOG_FILE="$ROOT_DIR/DEVELOPMENT_LOG.md"
FALLBACK_LOG_FILE="$RUNTIME_DIR/DEVELOPMENT_LOG.md"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/${LABEL}.plist"
OUT_LOG="$ROOT_DIR/scripts/hourly-dev-log.out.log"
ERR_LOG="$ROOT_DIR/scripts/hourly-dev-log.err.log"
GUI_DOMAIN="gui/$(id -u)"

mkdir -p "$RUNTIME_DIR"
cp "$SOURCE_SCRIPT_PATH" "$SCRIPT_PATH"
chmod +x "$SCRIPT_PATH"
OUT_LOG="$RUNTIME_DIR/hourly-dev-log.out.log"
ERR_LOG="$RUNTIME_DIR/hourly-dev-log.err.log"

mkdir -p "$LAUNCH_AGENTS_DIR"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>PROJECT_ROOT='${ROOT_DIR}' PREFERRED_LOG_FILE='${PREFERRED_LOG_FILE}' '${SCRIPT_PATH}'</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${RUNTIME_DIR}</string>

  <key>StartCalendarInterval</key>
  <dict>
    <key>Minute</key>
    <integer>0</integer>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${OUT_LOG}</string>
  <key>StandardErrorPath</key>
  <string>${ERR_LOG}</string>
</dict>
</plist>
EOF

if launchctl print "${GUI_DOMAIN}/${LABEL}" >/dev/null 2>&1; then
  launchctl bootout "${GUI_DOMAIN}" "${PLIST_PATH}" >/dev/null 2>&1 || true
fi

launchctl bootstrap "${GUI_DOMAIN}" "${PLIST_PATH}"
launchctl enable "${GUI_DOMAIN}/${LABEL}"
launchctl kickstart -k "${GUI_DOMAIN}/${LABEL}"

echo "已安装并启动：${LABEL}"
echo "配置文件：${PLIST_PATH}"
echo "优先日志：${PREFERRED_LOG_FILE}"
echo "回退日志：${FALLBACK_LOG_FILE}"
