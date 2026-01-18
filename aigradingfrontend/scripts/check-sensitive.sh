#!/bin/bash
#
# 敏感信息检测脚本 - Pre-commit Hook
# 检测代码中是否存在硬编码的敏感信息
#

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 正在检测敏感信息..."

# 获取待提交的文件（排除 node_modules, dist, .git 等）
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx|json|env)$' | grep -v 'node_modules' | grep -v 'dist' | grep -v '.husky')

if [ -z "$FILES" ]; then
    echo -e "${GREEN}✅ 没有需要检测的文件${NC}"
    exit 0
fi

ERRORS_FOUND=0

# 1. 检测硬编码的 API Key 模式
echo "  检查 API Key 硬编码..."
API_KEY_PATTERNS=(
    'AIza[0-9A-Za-z_-]{35}'           # Google API Key
    'sk-[a-zA-Z0-9]{48}'               # OpenAI API Key
    'sk-ant-[a-zA-Z0-9-]{90,}'         # Anthropic API Key
    '[a-zA-Z0-9]{32}\.[-a-zA-Z0-9_]{40,}' # Zhipu API Key pattern
)

for pattern in "${API_KEY_PATTERNS[@]}"; do
    for file in $FILES; do
        if [ -f "$file" ]; then
            MATCHES=$(grep -nE "$pattern" "$file" 2>/dev/null | grep -v '// allowed' | grep -v '# allowed')
            if [ -n "$MATCHES" ]; then
                echo -e "${RED}❌ 发现疑似 API Key 硬编码:${NC}"
                echo "   文件: $file"
                echo "$MATCHES" | while read -r line; do
                    echo "   $line"
                done
                ERRORS_FOUND=1
            fi
        fi
    done
done

# 2. 检测常见的敏感关键词赋值
echo "  检查敏感关键词赋值..."
SENSITIVE_PATTERNS=(
    'API_KEY\s*[=:]\s*["\x27][^"\x27]+["\x27]'
    'SECRET\s*[=:]\s*["\x27][^"\x27]+["\x27]'
    'PASSWORD\s*[=:]\s*["\x27][^"\x27]+["\x27]'
    'PRIVATE_KEY\s*[=:]\s*["\x27][^"\x27]+["\x27]'
)

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    for file in $FILES; do
        if [ -f "$file" ]; then
            # 排除 .env.example 和注释
            if [[ "$file" != *".env.example"* ]]; then
                MATCHES=$(grep -niE "$pattern" "$file" 2>/dev/null | grep -v 'process.env' | grep -v '// allowed' | grep -v '# allowed' | grep -v 'EXAMPLE')
                if [ -n "$MATCHES" ]; then
                    echo -e "${YELLOW}⚠️  发现疑似敏感信息赋值:${NC}"
                    echo "   文件: $file"
                    echo "$MATCHES" | while read -r line; do
                        echo "   $line"
                    done
                    ERRORS_FOUND=1
                fi
            fi
        fi
    done
done

# 3. 检测学生隐私信息模式（简化版）
echo "  检查学生隐私信息硬编码..."
for file in $FILES; do
    if [ -f "$file" ]; then
        # 检测连续的中文姓名列表（3个或以上）
        NAMES=$(grep -nE '[\x{4e00}-\x{9fa5}]{2,4}[,，、\s]+[\x{4e00}-\x{9fa5}]{2,4}[,，、\s]+[\x{4e00}-\x{9fa5}]{2,4}' "$file" 2>/dev/null | grep -v 'test' | grep -v 'mock' | grep -v 'example')
        if [ -n "$NAMES" ]; then
            echo -e "${YELLOW}⚠️  发现疑似学生姓名列表:${NC}"
            echo "   文件: $file"
            echo "   请确认是否为测试数据或示例数据"
        fi
    fi
done

# 结果判定
if [ $ERRORS_FOUND -eq 1 ]; then
    echo ""
    echo -e "${RED}🚫 提交被阻止：发现敏感信息${NC}"
    echo "   请移除硬编码的敏感信息，改用环境变量"
    echo "   如需跳过检测，可在行尾添加 '// allowed' 注释"
    exit 1
else
    echo -e "${GREEN}✅ 敏感信息检测通过${NC}"
    exit 0
fi
