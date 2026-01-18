# AI 智能批改助手

一款基于 AI 的智能阅卷辅助工具，支持智学网、好分数等主流阅卷平台。

## ✨ 功能特点

- 🤖 **AI 智能批改** - 支持 Gemini/OpenAI/智谱 AI 多种模型
- 📋 **评分细则生成** - 上传试题图片自动生成评分标准
- 🎯 **双模式批改** - 辅助模式 + 自动模式灵活选择
- 📊 **数据分析** - 批改统计、分数分布可视化
- 📝 **历史记录** - 虚拟滚动高性能列表、支持导出 CSV
- 🔒 **隐私安全** - 数据本地存储，API Key 加密保护

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 运行测试

```bash
npm run test
```

## 📦 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.2.0 | UI 框架 |
| TypeScript | 5.8.2 | 类型系统 |
| Vite | 6.2.0 | 构建工具 |
| Tailwind CSS | 4.1.17 | 样式框架 |
| Zustand | latest | 状态管理 |
| Vitest | latest | 测试框架 |
| @tanstack/react-virtual | latest | 虚拟滚动 |

## 📁 项目结构

```
├── components/           # React 组件
│   ├── grading/         # 批改相关子组件
│   ├── history/         # 历史记录子组件
│   ├── ui/              # 通用 UI 组件
│   └── ...
├── services/            # 服务层（已拆分）
│   ├── config-service.ts    # 配置管理
│   ├── ai-service.ts        # AI 调用
│   ├── rubric-service.ts    # 评分细则
│   ├── grading-service.ts   # 批改服务
│   └── geminiService.ts     # 兼容旧接口
├── stores/              # Zustand 状态管理
├── hooks/               # 自定义 Hooks
├── utils/               # 工具函数
├── __tests__/           # 单元测试
└── ...
```

## 🧪 测试

项目包含 39 个单元测试，覆盖核心功能：

```bash
# 运行所有测试
npm run test

# 监听模式
npm run test -- --watch

# 查看覆盖率
npm run test -- --coverage
```

## 🔧 配置

### 环境变量

```env
VITE_GEMINI_API_KEY=your_api_key  # Gemini API Key（可选）
```

### 支持的 AI 服务商

- **Google Gemini** - gemini-2.0-flash-exp, gemini-3-pro-preview
- **OpenAI** - gpt-4o, gpt-4o-mini
- **智谱 AI** - glm-4.6v, glm-4.7, glm-4v-flash

## 📖 使用指南

1. **配置 API Key** - 在设置中配置您的 AI 服务密钥
2. **配置评分细则** - 上传试题或答案图片，AI 自动生成
3. **开始批改** - 选择辅助模式或自动模式
4. **查看记录** - 在历史记录中查看和导出批改结果

## 🔒 隐私政策

- 所有批改数据仅存储在本地浏览器
- API Key 使用 AES 加密存储
- 不收集任何个人身份信息

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
