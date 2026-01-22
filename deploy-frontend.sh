#!/bin/bash
# ============================================
# AI 批改系统 - 前端一键部署脚本
# ============================================

# 服务器配置
SERVER_IP="47.242.35.64"
SERVER_USER="root"

echo "🚀 开始部署前端到 $SERVER_IP..."
echo "=================================="

# 1. 本地构建
echo "🏗️  Step 1: 本地构建前端..."
cd "$(dirname "$0")/aigradingfrontend"
npm run build

# 2. 上传到服务器
echo "📤 Step 2: 上传构建文件到服务器..."
rsync -avz --delete dist/ $SERVER_USER@$SERVER_IP:/var/www/ai-grading/dist/

echo ""
echo "=================================="
echo "✅ 前端部署完成！"
echo "🔗 访问: http://$SERVER_IP"
