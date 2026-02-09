# AI Grading Assistant - GEMINI Context

## 1. Project Overview
The **AI Grading Assistant (AI 智能批改助手)** is a full-stack application designed to help teachers efficiently grade history subjective questions using AI. It consists of a Chrome Extension frontend and a Next.js backend.

### Project Variants
The codebase contains two distinct paths for different user needs:
- **Personal Version (`personal/`)**: A client-only Chrome Extension. Users provide their own AI API keys. Data is stored locally in the browser (LocalStorage). Best for individual use.
- **Full-stack/Enterprise Version (`aigradingfrontend/` + `aigradingbackend/`)**: A client-server architecture. The backend manages API keys, quotas via activation codes, and stores records in a database for cross-device sync. Best for schools and commercial use. **(Current Focus)**

### Core Features (Full-stack)
- **AI Grading**: Intelligent scoring of subjective answers using Google Gemini (primary) and Zhipu AI (backup).
- **Activation System**: Code-based access control and quota management.
- **Grading Records**: History of graded papers with detailed feedback.
- **Data Analysis**: Statistical dashboards for teachers/admins.
- **Multi-Platform API**: Support for switching between AI providers (CherryIN, LaoZhang AI).

## 2. Architecture & Tech Stack

### Frontend (`aigradingfrontend`)
- **Type**: Chrome Extension (manifest v3).
- **Framework**: React 18 + Vite 5.
- **Language**: TypeScript.
- **Styling**: Tailwind CSS 4.
- **State Management**: Zustand.
- **Key Libs**: `@google/generative-ai`, `lucide-react`, `chart.js`.

### Backend (`aigradingbackend`)
- **Type**: Web Application & API.
- **Framework**: Next.js 14 (App Router).
- **Language**: TypeScript.
- **Database**: PostgreSQL (Production) / SQLite (Development) via **Prisma ORM**.
- **Auth**: JWT (Stateless).
- **AI Integration**: Custom services for Gemini (via GPTsAPI proxy) and Zhipu GLM-4.

## 3. Getting Started & Development

### Prerequisites
- Node.js >= 18
- npm >= 9

### Backend Setup (`aigradingbackend`)
```bash
cd aigradingbackend
npm install
cp .env.example .env        # Configure DB and API Keys
npx prisma db push          # Push schema to DB (SQLite default)
npm run dev                 # Start server at http://localhost:3000
```

### Frontend Setup (`aigradingfrontend`)
```bash
cd aigradingfrontend
npm install
npm run dev                 # Start dev server
npm run build               # Build extension to /dist
# Load /dist as an unpacked extension in Chrome Developer Mode
```

### Key Commands
- **Backend Dev**: `npm run dev`
- **Backend Build**: `npm run build`
- **Database Studio**: `npx prisma studio` (View/Edit DB data UI)
- **Database Push**: `npx prisma db push` (Sync schema to DB)
- **Frontend Dev**: `npm run dev`
- **Frontend Build**: `npm run build`
- **Platform Comparison**: `node scripts/compare-platforms.js`

## 4. Project Structure

### Root
- `scripts/`: Utility scripts (e.g., API platform comparison).
- `rubric_examples/`: JSON examples for grading rubrics.

### Backend (`aigradingbackend/src`)
- `app/api/`: API Routes (Next.js App Router).
- `lib/`: Core logic (AI services, Auth, DB client).
    - `gpt.ts`: Gemini service logic.
    - `zhipu.ts`: Zhipu AI service logic.
    - `prisma.ts`: DB client instance.
- `prisma/`: Database schema (`schema.prisma`) and migrations.
- `middleware.ts`: Auth and CORS handling.

### Frontend (`aigradingfrontend`)
- `src/`: Source code.
- `public/`: Static assets (manifest.json).
- `vite.config.ts`: Vite configuration.

## 5. Conventions & Best Practices
- **Language**: Use TypeScript for all new code.
- **Styling**: Use Tailwind CSS utility classes. Avoid custom CSS files where possible.
- **Database**: Always use Prisma for database interactions. Run `npx prisma db push` after schema changes.
- **AI Service**: Use the defined services in `lib/` (e.g., `gpt.ts`) instead of calling APIs directly in components.
- **Environment Variables**: Store sensitive keys (API Keys, DB URL) in `.env`.

## 6. Device-ID Fallback Mechanism

**Critical Architecture Pattern**: The system implements a "device-id fallback" mechanism for user identification:

### Identifier Priority
1. **Activation Code** (`x-activation-code` header) - Primary identifier for cross-device sync
2. **Device ID** (`x-device-id` header) - Fallback for anonymous/trial users

### Implementation
- Backend APIs accept either identifier via `getUserIdentifier()` helper function
- When no activation code is provided, the system uses `device:${deviceId}` as the identifier
- Both user types are stored in the same database tables, differentiated by identifier format

### User Types
| User Type | Identifier Format | Cross-Device Sync | Quota Management |
|-----------|------------------|-------------------|-----------------|
| Activated | `ACTIVATION-CODE` | ✅ Yes | Server-side (activation codes) |
| Anonymous | `device:DEVICE_ID` | ❌ No | Device-local (localStorage) |

## 7. Data Model Hierarchy

The system uses a hierarchical structure for organizing grading content:

```
Exam (考试)
  └── DeviceRubric (评分细则) - linked via examId
      └── GradingRecord (批改记录) - linked via questionKey
```

### Key Design Principles
- **Exams as Containers**: Exams serve as folders/categories for organizing rubrics
- **User Workflow**: Select exam → Configure rubrics → Grade papers
- **Navigation Flow**: `exams` → `questions` → `detail` → `point_editor` → `question_settings`

## 8. RubricJSON v2 Format

Rubrics are stored using a structured JSON schema:

```typescript
interface RubricJSON {
  version: "2.0";
  questionId: string;
  title: string;
  totalScore: number;
  scoringStrategy: {
    type: 'pick_n' | 'all' | 'weighted';
    maxPoints?: number;
    pointValue?: number;
    allowAlternative: boolean;
    strictMode: boolean;
  };
  answerPoints: Array<{
    id: string;
    content: string;
    keywords: string[];
    score: number;
  }>;
  gradingNotes: string[];
  createdAt: string;
  updatedAt: string;
}
```

## 9. Frontend State Management

### Zustand Store (`useAppStore.ts`)
- Centralized state with persistence to localStorage
- Manages: exams, rubrics, activation code, quota, history records
- Computed property: `currentQuestionKey = manualQuestionKey || detectedQuestionKey`

### View Stack Pattern (`RubricDrawer.tsx`)
Navigation implemented using a stack array:
```typescript
const [viewStack, setViewStack] = useState<View[]>(['exams']);

// Push new view
pushView('questions');

// Pop to previous
popView();

// Current view determines rendering
const currentView = viewStack[viewStack.length - 1];
```

## 10. Key API Endpoints

### Exams API
- `GET /api/exams` - List exams (filtered by user identifier)
- `POST /api/exams` - Create new exam
- `PUT /api/exams/[id]` - Update exam
- `DELETE /api/exams/[id]` - Delete exam (sets rubrics' examId to null)

### Rubric API
- `GET /api/rubric` - List rubrics (with optional examId filter)
- `POST /api/rubric` - Save rubric (supports conflict detection, returns 409 on conflict)
- `DELETE /api/rubric?questionKey=X` - Delete rubric

### AI Grading API
- `POST /api/ai/grade` - Grade answer image with rubric
  - Headers: `x-activation-code` (optional), `x-device-id`
  - Body: `imageBase64`, `rubric`, `studentName`, `questionNo`

## 11. Current Development Phase
- **Status**: Backend v0.1.0, Frontend v0.0.0.
- **Recent Updates**:
    - ✅ Device-ID fallback mechanism implemented
    - ✅ Exam-rubric hierarchy navigation complete
    - ✅ Full CRUD for exams and rubrics (anonymous and activated users)
- **Active Tasks**:
    - **Phase 1**: Security hardening (JWT refresh, Rate limiting)
    - **Phase 2**: Grading records enhancement (syncing via activation code)
    - **Integration**: "CherryIN" API platform integration for cost optimization

## 12. Key Configuration Files
- `aigradingbackend/.env`: Backend environment variables
- `aigradingbackend/prisma/schema.prisma`: Database schema definition
- `aigradingfrontend/vite.config.ts`: Frontend build config
- `backend_development_plan.md`: Detailed roadmap and architectural decisions
- `CLAUDE.md`: Claude Code AI assistant context file

## 13. Test Activation Codes
After running `npx tsx prisma/seed.ts`:
- `TEST-1111-2222-3333` - Trial (300 uses, one-time)
- `BASIC-AAAA-BBBB-CCCC` - Basic (1000 uses, reusable)
- `PRO-XXXX-YYYY-ZZZZ` - Pro (3000 uses, reusable)
- `PERM-AAAA-BBBB-CCCC` - Permanent (999999 uses, reusable)

## 14. Troubleshooting & Lessons Learned

### ⚠️ Zustand Getter 陷阱 (2026-02-05)

**问题现象**：导入评分细则后，编辑界面不显示数据，`currentQuestionKey` 始终为空。

**根本原因**：在 Zustand store 中使用 getter 定义计算属性时，直接解构会失效。

```typescript
// ❌ 错误：store 中定义 getter
export const useAppStore = create((set, get) => ({
    get currentQuestionKey() {
        return get().manualQuestionKey || get().detectedQuestionKey;
    }
}));

// ❌ 错误：组件中直接解构 getter
const { currentQuestionKey } = useAppStore(); // 返回 undefined 或函数本身！
```

**解决方案**：

```typescript
// ✅ 正确：在组件中手动计算
const { manualQuestionKey, detectedQuestionKey } = useAppStore();
const currentQuestionKey = manualQuestionKey || detectedQuestionKey;

// ✅ 或使用 selector
const currentQuestionKey = useAppStore(state => 
    state.manualQuestionKey || state.detectedQuestionKey
);
```

**最佳实践**：
- Zustand 中避免使用 getter 定义计算属性
- 计算属性应在组件内使用 `useMemo` 或直接计算
- 调试时使用 `useAppStore.getState()` 检查实际状态

---

### 🔄 数据字段一致性问题

**问题现象**：导入的评分细则在编辑时得分点为空。

**根本原因**：代码中同时存在 `answerPoints` 和 `points` 两个字段：
- 导入逻辑只保存了 `points`
- 编辑组件优先读取 `answerPoints`

**解决方案**：导入时同时保存两个字段，确保兼容性：
```typescript
const rubricConfig = {
    answerPoints: points,
    points: points,  // 同时保存两个字段
    // ...
};
```

**最佳实践**：
- 定义数据结构时统一字段命名，避免同义字段共存
- 如果必须兼容旧数据，在读取时做 fallback，在写入时同步维护

---

### 📦 Chrome 扩展存储 API 差异

**问题现象**：开发环境正常，生产环境（Chrome 扩展）数据丢失。

**根本原因**：
- 开发环境：使用 `localStorage`（同步 API）
- 生产环境：使用 `chrome.storage.local`（异步 API）

**解决方案**：封装统一的 storage 抽象层：
```typescript
const storage = {
    async getItem(key: string) {
        if (chrome?.storage?.local) {
            return new Promise(resolve => chrome.storage.local.get(key, r => resolve(r[key])));
        }
        return localStorage.getItem(key);
    },
    async setItem(key: string, value: string) {
        if (chrome?.storage?.local) {
            return chrome.storage.local.set({ [key]: value });
        }
        localStorage.setItem(key, value);
    }
};
```

---

### 🔗 API 调用架构混乱

**问题现象**：切换 AI 服务商困难，错误处理不一致。

**根本原因**：多个 AI 服务商（Gemini、智谱、CherryIN）的调用逻辑分散在各个组件中。

**解决方案**：建立统一的 `ai-router` 层，所有 AI 调用通过路由器分发：
```typescript
// ai-router.ts
export async function callAI(prompt: string, options: AIOptions) {
    const provider = getActiveProvider();
    switch (provider) {
        case 'gemini': return geminiService.call(prompt, options);
        case 'zhipu': return zhipuService.call(prompt, options);
        default: throw new Error('Unknown provider');
    }
}
```

**最佳实践**：
- 外部服务调用统一走服务层，组件不直接调用 API
- 错误处理和重试逻辑集中在服务层

---

### 🚦 自动批改中断与恢复

**问题现象**：批改大量试卷时遭遇 API 限流或网络中断，进度丢失。

**解决方案**：
1. **智能限流**：根据 API 返回的 429 状态动态调整请求间隔
2. **会话恢复**：将批改进度存储到 localStorage，支持断点续批
3. **错误重试**：网络错误自动重试 3 次，间隔递增

**最佳实践**：
- 长时间任务必须支持中断恢复
- 向用户反馈当前进度和预计剩余时间

---

### 🎨 UI 空状态设计

**问题现象**：功能按钮只放在 header，用户在空白页不知如何操作。

**解决方案**：空状态页面提供明确的行动入口：
```tsx
{isEmpty && (
    <div className="empty-state">
        <p>还没有评分细则</p>
        <div className="flex gap-3">
            <Button onClick={handleCreate}>AI 创建</Button>
            <Button onClick={handleImport}>导入 JSON</Button>
        </div>
    </div>
)}
```

**最佳实践**：
- 空状态不仅要解释"为什么是空的"，还要告诉用户"如何开始"
- 主要行动按钮应该在用户视线焦点处，而非隐藏在 header
