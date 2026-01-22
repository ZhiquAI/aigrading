#!/bin/bash
# ============================================
# AI 批改系统 - 后端一键部署脚本
# ============================================

# 服务器配置
SERVER_IP="47.242.35.64"
SERVER_USER="root"
REMOTE_PATH="/var/www/ai-grading/code/aigradingbackend"

echo "🚀 开始部署后端到 $SERVER_IP..."
echo "=================================="

# 1. 先推送本地代码到 GitHub
echo "📦 Step 1: 推送本地代码..."
git add -A && git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')" 2>/dev/null || true
git push

# 2. SSH 到服务器执行部署命令
echo "🔗 Step 2: 连接服务器并部署..."
ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << 'DEPLOY_SCRIPT'
    set -e  # 遇到错误立即停止
    
    echo "📥 拉取最新代码..."
    cd /var/www/ai-grading/code/aigradingbackend
    git pull
    
    echo "📦 安装依赖..."
    npm install --production=false
    
    echo "🔧 生成 Prisma 客户端..."
    npx prisma generate
    
    echo "📊 同步数据库..."
    npx prisma db push --accept-data-loss 2>/dev/null || npx prisma db push
    
    echo "🏗️  构建项目..."
    npm run build
    
    echo "🔄 重启服务..."
    pm2 restart backend || pm2 start npm --name "backend" -- start
    
    echo "✅ 后端部署完成！"
    pm2 status
DEPLOY_SCRIPT

echo ""
echo "=================================="
echo "✅ 部署完成！"
echo "🔗 测试: curl http://$SERVER_IP/api/health"
