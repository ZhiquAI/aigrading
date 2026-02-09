# AI 智能批改助手

一款基于 AI 的智能阅卷工具，帮助教师高效批改历史主观题。

## ✨ 核心特性

- 🤖 **AI 智能评分**：支持 Gemini、OpenAI 兼容 API、智谱 AI 多模型
- 📋 **结构化评分细则**：可视化编辑器 + JSON 格式 + AI 自动生成
- 🔄 **跨设备同步**：激活码体系 + 云端数据同步
- 📊 **数据分析**：批改记录统计 + 学情分析
- 🎯 **多平台适配**：智学网、好分数等主流阅卷平台

## 📁 项目结构

```
ai-grading/
├── aigradingfrontend/      # Chrome 扩展程序
│   ├── components/         # React 组件
│   ├── services/           # 服务层（AI、同步、存储）
│   ├── stores/             # Zustand 状态管理
│   └── types.ts            # 类型定义
├── aigradingbackend/       # Next.js 后端 API
│   ├── src/app/api/        # API 路由
│   ├── src/lib/            # 核心逻辑
│   └── prisma/             # 数据库 Schema
└── docs/                   # 项目文档
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9
- PostgreSQL（生产环境）

### 后端启动

```bash
cd aigradingbackend
npm install
cp .env.example .env       # 配置数据库和 API Keys
npx prisma db push         # 同步数据库 Schema
npm run dev                # 启动开发服务器 (localhost:3000)
```

### 前端启动

```bash
cd aigradingfrontend
npm install
npm run dev                # 开发模式
npm run build              # 构建扩展
```

加载扩展：
1. 打开 Chrome → `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」→ 选择 `dist/` 目录

## 📖 文档

| 文档 | 说明 |
|------|------|
| [架构与 UI 设计](./docs/PROJECT_ARCHITECTURE_AND_UI.md) | 技术架构、数据模型、UI 设计理念 |
| [部署指南](./docs/DEPLOYMENT.md) | 生产环境部署步骤 |
| [VPS 部署](./docs/VPS_DEPLOYMENT_GUIDE.md) | 服务器部署详细指南 |

## 🔧 开发指南

### 技术栈

**前端**：React 18 + TypeScript + Vite 5 + Tailwind CSS 4 + Zustand

**后端**：Next.js 14 (App Router) + Prisma ORM + PostgreSQL

**AI**：Gemini 2.0 Flash (主) / OpenRouter / 智谱 GLM-4V (备用)

### 常用命令

```bash
# 后端
npm run dev              # 开发服务器
npx prisma studio        # 数据库可视化管理
npx prisma db push       # 同步 Schema

# 前端
npm run dev              # 开发服务器
npm run build            # 构建生产版本
npm run lint             # 代码检查
```

### 测试激活码

运行 `npx tsx prisma/seed.ts` 后可用：

| 激活码 | 类型 | 配额 |
|--------|------|------|
| `TEST-1111-2222-3333` | 试用 | 300 次 |
| `BASIC-AAAA-BBBB-CCCC` | 基础 | 1000 次 |
| `PRO-XXXX-YYYY-ZZZZ` | 专业 | 3000 次 |

## 📄 许可证

MIT

---

> 🔗 更多技术细节请查阅 [架构文档](./docs/PROJECT_ARCHITECTURE_AND_UI.md)
