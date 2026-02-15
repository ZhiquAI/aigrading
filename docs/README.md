# 项目总结文档

---

## 1. 项目全貌

AI 智能批改助手是一个面向教育行业的 Chrome 扩展应用，帮助老师使用 AI 技术批改历史主观题。

### 1.1 核心功能

- 📝 **评分细则管理** - 创建、编辑、AI 生成评分标准
- 🎯 **AI 智能批改** - 基于评分细则自动评分
- 📊 **批改记录** - 历史记录管理与导出
- 🔐 **激活码系统** - 配额管理、跨设备同步

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + Vite 5 |
| 状态管理 | Zustand |
| UI 库 | HeroUI + Tailwind CSS |
| 后端框架 | Next.js 14 (App Router) |
| 数据库 | PostgreSQL + Prisma 5 |
| AI 服务 | OpenAI GPT-4o / 智谱 GLM-4 / Gemini |

---

## 2. 项目结构

```
ai-grading/
├── aigradingfrontend/           # Chrome 扩展前端 (生产)
│   ├── src/
│   │   ├── components/         # React 组件
│   │   ├── stores/             # Zustand 状态
│   │   ├── services/           # API 服务
│   │   └── types/              # TypeScript 类型
│   └── dist/                   # 构建输出
│
├── aigradingbackend/            # Next.js 后端 (生产)
│   ├── src/
│   │   ├── app/api/           # API 路由
│   │   └── lib/               # 业务逻辑
│   └── prisma/                # 数据库 Schema
│
├── grading-platform-v2/         # 重构版本 (开发中)
│   ├── apps/
│   │   ├── extension-app/      # Chrome 扩展
│   │   ├── admin-console/      # 管理后台
│   │   └── api-server/         # API 服务
│   └── packages/               # 共享包
│       ├── api-contracts/      # Zod 合约
│       ├── ai-gateway/        # AI 网关
│       └── domain-core/        # 领域核心
│
└── docs/                       # 文档
    ├── architecture/           # 架构文档
    └── design/                # 设计文档
```

---

## 3. 架构设计要点

### 3.1 前后端交互

```
前端 → HTTP (JSON) → 后端 API → Prisma → PostgreSQL
                        ↓
                   AI 服务 (GPT/智谱)
```

### 3.2 身份认证

- **必需**: `x-device-id` - 设备唯一标识
- **可选**: `x-activation-code` - 激活码 (配额共享、跨设备同步)

### 3.3 数据模型

```
Exam (考试)
  └── DeviceRubric (评分细则) ← examId
      └── GradingRecord (批改记录) ← questionKey
```

---

## 4. 重构进度

### ✅ 已完成

| 模块 | 进度 |
|------|------|
| aigradingfrontend | 生产就绪 |
| aigradingbackend | 生产就绪 |
| grading-platform-v2 API Server | 90% |
| grading-platform-v2 extension-app | 30% |
| grading-platform-v2 admin-console | 5% |

### ❌ 待完成

1. **extension-app** - Panel 完整实现、状态管理
2. **admin-console** - 激活码管理、配额管理
3. **API 完善** - 模板管理、更多端点
4. **数据库迁移** - SQLite → PostgreSQL

---

## 5. UI 设计

### 5.1 设计系统

- **aigradingfrontend**: HeroUI + Tailwind + 现代化彩色主题
- **grading-platform-v2**: 纯 CSS + 拟态玻璃效果

### 5.2 布局

- Tab 导航 (细则/批改/记录/设置)
- Sheet 抽屉面板
- 底部固定导航

---

## 6. 核心 API

### 评分

```
POST /api/ai/grade
{
    imageBase64: "...",
    rubric: "{...}",
    studentName: "张三",
    strategy: "pro"
}
```

### 评分细则

```
POST /api/rubric
{
    questionKey: "Q1",
    rubric: {...},
    examId: "exam_123"
}
```

---

## 7. 启动命令

### 开发模式

```bash
# 前端
cd aigradingfrontend
npm run dev

# 后端
cd aigradingbackend
npm run dev
```

### 构建

```bash
# 前端构建
cd aigradingfrontend
npm run build

# 加载扩展
# chrome://extensions → 加载 dist/
```

---

## 8. 测试账号

| 激活码 | 类型 | 配额 |
|--------|------|------|
| TEST-1111-2222-3333 | Trial | 300 次 |
| BASIC-AAAA-BBBB-CCCC | Basic | 1000 次 |
| PRO-XXXX-YYYY-ZZZZ | Pro | 3000 次 |

---

## 9. 文档索引

| 文档 | 路径 |
|------|------|
| 架构设计 | `docs/architecture/system-architecture.md` |
| v2 重构 | `docs/architecture/grading-platform-v2.md` |
| 前后端交互 | `docs/architecture/frontend-backend-integration.md` |
| UI 设计分析 | `docs/design/ui-design-analysis.md` |

---

## 10. 下一步

1. **短期目标** - 完成 grading-platform-v2 MVP
2. **中期目标** - 完善 admin-console
3. **长期目标** - 统一设计系统，完全迁移到 v2
