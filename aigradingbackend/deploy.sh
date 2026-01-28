#!/bin/bash

# --- AI Grading 后端一键部署脚本 ---

echo "🚀 开始部署..."

# 1. 检查是否在后端目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 未找到 package.json，请在后端根目录下运行此脚本。"
    exit 1
fi

# 2. 如果使用 Git，可以取消下面这行的注释
# git pull origin main

# 3. 安装依赖 (生产环境建议使用 ci 保证一致性)
echo "📦 正在安装依赖..."
npm install --production=false

# 4. Prisma 数据库迁移与生成
echo "🗄️ 正在更新数据库结构..."
npx prisma db push
npx prisma generate

# 5. 生成生产环境 Build
echo "🏗️ 清理旧构建并构建项目..."
rm -rf .next
npm run build

# 6. 使用 PM2 启动或重启
echo "🔄 正在重启服务 (PM2)..."
if pm2 list | grep -q "ai-grading-backend"; then
    pm2 restart ecosystem.config.js
else
    pm2 start ecosystem.config.js
fi

# 7. 保存 PM2 状态
pm2 save

echo "✅ 部署完成！"
echo "📊 请运行 'pm2 status' 查看运行状态。"
echo "📝 请运行 'pm2 logs ai-grading-backend' 查看实时日志。"
