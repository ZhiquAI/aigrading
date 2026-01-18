#!/bin/bash

# CloudBase 部署脚本
# 使用方法: ./deploy.sh

set -e

echo "🚀 开始部署 CloudBase 云函数..."

# 检查是否已登录
if ! tcb env:list &> /dev/null; then
    echo "❌ 未登录 CloudBase CLI"
    echo "请先运行: tcb login"
    exit 1
fi

# 部署云函数
echo ""
echo "📦 部署 quota-check..."
tcb functions:deploy quota-check --path cloudbase/functions/quota-check

echo ""
echo "📦 部署 quota-consume..."
tcb functions:deploy quota-consume --path cloudbase/functions/quota-consume

echo ""
echo "📦 部署 activation-verify..."
tcb functions:deploy activation-verify --path cloudbase/functions/activation-verify

echo ""
echo "✅ 所有云函数部署成功!"
echo ""
echo "📋 下一步:"
echo "1. 在 CloudBase 控制台创建数据库集合"
echo "2. 配置 .env.local 文件"
echo "3. 运行 npm install 安装依赖"
echo "4. 运行 npm run dev 启动开发服务器"
