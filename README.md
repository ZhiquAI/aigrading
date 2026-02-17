# AI 智能批改助手 (AI Grading Assistant)

> **当前状态**：项目正处于从 v1 (单体结构) 向 v2 (Monorepo 平台化架构) 的迁移阶段。

## 🎯 项目定位
一款基于 AI 的智能阅卷工具，帮助教师高效批改历史主观题。支持 Gemini、OpenAI、智谱 AI 等多种模型，提供结构化评分细则、跨设备同步和多平台适配能力。

## 🏗️ 项目结构

本项目采用 Monorepo 架构（逐步迁移中），包含以下核心模块：

### 🌟 v2 平台版 (`grading-platform-v2/`) [当前开发重点]
采用 TurboRepo + pnpm 管理的现代化 Monorepo，核心架构升级：

- **apps/**
  - `extension-app`: Chrome 扩展前端 (React + Vite + Feature-based Architecture)
  - `admin-console`: 管理后台 (Next.js)
  - `api-server`: 统一 API 服务 (Next.js App Router)
- **packages/**
  - `domain-core`: 纯业务领域逻辑 (Rubric v4, GradingResult)
  - `ui-kit`: 共享 UI 组件库 (Tailwind + React)
  - `extension-bridge`: Chrome 扩展通信适配层
  - `api-contracts`: 前后端共享类型契约 (Zod schemas)

### 👴 v1 稳定版 (`aigradingfrontend/` & `aigradingbackend/`) [维护模式]
- `aigradingfrontend`: 基于 Zustand 的 Chrome 扩展前端（遗留架构）
- `aigradingbackend`: 初始 Next.js 后端

### 👤 个人版 (`personal/`)
- 纯前端本地版，无后端依赖，数据存储于 LocalStorage。

---

## 🚀 快速开始 (v2 开发)

### 环境要求
- Node.js >= 18
- pnpm >= 8

### 初始化
```bash
cd grading-platform-v2
pnpm install
```

### 启动开发环境
```bash
# 同时启动所有应用
pnpm dev

# 单独启动扩展前端
pnpm --filter extension-app dev
```

---

## � 开发文档

- **迁移计划**: [前端评分 UI 迁移执行方案 (v1 → v2)](./grading-platform-v2/docs/grading-ui-migration-plan.md)
- **分析报告**: [前端评分 UI 分析报告](./grading-platform-v2/docs/frontend-grading-ui-analysis.md)
- **架构设计**: [Rubric Schema v4 定义](./grading-platform-v2/packages/domain-core/src/rubric/rubric-v4.ts)

---

## ✨ 核心特性

- 🤖 **多模态 AI 评分**：支持 Gemini 2.0 Flash / Pro, GPT-4o, GLM-4V
- 📋 **Rubric v4**：支持积分制、逻辑链、评分矩阵等多种策略的结构化细则
- 🔄 **自动循环批改**：自动扫描 -> AI 评分 -> 分数回填 -> 翻页循环
- 📊 **数据洞察**：多维度学情分析与批改记录回溯

## 📄 许可证
MIT
