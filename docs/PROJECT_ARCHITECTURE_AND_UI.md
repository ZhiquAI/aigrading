# AI 智能批改助手 - 项目架构与 UI 设计说明

> 📅 最后更新：2026-02-08
> 
> 本文档面向开发者和产品经理，介绍本项目的整体技术架构和界面设计理念。

---

## 📋 目录

- [一、项目概览](#一项目概览)
- [二、技术架构](#二技术架构)
  - [2.1 前端架构](#21-前端架构)
  - [2.2 后端架构](#22-后端架构)
  - [2.3 数据流与同步机制](#23-数据流与同步机制)
- [三、数据模型](#三数据模型)
- [四、UI 设计理念](#四ui-设计理念)
  - [4.1 视觉风格](#41-视觉风格)
  - [4.2 核心界面](#42-核心界面)
  - [4.3 组件架构](#43-组件架构)
- [五、关键技术决策](#五关键技术决策)
- [六、探索方向](#六探索方向)

---

## 一、项目概览

**AI 智能批改助手**是一款面向教师的 AI 辅助阅卷工具，目标是让主观题批改既**准确**又**高效**。

### 核心价值

| 痛点 | 解决方案 |
|------|----------|
| 主观题评分标准难统一 | 结构化「评分细则 JSON」+ AI 语义理解 |
| 手工阅卷效率低 | 自动识别答题卡 + 一键批改 |
| 跨设备数据不同步 | 激活码体系 + 云端同步 |
| AI 服务商不稳定 | 多平台路由 + 智能切换 |

### 产品形态

```
┌────────────────────────────────────────────────────────────┐
│                      Chrome 扩展                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   细则配置   │─▶│   智能阅卷   │─▶│   数据分析   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │            │
│         ▼                  ▼                  ▼            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    后端 API                          │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## 二、技术架构

### 2.1 前端架构

**技术栈**：React 18 + TypeScript + Vite 5 + Tailwind CSS 4 + Zustand

```
aigradingfrontend/
├── App.tsx                 # 应用入口
├── components/             # UI 组件
│   ├── GradingView.tsx     # 🎯 核心：阅卷主界面
│   ├── UnifiedRubricEditor.tsx  # 评分细则编辑器
│   ├── HistoryView.tsx     # 批改历史
│   ├── AnalysisView.tsx    # 数据分析
│   ├── SettingsView.tsx    # 设置页
│   └── ui/                 # 基础 UI 组件
├── services/               # 服务层
│   ├── ai-router.ts        # 🔀 AI 服务路由
│   ├── geminiService.ts    # Gemini AI 核心
│   ├── openaiService.ts    # OpenAI 兼容接口
│   ├── zhipuService.ts     # 智谱 AI 备用
│   └── rubric-service.ts   # 评分细则管理
├── stores/
│   └── useAppStore.ts      # Zustand 全局状态
├── types.ts                # 类型定义
└── manifest.json           # Chrome 扩展配置
```

#### 状态管理设计 (Zustand)

采用**单一数据源**模式，所有核心状态集中管理：

```typescript
// 核心状态切片
interface AppState {
  // 导航
  activeTab: Tab;           // 当前页签
  
  // 评分细则
  rubricLibrary: Rubric[];  // 细则列表
  rubricData: Record<string, RubricJSON>;  // 细则内容
  
  // 阅卷上下文
  detectedQuestionKey: string | null;  // 自动检测的题目
  manualQuestionKey: string | null;    // 手动选择的题目
  
  // 账户状态
  activationCode: string | null;
  quota: { remaining: number; total: number; isPaid: boolean };
}
```

#### 服务层设计

```
                    ┌─────────────────┐
                    │   ai-router.ts  │  ◀── 统一入口
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ geminiService   │ │ openaiService   │ │ zhipuService    │
│ (Gemini 2.0)    │ │ (OpenRouter)    │ │ (GLM-4V)        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 2.2 后端架构

**技术栈**：Next.js 14 (App Router) + Prisma ORM + PostgreSQL

```
aigradingbackend/
├── src/
│   ├── app/api/            # API 路由
│   │   ├── activate/       # 激活码验证
│   │   ├── rubric/         # 评分细则 CRUD
│   │   ├── records/        # 批改记录同步
│   │   ├── exams/          # 考试管理
│   │   └── ai/grade/       # AI 批改代理
│   ├── lib/
│   │   ├── prisma.ts       # 数据库客户端
│   │   ├── gpt.ts          # Gemini 服务
│   │   └── zhipu.ts        # 智谱服务
│   └── middleware.ts       # 认证 & CORS
├── prisma/
│   └── schema.prisma       # 数据库模型定义
└── .env                    # 环境变量
```

#### 核心 API 端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/activate` | POST | 验证激活码、分配配额 |
| `/api/rubric` | GET/POST/DELETE | 评分细则 CRUD（含 `lifecycleStatus: draft \| published`） |
| `/api/records` | GET/POST | 批改记录同步 |
| `/api/exams` | GET/POST/PUT/DELETE | 考试管理 |
| `/api/ai/grade` | POST | AI 批改（代理模式） |

#### 本次数据层变更（2026-02-08）

- `DeviceRubric` 新增字段：`lifecycleStatus`（默认 `draft`）
- `/api/rubric`：GET/POST 返回并持久化生命周期状态
- 前端同步：`saveRubricToServer` 增加 `lifecycleStatus` 参数

```bash
# 落库（生产/测试环境都需要执行）
cd aigradingbackend
npx prisma db push
```

### 2.3 数据流与同步机制

#### Device-ID Fallback 机制

这是本系统的**核心设计模式**，支持两类用户共存：

```
┌────────────────────────────────────────────────────────────┐
│                     请求识别流程                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   HTTP 请求                                                │
│      │                                                     │
│      ▼                                                     │
│   检查 x-activation-code header                            │
│      │                                                     │
│      ├─ 有效 ──▶ 使用激活码作为 userIdentifier             │
│      │          ✅ 跨设备同步                              │
│      │          ✅ 服务端配额管理                          │
│      │                                                     │
│      └─ 无 ────▶ 使用 x-device-id 作为 userIdentifier      │
│                  ❌ 仅本地存储                             │
│                  ❌ 本地配额管理                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### 同步策略

| 场景 | 策略 |
|------|------|
| 评分细则保存 | **本地优先** → 异步同步到后端（携带 `lifecycleStatus`） |
| 评分细则加载 | 内存缓存 → 本地存储 → 后端拉取（合并服务端状态） |
| 模板流程 | `生成` → `编辑保存(草稿)` → `发布模板(已发布)` |
| 批改记录 | 实时同步到后端（仅正式会员） |

---

## 三、数据模型

### 层级结构

```
考试 (Exam)
  └── 评分细则 (DeviceRubric)              ◀── 通过 examId 关联
      ├── 生命周期状态 (lifecycleStatus)   ◀── draft / published
      └── 批改记录 (GradingRecord)         ◀── 通过 questionKey 关联
```

### 核心实体

#### 评分细则 (RubricJSON v3.0)

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
  strategyType: "point_accumulation" | "sequential_logic" | "rubric_matrix";
  content: {
    // 根据 strategyType 分别使用 points / steps / dimensions
  };
  constraints?: Array<{
    id: string;
    type: string;
    description?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

#### 评分细则表 (DeviceRubric)

```typescript
{
  activationCode: string;             // 用户标识（激活码或 device 标识）
  questionKey: string;                // 题目标识
  examId?: string | null;             // 关联考试
  lifecycleStatus: "draft" | "published"; // 生命周期状态
  rubric: string;                     // RubricJSONV3 字符串
  createdAt: Date;
  updatedAt: Date;
}
```

#### 激活码 (ActivationCode)

```typescript
{
  code: "ZY-XXXX-XXXX",     // 格式化的激活码
  type: "trial" | "basic" | "pro" | "permanent",
  quota: number,            // 配额上限
  remaining: number,        // 剩余配额
  reusable: boolean,        // 可重复激活
  maxDevices: number,       // 最大设备数
  status: "active" | "disabled",
  expiresAt?: Date          // 过期时间
}
```

---

## 四、UI 设计理念

### 4.1 视觉风格

**设计语言**：现代简约 + 专业教育风

| 要素 | 规范 |
|------|------|
| 主色调 | 蓝色系 `#3B82F6` (专业、信任) |
| 辅助色 | 绿色 `#10B981` (成功)、红色 `#EF4444` (警告) |
| 圆角 | 8px (卡片)、4px (按钮) |
| 阴影 | 轻量柔和 `shadow-sm` ~ `shadow-md` |
| 字体 | Inter / 系统默认无衬线 |

### 4.2 核心界面

#### 工作流导航

```
┌─────────────────────────────────────────────────────────────┐
│  [细则配置]  ───▶  [智能阅卷]  ───▶  [批改历史]  ───▶  [设置]  │
│     📋              ✏️               📊               ⚙️      │
└─────────────────────────────────────────────────────────────┘
     阅卷前            阅卷中            阅卷后          随时
```

#### 界面布局

**细则配置页 (RubricEditor)**

```
┌────────────────────────────────────────────────────────────┐
│ 📋 评分细则                                [AI生成] [导入]   │
├────────────────────────────────────────────────────────────┤
│ 🏫 考试：期中考试                          [新建考试 ▾]      │
├────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│ │ 第25题   │ │ 第26题   │ │  + 新增  │                    │
│ │ 材料分析 │ │ 论述题   │ │          │                    │
│ └──────────┘ └──────────┘ └──────────┘                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  得分点 1: 时代背景 (2分)                                   │
│  ├─ 关键词: "工业革命", "资本主义"                          │
│  └─ 评分说明: 答出任一关键词即可得分                        │
│                                                            │
│  得分点 2: 历史意义 (3分)                                   │
│  ├─ 关键词: "推动发展", "促进变革"                          │
│  └─ 评分说明: 需要完整表述                                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**阅卷主界面 (GradingView)**

```
┌────────────────────────────────────────────────────────────┐
│ 🔍 当前: 第25题 | 张三                    [手动模式 ▾] [⚙️] │
├───────────────────────────────────┬────────────────────────┤
│                                   │                        │
│     ┌─────────────────────┐      │  得分: 8/10            │
│     │                     │      │                        │
│     │   📷 答题卡图片      │      │  ✅ 得分点1: 2/2      │
│     │                     │      │  ✅ 得分点2: 3/3      │
│     │                     │      │  ⚠️ 得分点3: 1/3      │
│     │                     │      │  ❌ 得分点4: 0/2      │
│     └─────────────────────┘      │                        │
│                                   │  💬 评语:              │
│                                   │  回答较完整，第三点    │
│                                   │  表述欠清晰            │
│                                   │                        │
├───────────────────────────────────┴────────────────────────┤
│                        [提交成绩]                           │
└────────────────────────────────────────────────────────────┘
```

### 4.3 组件架构

#### 核心组件一览

| 组件 | 职责 | 大小 |
|------|------|------|
| `GradingView` | 阅卷主界面，处理图像识别与评分 | ~75KB |
| `UnifiedRubricEditor` | 评分细则编辑器 | ~52KB |
| `HistoryView` | 批改记录展示与筛选 | ~45KB |
| `AnalysisView` | 数据可视化与统计 | ~35KB |
| `SettingsView` | 系统设置与账户管理 | ~26KB |

#### 视图栈导航模式

`RubricDrawer` 采用**栈式导航**，支持深层编辑：

```typescript
const [viewStack, setViewStack] = useState<View[]>(['exams']);

// 导航方法
const pushView = (view: View) => setViewStack([...viewStack, view]);
const popView = () => setViewStack(viewStack.slice(0, -1));

// 视图栈示例
['exams'] → ['exams', 'questions'] → ['exams', 'questions', 'detail']
```

---

## 五、关键技术决策

### 1. 为什么选择 Chrome 扩展？

| 考量 | 决策 |
|------|------|
| **目标用户场景** | 教师在各阅卷平台（智学网、好分数等）工作 |
| **技术可行性** | 扩展可直接访问页面 DOM，截取答题卡图片 |
| **部署简单** | 无需安装额外软件，一键加载 |

### 2. 为什么采用 Device-ID Fallback？

| 考量 | 决策 |
|------|------|
| **降低使用门槛** | 未激活用户仍可体验核心功能 |
| **数据隔离安全** | 设备级隔离，不同设备数据互不影响 |
| **平滑付费转化** | 激活后自动升级为云端同步 |

### 3. 为什么使用 Zustand 而非 Redux？

| 对比项 | Zustand | Redux |
|--------|---------|-------|
| 样板代码 | ✅ 极少 | ❌ 较多 |
| 学习成本 | ✅ 低 | ❌ 高 |
| 持久化支持 | ✅ 内置 | 需额外库 |
| 适合场景 | 中小型应用 | 大型复杂应用 |

### 4. AI 服务路由策略

```
优先级: OpenRouter (Gemini 2.0) → 直连 Gemini API → 智谱 GLM-4V
```

| 服务商 | 优势 | 劣势 |
|--------|------|------|
| OpenRouter | 稳定、多模型支持 | 需付费 |
| Gemini 直连 | 免费额度 | 国内访问不稳定 |
| 智谱 GLM-4V | 国内稳定 | 模型能力略弱 |

---

## 六、探索方向

以下是项目后续可能探索的 3 个方向，供读者思考：

1. **多模态支持增强**
   - 当前仅支持图像识别，是否可以支持 PDF 批量导入？
   - 如何处理手写字迹识别的准确率问题？

2. **协作阅卷能力**
   - 多位教师如何共享同一套评分细则？
   - 如何实现阅卷任务的分配与进度追踪？

3. **数据分析深化**
   - 如何从批改记录中挖掘学生的知识薄弱点？
   - 是否可以自动生成班级学情分析报告？

---

## 附录：快速入门

### 本地开发

```bash
# 后端
cd aigradingbackend
npm install
npx prisma db push
npm run dev

# 前端
cd aigradingfrontend
npm install
npm run dev
npm run build  # 构建扩展
# 在 Chrome 开发者模式加载 dist/ 目录
```

### 测试激活码

| 激活码 | 类型 | 配额 |
|--------|------|------|
| `TEST-1111-2222-3333` | 试用 | 300 次 |
| `BASIC-AAAA-BBBB-CCCC` | 基础 | 1000 次 |
| `PRO-XXXX-YYYY-ZZZZ` | 专业 | 3000 次 |

---

> 📝 文档作者：AI Assistant  
> 📧 如有疑问，欢迎讨论
