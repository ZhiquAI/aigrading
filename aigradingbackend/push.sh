#!/bin/bash

# --- AI Grading 后端本地推送脚本 ---
# 用于将本地代码推送至云服务器并触发部署

SERVER_IP="47.242.35.64"
SERVER_USER="root"
REMOTE_PATH="/var/www/ai-grading/code/aigradingbackend"

echo "📤 正在同步代码到 $SERVER_IP..."

# 使用 rsync 同步代码 (排除 node_modules 和 .git)
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next' \
  --exclude '.env' \
  ./ "$SERVER_USER@$SERVER_IP:$REMOTE_PATH/"

echo "🚀 执行远程部署指令..."

# 连接服务器并运行我们之前写的 deploy.sh
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH && chmod +x deploy.sh && ./deploy.sh"

echo "✅ 云端部署任务提交完成！"
