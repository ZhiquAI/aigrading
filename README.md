# AI 智能批改助手

一个基于 AI 的智能批改系统，帮助教师高效批改历史主观题。

## 📁 项目结构

```
ai-grading/
├── ai-grading-frontend/    # Chrome扩展程序
│   ├── components/         # React组件
│   ├── services/           # API服务
│   ├── public/            # 静态资源
│   └── ...
└── ai-grading-backend/     # Next.js后端管理系统
    ├── src/               # 源代码
    ├── prisma/            # 数据库schema
    └── ...
```

## 🚀 快速开始

### 前端（Chrome扩展）

```bash
cd ai-grading-frontend

# 安装依赖
npm install

# 开发构建
npm run dev

# 生产构建
npm run build
```

加载扩展：
1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `ai-grading-frontend/dist` 目录

### 后端（管理系统）

```bash
cd ai-grading-backend

# 安装依赖
npm install

# 配置数据库（首次运行）
npx prisma db push

# 启动开发服务器
npm run dev
```

访问管理后台：http://localhost:3000/admin

## 🎯 功能特点

### Chrome扩展
- ✅ 智能识别答题卡
- ✅ AI批改主观题
- ✅ 多种评分策略（快速/精准/深度推理）
- ✅ 激活码系统
- ✅ 额度管理
- ✅ 批改记录

### 管理后台
- ✅ 数据统计看板
- ✅ 激活码管理
- ✅ 设备管理
- ✅ 使用日志
- ✅ JWT认证

## 📚 技术栈

**前端**:
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand (状态管理)

**后端**:
- Next.js 14
- Prisma ORM
- PostgreSQL
- JWT认证

**AI服务**:
- Google Gemini
- OpenAI兼容API
- 智谱AI

## 📖 文档

详细文档请查看各子项目的README：
- [前端文档](./ai-grading-frontend/README.md)
- [后端文档](./ai-grading-backend/README.md)

## 🔧 开发

### 环境要求
- Node.js >= 18
- npm >= 9
- PostgreSQL (后端)

### 配置文件
- 前端：无需配置文件，使用本地存储
- 后端：复制 `.env.example` 为 `.env` 并配置数据库连接

## 📄 许可证

MIT

## 🙏 致谢

感谢所有为这个项目做出贡献的人！
