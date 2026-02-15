# grading-platform-v2 架构设计文档

## 1. 项目概述

grading-platform-v2 是一个正在重构中的 Chrome 扩展应用，采用 Monorepo 架构，旨在提供更现代化的代码组织和更好的开发体验。

---

## 2. 项目结构

### 2.1 目录结构

```
grading-platform-v2/
├── apps/                          # 应用层
│   ├── admin-console/             # 管理控制台（Vite + React）
│   ├── api-server/                # Next.js API 服务器
│   └── extension-app/             # Chrome 扩展应用（主要分析对象）
├── packages/                      # 共享包层
│   ├── api-contracts/             # API 合约与 Zod 验证
│   ├── config-kernel/             # 运行时配置
│   ├── domain-core/               # 领域核心（Scope 解析）
│   ├── extension-bridge/          # 扩展桥接层
│   ├── logger-observability/      # 日志与可观测性
│   ├── ui-kit/                   # UI 组件库
│   └── ai-gateway/               # AI 网关
├── infra/                        # 基础设施
│   ├── docker/
│   ├── nginx/
│   └── scripts/
├── package.json                  # pnpm workspace 根配置
├── pnpm-workspace.yaml           # 工作空间定义
├── turbo.json                    # Turbo 构建配置
└── tsconfig.base.json            # TypeScript 基础配置
```

---

## 3. 技术栈

### 3.1 Monorepo 技术栈

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| **构建工具** | Turbo 2.3.3 | 增量构建、任务编排 |
| **包管理** | pnpm 9.12.3 | 工作空间管理 |
| **前端框架** | React 18.3.1 | 跨应用共享 |
| **后端框架** | Next.js 14.2.17 | API Server |
| **数据验证** | Zod 3.25.76 | API 合约验证 |
| **测试** | Vitest 2.1.9 | 单元测试 |
| **类型** | TypeScript 5.6.3 | 全栈 TypeScript |

---

## 4. 核心模块

### 4.1 API Server

#### API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/v2/licenses/status` | GET | 授权状态查询 |
| `/api/v2/licenses/activate` | POST | 激活码激活 |
| `/api/v2/settings` | GET/POST/PUT/DELETE | 设置 CRUD |
| `/api/v2/exams` | GET/POST | 考试列表/创建 |
| `/api/v2/rubrics` | GET/POST/DELETE | Rubric CRUD |
| `/api/v2/rubrics/generate` | POST | AI 生成 Rubric |
| `/api/v2/rubrics/standardize` | POST | Rubric 标准化 |
| `/api/v2/gradings/evaluate` | GET/POST | 评分执行/配额查询 |
| `/api/v2/records` | GET/POST/DELETE | 记录 CRUD |
| `/api/v2/records/batch` | POST | 批量创建记录 |

#### 业务服务模块

| 文件 | 职责 |
|------|------|
| `grading-service.ts` | AI 评分逻辑、配额管理 |
| `rubric-service.ts` | 评分细则管理 |
| `license-service.ts` | 激活码/授权服务 |
| `exam-service.ts` | 考试管理 |
| `record-service.ts` | 批改记录管理 |
| `settings-service.ts` | 设置管理 |

### 4.2 数据库 Schema (SQLite 开发)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model LicenseCode {
  id         String           @id @default(cuid())
  code       String           @unique
  planType   String
  totalQuota Int              @default(0)
  maxDevices Int              @default(1)
  isEnabled  Boolean          @default(true)
  expiresAt  DateTime?
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt
  bindings   LicenseBinding[]
  quotas     ScopeQuota[]
}

model LicenseBinding {
  id        String      @id @default(cuid())
  code      String
  deviceId  String
  scopeKey  String
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  license   LicenseCode @relation(fields: [code], references: [code], onDelete: Cascade)

  @@unique([code, deviceId])
  @@index([deviceId])
}

model ScopeQuota {
  id        String       @id @default(cuid())
  scopeKey  String       @unique
  code      String?
  remaining Int          @default(0)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  license   LicenseCode? @relation(fields: [code], references: [code], onDelete: SetNull)
}

model GradingRecord {
  id         String   @id @default(cuid())
  scopeKey   String
  questionNo String?
  questionKey String?
  studentName String
  examNo     String?
  score      Float
  maxScore   Float
  comment    String?
  breakdown  String?
  deviceId   String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([scopeKey, createdAt])
  @@index([scopeKey, questionNo])
  @@index([scopeKey, questionKey])
}

model RubricDocument {
  id              String   @id @default(cuid())
  scopeKey        String
  questionKey     String
  rubricJson      String
  examId          String?
  deviceId        String?
  lifecycleStatus String   @default("draft")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([scopeKey, questionKey])
  @@index([scopeKey, updatedAt])
}

model ExamSession {
  id          String   @id @default(cuid())
  scopeKey    String
  name        String
  date        DateTime?
  subject     String?
  grade       String?
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([scopeKey, date])
  @@index([scopeKey, createdAt])
}

model SettingEntry {
  id        String   @id @default(cuid())
  scopeKey  String
  key       String
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([scopeKey, key])
  @@index([scopeKey])
}

model IdempotencyRecord {
  id          String   @id @default(cuid())
  scopeKey    String
  endpoint    String
  key         String
  requestHash String
  responseBody String
  statusCode  Int
  createdAt   DateTime @default(now())

  @@unique([scopeKey, endpoint, key])
  @@index([createdAt])
}
```

---

## 5. 共享包设计

### 5.1 api-contracts

使用 Zod 定义 API 请求/响应合约:

```typescript
// 请求验证
export const rubricUpsertRequestSchema = z.object({
  questionKey: z.string().trim().min(1).max(128).optional(),
  rubric: z.unknown(),
  examId: z.string().trim().min(1).max(128).nullable().optional(),
  lifecycleStatus: rubricLifecycleStatusSchema.optional()
});

// 类型导出
export type RubricUpsertRequest = z.infer<typeof rubricUpsertRequestSchema>;
```

### 5.2 domain-core

Scope 身份解析逻辑:

```typescript
export const resolveScopeIdentity = (input: ScopeResolveInput): ScopeIdentity => {
  const activationCode = normalizeActivationCode(input.activationCode);
  if (activationCode) {
    return {
      scopeKey: buildActivationScopeKey(activationCode), // "ac:XXX-XXXX"
      scopeType: "activation",
      activationCode
    };
  }
  // device fallback...
};
```

### 5.3 ai-gateway

AI Provider 统一网关:

```typescript
export type AiProvider = "openrouter" | "zhipu";
export type AiGatewayTask = "rubric_generate" | "grading_evaluate";

export const callAiGatewayJson = async (input: AiGatewayRequest): Promise<AiGatewayResult> => {
  // 自动回退: openrouter → zhipu
  const plans = resolveProviderPlans(input);
  for (const plan of plans) {
    try {
      return await callProvider(plan, input);
    } catch (error) {
      attempts.push({ provider: plan.provider, message: error.message });
    }
  }
  throw new AiGatewayError("ALL_PROVIDERS_FAILED", "所有 AI 提供方调用失败", attempts);
};
```

### 5.4 config-kernel

```typescript
export type RuntimeConfig = {
  apiBaseUrl: string;
  requestTimeoutMs: number;
};

export const defaultConfig: RuntimeConfig = {
  apiBaseUrl: "http://localhost:3000",
  requestTimeoutMs: 15000
};
```

---

## 6. extension-app 架构

### 6.1 入口 App.tsx

```typescript
// 状态驱动视图
const [activeView, setActiveView] = useState<ModuleView>("rubric");
const [workspaceView, setWorkspaceView] = useState<string | null>(null);

// 模块类型
type ModuleView = "rubric" | "grading" | "records";
```

### 6.2 导航结构

```
App.tsx
├── Nav: rubric ←→ grading ←→ records
├── Sheet Panel (workspaceView)
│   ├── RubricPanel     # 细则创建/编辑
│   ├── GradingPanel    # 批改工作台
│   └── RecordsPanel    # 记录管理
└── Settings Sheet (showSettingsSheet)
    └── SettingsSheetPanel
```

### 6.3 核心 Panel 组件

#### RubricPanel
- AI 生成流程：上传试题/答案图片 → 填写基本信息 → 生成细则
- 策略类型映射：`point_accumulation` | `sequential_logic` | `rubric_matrix`
- 格式支持：JSON、纯文本

#### GradingPanel
```typescript
// 核心流程
1. 解析 Rubric → parseRubricInput()
2. AI 评分 → evaluateGrading()
3. 回填分数 → applyScoreToActiveTab()
```

#### RecordsPanel
- 分页查询、批量创建
- 幂等键防重复
- JSON 导出

### 6.4 API 服务层

```typescript
// lib/api.ts - 统一响应格式
type ApiOk<T> = { ok: true; data: T };
type ApiError = { ok: false; error?: { code?: string; message?: string } };
type ApiResponse<T> = ApiOk<T> | ApiError;

// Header 构建
const buildHeaders = (extraHeaders?: Record<string, string>): HeadersInit => ({
  "content-type": "application/json",
  "x-device-id": getDeviceId(),
  "x-activation-code": getActivationCode() // 如果存在
});
```

### 6.5 扩展桥接层

```typescript
// extensionBridge.ts - Chrome Runtime 消息通信
captureAnswerImageFromActiveTab()  // 抓取答案图片
applyScoreToActiveTab()            // 回填分数到页面
fetchActiveTabContext()             // 获取页面上下文
```

---

## 7. 与主项目对比

### 7.1 架构模式对比

| 维度 | aigradingfrontend | grading-platform-v2 (extension-app) |
|------|------------------|-------------------------------------|
| **状态管理** | Zustand (全局状态库) | React useState (本地状态) |
| **UI 框架** | HeroUI + Tailwind | 纯 CSS (legacy-shell) |
| **构建方式** | 单体 Vite | Monorepo (Turbo) |
| **路由** | 条件渲染 (View Stack) | 状态驱动 (ModuleView) |
| **代码共享** | 无 | Packages 层共享 |
| **API 层** | proxyService.ts | lib/api.ts + contracts |
| **复杂度** | 较高 (多视图、复杂交互) | 较低 (Panel 化、扁平化) |

### 7.2 技术栈差异

| 依赖 | aigradingfrontend | v2 extension-app |
|------|-------------------|------------------|
| React | 18.2.0 | 18.3.1 |
| UI Library | @heroui/react | 无 (纯 CSS) |
| 状态 | zustand | react state |
| 图表 | chart.js | 无 |
| 图标 | lucide-react | 内联 SVG |
| Tailwind | 4.1.18 | 无 |

---

## 8. 重构进度

### ✅ 已完成

1. **API Server**
   - API 路由框架
   - 业务服务模块
   - AI Gateway
   - Domain Core
   - Zod 合约定义

2. **数据库**
   - Prisma Schema (SQLite)

3. **前端基础**
   - App.tsx 骨架
   - Panel 组件入口
   - CSS 设计系统
   - API 服务层

### ❌ 待完成

#### 前端 (extension-app)

| 优先级 | 任务 | 说明 |
|--------|------|------|
| 🔴 高 | Panel 完整实现 | RubricPanel、GradingPanel、RecordsPanel |
| 🔴 高 | 状态管理 | 引入 Zustand |
| 🔴 高 | API 对接 | 与后端 v2 路由连接 |
| 🟡 中 | 图片压缩 | 从旧项目迁移 |
| 🟡 中 | 扩展通信 | extensionBridge.ts 完善 |

#### 前端 (admin-console)

| 优先级 | 任务 | 说明 |
|--------|------|------|
| 🔴 高 | 完整实现 | 当前仅有入口文件 |
| 🔴 高 | 激活码管理 | 创建、批量生成、导出 |
| 🔴 高 | 配额管理 | 查看、调整 |
| 🔴 高 | 使用统计 | 数据可视化 |

#### 后端

| 优先级 | 任务 | 说明 |
|--------|------|------|
| 🔴 高 | 数据库迁移 | SQLite → PostgreSQL |
| 🔴 高 | 更多 API | 模板管理等 |
| 🟡 中 | 速率限制 | 从旧项目迁移 |
| 🟡 中 | 日志系统 | 完善请求日志 |
| 🟢 低 | 测试覆盖 | Vitest 单元测试 |

---

## 9. 建议重构路线图

### Phase 1: MVP
1. 完善 extension-app 的 API 连接
2. 实现 GradingPanel 完整流程
3. 接入后端 v2 API
4. 基本激活码功能

### Phase 2: 核心功能
1. 完善 RubricPanel (AI 生成、模板库)
2. 完善 RecordsPanel (历史记录、导出)
3. 完善 SettingsSheetPanel
4. 激活码管理界面 (admin-console)

### Phase 3: 生产就绪
1. PostgreSQL 迁移
2. 速率限制
3. 日志系统
4. 完整测试覆盖
