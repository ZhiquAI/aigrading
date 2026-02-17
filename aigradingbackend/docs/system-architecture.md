# AI 智能批改项目架构设计文档

## 1. 项目概述

AI 智能批改助手 - An AI-powered grading assistant for teachers, primarily for subjective questions in history exams. The system consists of:

- **Frontend**: Chrome Extension (React + Vite + TypeScript)
- **Backend**: Next.js API server (PostgreSQL + Prisma)

The system integrates with Chinese educational platforms (智学网, 好分数) to provide AI-assisted grading with support for multiple AI providers (Gemini, OpenAI, 智谱AI).

---

## 2. 项目模块概览

| 模块 | 路径 | 说明 |
|------|------|------|
| **aigradingfrontend** | `/aigradingfrontend` | Chrome 扩展前端 (React + Vite) |
| **aigradingbackend** | `/aigradingbackend` | Next.js API 后端 |
| **grading-platform-v2** | `/grading-platform-v2` | 扩展应用 v2 版本 (重构中) |
| **docs** | `/docs` | 设计规范文档 |

---

## 3. 前端架构 (aigradingfrontend)

### 3.1 技术栈

- **Framework**: React 18 + Vite 5
- **Language**: TypeScript 5.2+
- **State Management**: Zustand 5.0 (带持久化)
- **UI Library**: HeroUI 2.8 + Tailwind CSS 4.1
- **Icons**: Lucide React
- **Build**: Chrome Extension (CRXJS Vite Plugin)
- **Virtual List**: @tanstack/react-virtual
- **Charts**: Chart.js + react-chartjs-2

### 3.2 目录结构

```
aigradingfrontend/src/
├── components/
│   ├── heroui/           # HeroUI 组件库
│   │   ├── button/
│   │   ├── card/
│   │   └── input/
│   └── v2/               # V2 版本组件
│       ├── layout/        # 布局组件
│       ├── onboarding/    # 引导流程
│       ├── rubric/       # 评分细则组件
│       │   └── RubricEditPanel.tsx
│       └── views/        # 视图组件
│           ├── GradingViewV2.tsx       # 批改视图
│           ├── AnalysisViewV2.tsx      # 分析视图
│           ├── RecordsViewV2.tsx       # 记录视图
│           ├── RubricListView.tsx     # 细则列表
│           ├── RubricPanel.tsx         # 细则面板
│           ├── RubricResultView.tsx    # 结果视图
│           ├── CreateRubricWizard.tsx  # 创建向导
│           └── SettingsViewV2.tsx      # 设置视图
├── stores/
│   └── useAppStore.ts    # Zustand 全局状态
├── services/
│   ├── proxyService.ts   # 后端 API 代理
│   ├── rubricService.ts  # 细则服务
│   ├── config-service.ts # 配置服务
│   └── geminiService.ts # Gemini AI 服务
├── types/
│   └── rubric-v3.ts      # Rubric v3 类型定义
├── utils/
│   ├── rubric-convert.ts # 细则转换
│   ├── rubric-converter.ts
│   └── storage.ts        # 存储工具
└── App.tsx               # 应用入口
```

### 3.3 状态管理 (Zustand)

核心状态结构:

```typescript
interface AppState {
    // 导航状态
    activeTab: Tab;

    // 评分细则状态
    isRubricConfigured: boolean;
    rubricContent: string;
    rubricData: Record<string, any>;

    // 考试管理
    exams: Exam[];
    activeExamId: string | null;

    // 批改策略
    gradingStrategy: GradingStrategy;  // 'pro', 'flash', 'reasoning'

    // V2 界面开关
    showV2: boolean;
    appMode: 'enterprise' | 'personal';
    gradingMode: 'assist' | 'auto';

    // 应用状态
    status: 'idle' | 'scanning' | 'thinking' | 'result' | 'error';

    // 历史记录
    historyRecords: HistoryRecord[];

    // 账户/激活码
    activationCode: string | null;
    quota: { remaining, total, isPaid, status };
}
```

### 3.4 导航模式

采用 **View Stack 模式** (非传统路由):

```typescript
// 视图栈示例
viewStack: ['exams', 'questions', 'detail', 'point_editor']

// 导航操作
pushView('questions');    // 入栈
popView();                // 出栈
setViewStack(['exams']);  // 重置
```

---

## 4. 后端架构 (aigradingbackend)

### 4.1 技术栈

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Database**: PostgreSQL + Prisma 5
- **Validation**: Zod
- **AI Services**:
  - Gemini (via GPTsAPI proxy)
  - 智谱 GLM-4
  - OpenAI GPT-4o
- **Auth**: JWT + bcryptjs

### 4.2 API 端点

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/ai/grade` | POST | AI 批改学生答案 |
| `/api/ai/rubric` | POST | AI 生成评分细则 |
| `/api/rubric` | GET/POST/DELETE | 评分细则 CRUD |
| `/api/exams` | GET/POST | 考试管理 |
| `/api/activation/verify` | POST | 激活码验证 |
| `/api/client/quota/*` | GET/POST | 配额管理 |

### 4.3 核心库 (lib/)

| 文件 | 功能 |
|------|------|
| `gpt.ts` | GPT-4o API 封装 (主要 AI 判定) |
| `gemini.ts` | Gemini API 封装 |
| `zhipu.ts` | 智谱 GLM-4 API 封装 |
| `rubric-v3.ts` | Rubric v3 Schema 定义 |
| `rubric-judge.ts` | AI 判定结果解析 |
| `score-engine.ts` | 分数计算引擎 |
| `rubric-convert.ts` | 细则格式转换 |
| `config-service.ts` | 配置服务 |
| `prisma.ts` | Prisma 客户端 |
| `auth.ts` | 认证逻辑 |
| `rate-limiter.ts` | 速率限制 |
| `logger.ts` | 日志服务 |
| `feature-flags.ts` | 特性开关 |

---

## 5. 数据库模型

### 核心表结构

```prisma
// 用户表
model User {
    id        String   @id @default(cuid())
    email     String   @unique
    password  String   // bcrypt 加密
    role      Role     @default(TEACHER)
    configs   Config[]
}

// 评分细则表 (基于激活码存储，支持跨设备同步)
model DeviceRubric {
    id              String   @id @default(cuid())
    activationCode  String   // 关联激活码 (跨设备同步核心)
    deviceId        String?  // 来源设备 ID
    questionKey     String   // 题目唯一 KEY
    examId          String?  // 所属考试 ID
    lifecycleStatus String   @default("draft") // draft | published
    rubric          String   // JSON 字符串

    @@unique([activationCode, questionKey])
}

// 考试汇总表
model Exam {
    id              String   @id @default(cuid())
    activationCode  String   // 关联激活码
    name            String
    date            DateTime?
    subject         String?
    grade           String?
}

// 批改记录表
model GradingRecord {
    id             String   @id @default(cuid())
    activationCode String   // 关联激活码
    deviceId       String?
    questionNo     String?
    questionKey    String?
    studentName    String
    examNo         String?
    score          Float
    maxScore       Float
    comment        String?
    breakdown      String?  // JSON 字符串
}

// 激活码表
model ActivationCode {
    id          String    @id @default(cuid())
    code        String    @unique // 格式: ZY-XXXX-XXXX
    type        String    // trial, basic, standard, pro
    quota       Int       // 配额数量
    remaining   Int       // 剩余配额
    used        Int       // 已使用
    reusable    Boolean   @default(false) // 是否可重复使用
    maxDevices  Int       @default(1)
    status      String    @default("active")
    expiresAt   DateTime?
}

// 设备配额表
model DeviceQuota {
    id         String   @id @default(cuid())
    deviceId   String   @unique
    remaining  Int      @default(0)
    total      Int      @default(0)
    used       Int      @default(0)
}

// 评分细则模板
model RubricTemplate {
    id               String   @id @default(cuid())
    scope            String   @default("user") // system | user
    activationCode   String?
    questionKey      String?
    lifecycleStatus  String   @default("draft")
    subject          String?
    grade            String?
    questionType     String?
    strategyType     String
    version          String   @default("3.0")
    content          Json?
}
```

---

## 6. 核心设计模式

### 6.1 设备 ID + 激活码双轨制

```typescript
// 前端 - 获取标识符
function getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}

// 后端 - 优先级: 激活码 > 设备 ID > 匿名
function getUserIdentifier(request: NextRequest): string {
    const activationCode = request.headers.get('x-activation-code');
    const deviceId = request.headers.get('x-device-id');

    if (activationCode) return activationCode;
    if (deviceId) return `device:${deviceId}`;
    return `anonymous:${Date.now()}_${Math.random()}`;
}
```

### 6.2 多 AI Provider 回退

```typescript
// 优先级: GPTSAPI (GPT-4o) → Zhipu (GLM-4) → Gemini
try {
    // 1. 尝试 GPT-4o
    const judge = await judgeWithGPT({ imageBase64, rubric, studentName }, strategy);
    provider = 'gptsapi-judge';
} catch (gptError) {
    try {
        // 2. 回退到智谱
        const judge = await judgeWithZhipu({ imageBase64, rubric, studentName });
        provider = 'zhipu-judge';
    } catch (zhipuError) {
        // 3. 回退到 Gemini
        if (isGeminiAvailable()) {
            const judge = await judgeWithGemini({ imageBase64, rubric, studentName }, strategy);
            provider = 'gemini-judge';
        }
    }
}
```

### 6.3 数据加载优先级

```typescript
// 评分细则加载优先级
async function loadRubricForQuestion(questionKey) {
    // 1. 内存缓存 (rubricData)
    if (state.rubricData[questionKey]) { ... return; }

    // 2. 本地存储 (localStorage / chrome.storage.local)
    const localRubric = await storage.getItem(storageKey);
    if (localRubric) { ... return; }

    // 3. 兜底匹配 (根据题号/学科/考试名)
    const candidates = await searchCandidates(...);
    if (candidates.length > 0) { ... return; }

    // 4. 后端加载 (正式会员)
    if (state.isOfficial) {
        const serverRubric = await loadRubricFromServer(questionKey);
        if (serverRubric) { ... return; }
    }

    // 5. 全部落空 - 重置状态
    set({ rubricContent: '', isRubricConfigured: false });
}
```

---

## 7. Rubric v3 数据结构

```typescript
interface RubricJSONV3 {
    version: "3.0";
    metadata: {
        questionId: string;
        title: string;
        subject?: string;
        grade?: string;
        questionType?: string;
        examId?: string | null;
        examName?: string;
    };
    strategyType: 'point_accumulation' | 'sequential_logic' | 'rubric_matrix';
    content: PointAccumulationContent | SequentialLogicContent | RubricMatrixContent;
    constraints?: RubricConstraint[];
    createdAt: string;
    updatedAt: string;
}
```

### 评分策略类型

| 策略类型 | 说明 |
|----------|------|
| `point_accumulation` | 积分累加 (默认) |
| `sequential_logic` | 顺序逻辑 |
| `rubric_matrix` | 评分矩阵 |

---

## 8. AI 评分流程

```
用户上传答卷图片
        │
        ▼
┌───────────────────┐
│  图片压缩 (70-90%) │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  AI 判定 (GPT-4o)  │
│  + 关键词匹配      │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  分数计算引擎      │
│  - 策略计算        │
│  - 约束规则        │
│  - 分段聚合        │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  返回结果          │
│  - score, maxScore│
│  - breakdown      │
│  - confidence     │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  扣减配额          │
│  + 存储记录        │
└───────────────────┘
```

---

## 9. 设计亮点

1. **设备 ID 回退机制** - 匿名用户可试用
2. **AI 多级容灾** - 保证服务可用性
3. **Zustand + 持久化** - 简单高效的状态管理
4. **Prisma 类型安全** - 数据库操作安全
5. **分数计算引擎** - 灵活的评分策略
6. **图片压缩优化** - 70-90% 压缩率

---

## 10. 开发命令

### Frontend (Chrome Extension)
```bash
cd aigradingfrontend
npm run dev          # Development build with hot reload
npm run build        # Production build (outputs to dist/)
npm run build:check  # Type-check + build
```

### Backend (Next.js API)
```bash
cd aigradingbackend
npm run dev          # Start development server (port 3000)
npm run build        # Production build
npm run db:push      # Push schema changes to database
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio
```

### Database Seeding
```bash
cd aigradingbackend
npx tsx prisma/seed.ts  # Insert test activation codes
```

---

## 11. 测试激活码

使用 seeded test codes (after running `npx tsx prisma/seed.ts`):

- `TEST-1111-2222-3333` - Trial (300 uses, one-time)
- `BASIC-AAAA-BBBB-CCCC` - Basic (1000 uses, reusable)
- `PRO-XXXX-YYYY-ZZZZ` - Pro (3000 uses, reusable)
- `PERM-AAAA-BBBB-CCCC` - Permanent (999999 uses, reusable)
