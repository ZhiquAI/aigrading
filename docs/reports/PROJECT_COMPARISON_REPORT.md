# AI 智能批改助手项目全方位对比分析报告

**日期:** 2026-02-15  
**对比对象:**
1.  **V1 (Legacy):** `/Users/hero/Desktop/ai-智能批改助手_副本`
2.  **V2 (Platform):** `/Users/hero/Desktop/ai-grading/grading-platform-v2`

---

## 1. 总体概述 (Executive Summary)

**V1 (Legacy)** 是一个典型的**富客户端单体 Chrome 扩展**。它将所有业务逻辑、状态管理、UI 渲染和 AI 调用都集中在前端代码中。这种架构适合快速原型开发和个人用户使用，但在数据安全性、多端同步、复杂业务逻辑扩展和团队协作方面存在局限性。

**V2 (Platform)** 采用了现代化的 **Monorepo (Turborepo) + BFF (Backend for Frontend)** 架构。它将系统拆分为独立的应用程序（扩展端、API 服务端、管理后台）和共享代码包（领域核心、API 契约、UI 组件库、AI 网关等）。这种架构引入了 **Clean Architecture** 设计思想，强调关注点分离、类型安全和可测试性，为企业级 SaaS 化、多租户支持和长期维护奠定了坚实基础。

---

## 2. 架构与技术栈对比 (Architecture & Stack)

| 维度 | V1 (Legacy) | V2 (Platform) | 分析 |
| :--- | :--- | :--- | :--- |
| **项目结构** | 单体 SPA (Single Page Application) | **Monorepo** (pnpm workspace) | V2 支持多应用共享代码，更适合全栈开发。 |
| **构建工具** | **Vite** | **Turborepo** + Vite + Next.js | V2 构建流程更复杂但支持缓存和并行任务，构建性能更好。 |
| **前端框架** | React 19 + TailwindCSS v4 | React 18 + **Next.js 14** + TailwindCSS | V2 引入 Next.js 支持 SSR/API Routes，React 版本略保守以保证兼容性。 |
| **状态管理** | **Zustand** (Local Only) | Zustand (Client) + **React Query** (Server State) | V2 区分了客户端 UI 状态和服务器数据状态，管理更科学。 |
| **后端/API** | 无 (直接调第三方 API) | **Next.js App Router API** | V2 拥有真正的后端，可处理鉴权、限流、数据持久化。 |
| **数据库/ORM** | **LocalStorage** / IndexedDB | **PostgreSQL** + **Prisma ORM** | V2 数据云端存储，支持多端同步和复杂查询，安全性更高。 |
| **类型系统** | TypeScript (部分 Any/Loose) | **Strict TypeScript** + **Zod** | V2 使用 Zod 进行运行时校验，前后端共享类型契约 (`api-contracts`)。 |

### 架构图示对比

**V1:**
```
[Chrome Extension]
  ├── UI Components (Direct Logic)
  ├── Services (Fetch 3rd Party APIs)
  └── LocalStorage (Persistence)
```

**V2:**
```
[Monorepo]
  ├── apps
  │   ├── extension-app (UI Only) ◄──┐
  │   ├── api-server (BFF/Logic)  ───┼──► [Postgres DB]
  │   └── admin-console           ◄──┘
  └── packages
      ├── domain-core (Rules)
      ├── ai-gateway (LLM Abstraction)
      ├── api-contracts (Zod Schemas)
      └── ui-kit (Shared Components)
```

---

## 3. 代码质量与规范 (Code Quality)

### V1: 快速迭代模式
-   **优点**: 代码直观，文件少，修改 UI 响应快。
-   **缺点**:
    -   **逻辑耦合**: `services/grading-service.ts` 中混合了 Prompt 生成、API 调用和结果解析逻辑。
    -   **类型松散**: 存在较多 `any` 或可选属性，API 返回值缺乏严格运行时校验。
    -   **复用困难**: 业务逻辑绑定在 React 组件或 Hook 中，难以在非 UI 环境（如脚本或后端）复用。
    -   **硬编码**: 提示词 (Prompt) 和规则大量硬编码在代码中。

### V2: 工程化模式
-   **优点**:
    -   **契约驱动开发**: `packages/api-contracts` 使用 Zod 定义了所有 API 的输入输出，前后端开发有据可依，自动生成类型。
    -   **领域驱动设计 (DDD)**: `packages/domain-core` 封装了核心业务规则（如身份解析 `ScopeIdentity`），不依赖具体框架。
    -   **防御性编程**: 这是一个强类型系统，`ai-gateway` 和 `grading-service` 都有严格的各种错误处理和降级策略 (Fallback)。
    -   **测试友好**: 核心逻辑解耦，便于编写单元测试 (`vitest`)。
-   **缺点**: 文件数量多，开发一个功能需要修改多个包 (Contract -> Domain -> API -> Client)，初期开发成本高。

---

## 4. 关键功能实现对比 (Feature Implementation)

### 4.1 身份与权限 (Identity)
-   **V1**: 无用户系统，或仅简单的 Token 存储。
-   **V2**:
    -   **多级身份模型**: 支持 `Anoymous` (设备ID), `License` (激活码)。
    -   **ScopeIdentity**: 统一的身份解析中间件，支持从请求头 `x-activation-code` 或 `x-device-id` 解析用户上下文。
    -   **配额管理**: 基于数据库的 `ScopeQuota` 表，支持精确的调用次数扣减和并发控制。

### 4.2 评分逻辑 (Grading)
-   **V1**:
    -   客户端直接调用 LLM。
    -   Prompt 拼接在前端完成 (`grading-service.ts`)。
    -   针对不同学科 (Chinese, Math) 有硬编码的 Prompt 模板。
    -   结果解析依赖正则和简单的 JSON parse。
-   **V2**:
    -   服务端评分 (`apps/api-server/modules/grading`)。
    -   **AI Gateway**: `packages/ai-gateway` 屏蔽了底层模型差异 (OpenRouter, Zhipu)，支持轮询和故障转移。
    -   **标准化**: 评分结果通过 `normalizeBreakdownFromAi` 进行严格清洗，确保分数计算的准确性（例如 `score` 必须等于 `breakdown` 之和）。
    -   **幂等性**: 引入 `IdempotencyRecord` 防止重复计费。

### 4.3 数据管理 (Data)
-   **V1**: 数据分散在 LocalStorage，难以迁移，清理缓存即丢失。
-   **V2**:
    -   **Prisma Schema**: 清晰的数据模型定义 (`LicenseCode`, `GradingRecord`, `RubricDocument`)。
    -   **关联查询**: 可以轻松进行 "查询某学生所有历史成绩" 或 "统计某激活码使用情况" 等复杂操作。

### 4.4 扩展与通信 (Extension Bridge)
-   **V1**: `content.js` 和 `background.js` 直接通信，消息类型定义分散。
-   **V2**: 
    -   **Extension Bridge Package**: 专门的包处理消息协议 (`packages/extension-bridge`)。
    -   **Adapter Pattern**: 针对不同平台（智学网 `platform-zhixue-adapter`）有独立的适配器，易于扩展支持新平台（如好分数）。
    -   **DOM 隔离**: 通过 iframe 和 Shadow DOM 更好地隔离宿主页面。

---

## 5. 迁移与风险评估 (Migration & Risk)

### 现有资产
-   **V1** 拥有成熟的 UI 组件和用户交互逻辑，以及经过验证的 Prompt 策略。
-   **V2** 搭建好了坚实的后端骨架和基础设施，但前端 UI 功能尚未完全对齐 V1 的所有细节。

### 迁移难点
1.  **UI 复刻**: 需要将 V1 的 Ant Design/Tailwind 组件迁移到 V2 的 `ui-kit` (基于 Shadcn/Radix UI) 体系中，工作量较大。
2.  **Prompt 迁移**: V1 的 Prompt 逻辑分散，需要提取并标准化到 V2 的后端服务中。
3.  **数据迁移**: 将用户的 LocalStorage 数据导入 V2 数据库是一个挑战（如果需要保留历史记录）。

### 风险
-   **复杂度**: V2 的复杂度可能对单人开发者构成负担，需要熟练掌握 Next.js, Turbo, Prisma, Docker 等技术。
-   **部署成本**: V2 需要服务器资源 (API Server + DB)，而 V1 零服务器成本。

---

## 6. 结论与建议 (Conclusion & Recommendations)

**结论:**
V2 代表了项目的未来。虽然目前处于重构阶段，但其架构设计远优于 V1，解决了 V1 无法回避的安全性、扩展性和数据同步问题。V1 目前可作为“功能参考原型”和“备用系统”。

**建议:**
1.  **全力推进 V2**: 停止向 V1 添加新功能，仅做 Bug 修复。
2.  **UI 移植**: 优先将 V1 的 `GradingView` 和 `RubricEditor` 等核心视图逻辑，基于 V2 的 `api-contracts` 进行重写和移植。
3.  **Prompt 沉淀**: 将 V1 `grading-service.ts` 中的学科 Prompt 逻辑，整理为 V2 后端的配置或模板。
4.  **双轨运行**: 在 V2 完成核心功能 (激活、批改、记录) 后，发布 Beta 版插件，保留 V1 作为兜底，通过 Feature Flag 控制。

**最终评价:**
从**个人工具**走向**SaaS 平台**的关键一步。V2 的架构是正确的方向，值得投入精力完成重构。
