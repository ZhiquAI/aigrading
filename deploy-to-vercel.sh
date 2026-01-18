#!/bin/bash

# 🚀 AI 阅卷系统一键部署脚本
# 用于快速部署前后端到 Vercel

set -e  # 遇到错误立即退出

echo "╔════════════════════════════════════════╗"
echo "║   AI 阅卷系统 - 一键部署到 Vercel      ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 检查是否安装 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ 未检测到 Vercel CLI"
    echo "正在安装 Vercel CLI..."
    npm install -g vercel
    echo "✅ Vercel CLI 安装完成"
fi

# 检查是否已登录
echo ""
echo "🔐 检查 Vercel 登录状态..."
if ! vercel whoami &> /dev/null; then
    echo "请先登录 Vercel..."
    vercel login
fi

echo "✅ 已登录 Vercel"
echo ""

# 部署选项
echo "请选择部署方式:"
echo "1) 仅部署后端"
echo "2) 仅部署前端"
echo "3) 部署前后端 (推荐)"
echo ""
read -p "请输入选项 (1-3): " choice

case $choice in
  1)
    echo ""
    echo "📦 开始部署后端..."
    cd ai-grading-backend
    vercel --prod
    echo "✅ 后端部署完成!"
    echo ""
    echo "记住你的后端 URL,稍后需要在前端配置中使用"
    ;;
  2)
    echo ""
    read -p "请输入后端 URL (https://...): " backend_url
    
    # 创建或更新 .env.production
    echo "VITE_API_BASE_URL=$backend_url/api" > ai-grading-frontend/.env.production
    
    echo ""
    echo "📦 开始部署前端..."
    cd ai-grading-frontend
    vercel --prod
    echo "✅ 前端部署完成!"
    ;;
  3)
    echo ""
    echo "📦 第一步: 部署后端..."
    cd ai-grading-backend
    
    backend_url=$(vercel --prod 2>&1 | grep -o 'https://[^ ]*')
    
    if [ -z "$backend_url" ]; then
        echo "⚠️  无法自动获取后端 URL"
        read -p "请手动输入后端 URL: " backend_url
    fi
    
    echo "✅ 后端部署完成!"
    echo "后端 URL: $backend_url"
    echo ""
    
    # 配置前端环境变量
    cd ../ai-grading-frontend
    echo "VITE_API_BASE_URL=$backend_url/api" > .env.production
    
    echo "📦 第二步: 部署前端..."
    frontend_url=$(vercel --prod 2>&1 | grep -o 'https://[^ ]*')
    
    echo ""
    echo "✅ 前端部署完成!"
    echo "前端 URL: $frontend_url"
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║          部署成功!                      ║"
    echo "╠════════════════════════════════════════╣"
    echo "║ 后端: $backend_url"
    echo "║ 前端: $frontend_url"
    echo "╚════════════════════════════════════════╝"
    echo ""
    echo "📝 下一步:"
    echo "1. 在 Vercel Dashboard 配置环境变量"
    echo "2. 访问前端 URL 测试功能"
    echo "3. (可选) 绑定自定义域名"
    ;;
  *)
    echo "❌ 无效选项"
    exit 1
    ;;
esac

echo ""
echo "🎉 部署流程完成!"
echo ""
echo "📖 详细文档: /Users/hero/Desktop/ai-grading/DEPLOYMENT.md"
