#!/bin/bash

# V2 UI 快速验证脚本
# 用途: Phase 2 - 功能完整性检查
# 时间: 2026-01-26

echo "🚀 启动 V2 UI 快速验证..."
echo "=================================================="

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
PASS=0
FAIL=0

# ============================================
# 1. 检查dist目录结构
# ============================================
echo -e "\n${BLUE}📦 检查构建产物...${NC}"

check_file() {
  if [ -f "$1" ]; then
    echo -e "${GREEN}✓${NC} $1 存在"
    ((PASS++))
    return 0
  else
    echo -e "${RED}✗${NC} $1 缺失"
    ((FAIL++))
    return 1
  fi
}

DIST_DIR="/Users/hero/Desktop/ai-grading/aigradingfrontend/dist"

check_file "$DIST_DIR/v2.html"
check_file "$DIST_DIR/manifest.json"
check_file "$DIST_DIR/index.css" 2>/dev/null || check_file "$DIST_DIR/assets/v2-ClyHTdTf.css"

# ============================================
# 2. 检查manifest配置
# ============================================
echo -e "\n${BLUE}⚙️  检查manifest.json配置...${NC}"

if [ -f "$DIST_DIR/manifest.json" ]; then
  if grep -q '"default_path": "v2.html"' "$DIST_DIR/manifest.json"; then
    echo -e "${GREEN}✓${NC} side_panel 正确指向 v2.html"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} side_panel 配置错误"
    ((FAIL++))
  fi
  
  if grep -q '"name": "AI 智能阅卷助手"' "$DIST_DIR/manifest.json"; then
    echo -e "${GREEN}✓${NC} 扩展名称配置正确"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} 扩展名称配置错误"
    ((FAIL++))
  fi
fi

# ============================================
# 3. 检查HTML有效性
# ============================================
echo -e "\n${BLUE}📄 检查HTML入口...${NC}"

if [ -f "$DIST_DIR/v2.html" ]; then
  SIZE=$(wc -c < "$DIST_DIR/v2.html")
  echo -e "${GREEN}✓${NC} v2.html 大小: $SIZE 字节"
  ((PASS++))
  
  if grep -q '<div id="root"></div>' "$DIST_DIR/v2.html"; then
    echo -e "${GREEN}✓${NC} React root 容器存在"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} React root 容器缺失"
    ((FAIL++))
  fi
  
  if grep -q 'v2.html-' "$DIST_DIR/v2.html"; then
    echo -e "${GREEN}✓${NC} 入口脚本正确加载"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} 入口脚本加载失败"
    ((FAIL++))
  fi
fi

# ============================================
# 4. 检查关键资源文件
# ============================================
echo -e "\n${BLUE}📚 检查资源文件...${NC}"

ASSETS_DIR="$DIST_DIR/assets"

if [ -d "$ASSETS_DIR" ]; then
  echo -e "${GREEN}✓${NC} assets 目录存在"
  ((PASS++))
  
  # 检查JavaScript包
  if ls $ASSETS_DIR/*.js | grep -q "v2.html"; then
    echo -e "${GREEN}✓${NC} V2主bundle存在"
    ((PASS++))
  fi
  
  # 检查CSS
  if ls $ASSETS_DIR/*.css 2>/dev/null | wc -l | grep -qv "^0$"; then
    echo -e "${GREEN}✓${NC} 样式文件存在"
    ((PASS++))
  fi
  
  # 统计文件数量
  JS_COUNT=$(ls $ASSETS_DIR/*.js 2>/dev/null | wc -l)
  CSS_COUNT=$(ls $ASSETS_DIR/*.css 2>/dev/null | wc -l)
  echo -e "${BLUE}  • JavaScript: $JS_COUNT 个文件${NC}"
  echo -e "${BLUE}  • CSS: $CSS_COUNT 个文件${NC}"
else
  echo -e "${RED}✗${NC} assets 目录缺失"
  ((FAIL++))
fi

# ============================================
# 5. 检查静态资源
# ============================================
echo -e "\n${BLUE}🖼️  检查静态资源...${NC}"

check_file "$DIST_DIR/icon.png"
check_file "$DIST_DIR/manifest.json"

# ============================================
# 6. 检查HTTP服务器
# ============================================
echo -e "\n${BLUE}🌐 检查本地服务器...${NC}"

if curl -s http://localhost:8888/v2.html > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} HTTP服务器 (localhost:8888) 运行中"
  ((PASS++))
  
  # 测试资源加载
  if curl -s http://localhost:8888/manifest.json | grep -q "side_panel"; then
    echo -e "${GREEN}✓${NC} manifest.json 可访问"
    ((PASS++))
  fi
else
  echo -e "${YELLOW}⚠${NC}  HTTP服务器未运行 (可选)"
fi

# ============================================
# 7. 检查源代码
# ============================================
echo -e "\n${BLUE}💻 检查源代码...${NC}"

SRC_DIR="/Users/hero/Desktop/ai-grading/aigradingfrontend"

if [ -f "$SRC_DIR/App.tsx" ]; then
  # 检查V1入口是否已删除
  if ! [ -f "$SRC_DIR/index.tsx" ]; then
    echo -e "${GREEN}✓${NC} V1入口文件 (index.tsx) 已删除"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} V1入口文件 (index.tsx) 仍存在"
    ((FAIL++))
  fi
  
  if ! [ -f "$SRC_DIR/index.html" ]; then
    echo -e "${GREEN}✓${NC} V1入口文件 (index.html) 已删除"
    ((PASS++))
  else
    echo -e "${RED}✗${NC} V1入口文件 (index.html) 仍存在"
    ((FAIL++))
  fi
  
  # 检查v2.tsx是否存在
  if [ -f "$SRC_DIR/v2.tsx" ]; then
    echo -e "${GREEN}✓${NC} V2主入口 (v2.tsx) 存在"
    ((PASS++))
  fi
fi

# ============================================
# 8. 检查依赖项
# ============================================
echo -e "\n${BLUE}📦 检查项目依赖...${NC}"

if [ -f "$SRC_DIR/package.json" ]; then
  if grep -q '"react"' "$SRC_DIR/package.json"; then
    echo -e "${GREEN}✓${NC} React 依赖已安装"
    ((PASS++))
  fi
  
  if grep -q '"zustand"' "$SRC_DIR/package.json"; then
    echo -e "${GREEN}✓${NC} Zustand 状态管理已安装"
    ((PASS++))
  fi
  
  if grep -q '"vite"' "$SRC_DIR/package.json"; then
    echo -e "${GREEN}✓${NC} Vite 构建工具已安装"
    ((PASS++))
  fi
fi

# ============================================
# 9. 最终统计
# ============================================
echo -e "\n${BLUE}================================================${NC}"
echo -e "\n📊 ${BLUE}快速验证结果${NC}"
echo -e "  ${GREEN}通过${NC}: $PASS 项"
echo -e "  ${RED}失败${NC}: $FAIL 项"

TOTAL=$((PASS + FAIL))
PASS_RATE=$((PASS * 100 / TOTAL))

if [ $FAIL -eq 0 ]; then
  echo -e "\n${GREEN}✨ 所有检查通过！(100%)${NC}"
  echo -e "${GREEN}准备进行Phase 2功能测试...${NC}"
  exit 0
elif [ $PASS_RATE -ge 80 ]; then
  echo -e "\n${YELLOW}⚠️  大部分检查通过 ($PASS_RATE%)${NC}"
  echo -e "${YELLOW}可以开始Phase 2测试，但需关注失败项${NC}"
  exit 1
else
  echo -e "\n${RED}❌ 检查失败项过多 ($PASS_RATE%)${NC}"
  echo -e "${RED}需要修复后再进行Phase 2测试${NC}"
  exit 2
fi
