# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI 智能批改助手 - An AI-powered grading assistant for teachers, primarily for subjective questions in history exams.

**⚠️ 重要**: 项目正在进行大规模重构。详情请参阅 `AGENTS.md`。

### 当前系统

- **旧系统 (Legacy)**: `aigradingfrontend/` + `aigradingbackend/`
- **新系统 (V2)**: `grading-platform-v2/` (Monorepo)

新系统是重构主战场，旧系统仅作为迁移参考和紧急修复使用。

## Development Commands

### V2 Monorepo (推荐 / 当前重构主战场)
```bash
cd grading-platform-v2
pnpm install         # 安装依赖
pnpm dev             # 启动所有应用开发服务器
pnpm build           # 构建所有包和应用
pnpm lint            # 代码检查
pnpm typecheck       # 类型检查
pnpm test            # 运行测试
```

### Legacy 系统 (仅迁移参考)
```bash
# Frontend (Chrome Extension)
cd aigradingfrontend
npm run dev          # Development build with hot reload
npm run build        # Production build (outputs to dist/)

# Backend (Next.js API)
cd aigradingbackend
npm run dev          # Start development server (port 3000)
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Prisma Studio
```

To load the extension in Chrome:
1. Run `npm run build` (legacy) 或 build v2 extension-app
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Load unpacked extension from `dist/`

## Tech Stack

### V2 Monorepo
- **Package Manager**: pnpm + Turbo
- **Apps**:
  - `extension-app` - Chrome Extension (React + Vite + TypeScript)
  - `api-server` - Next.js 14 API Server
  - `admin-console` - Admin Dashboard
- **Packages**:
  - `domain-core` - Domain models
  - `api-contracts` - API type definitions
  - `ai-gateway` - AI service integration
  - `config-kernel` - Configuration
  - `extension-bridge` - Extension communication
  - `ui-kit` - Shared UI components

### Legacy System
- **Frontend**: React 18 + Vite 5 + Tailwind CSS 4.1 + Zustand
- **Backend**: Next.js 14 + Prisma 5 + PostgreSQL
- **AI Services**: Gemini, Zhipu GLM-4

## Development Conventions & Best Practices

> **重要**: 遵守 `AGENTS.md` 中的重构规则。当前唯一核心任务是按重启架构方案推进项目重构。

### Code Quality
- **Language**: Use TypeScript for all new code - no `any` types without justification
- **Type Safety**: Enable strict mode in tsconfig.json
- **Error Handling**: Always include proper error messages and logging

### Styling
- **Use Tailwind CSS**: Utility classes only - avoid custom CSS files
- **Component Styling**: Prefer `clsx` or `cn()` utility for conditional classes

### API Integration (V2)
- API routes go to `grading-platform-v2/apps/api-server/src/app/api/v2/`
- Use service layers in shared packages

### Security
- **Environment Variables**: Store sensitive keys (API Keys, DB URL) in `.env` files
- **Never Commit**: `.env`, `.env.local`, or any files with secrets
- **Device-ID Fallback**: Always support both activation codes AND device IDs


## Architecture Overview

### 重构架构 (V2)

详见 `docs/architecture/ai-grading-platform-v2-restart-architecture.md`

**核心原则**:
- Monorepo: pnpm + Turbo
- API v2: 仅维护 `/api/v2/*`
- AI 策略: 统一走后端网关 (`ai-gateway`)
- 身份体系: 激活码优先，设备回退

### Device-ID Fallback Mechanism

**Critical**: The system uses a "device-id fallback" mechanism for user identification:

- **Priority 1**: Activation code (`x-activation-code` header) - enables cross-device sync
- **Priority 2**: Device ID (`x-device-id` header) - enables anonymous/trial users to use cloud storage

Backend APIs accept either identifier. When no activation code is provided, the system uses `device:${deviceId}` as the identifier in the database.

### Legacy Architecture

```
Exam (考试)
  └── DeviceRubric (评分细则) - linked via examId
      └── GradingRecord (批改记录) - linked via questionKey
```

- Exams are containers/folders for organizing rubrics by exam
- Zustand Store (`stores/useAppStore.ts`) for state management
- View Stack Pattern in `RubricDrawer.tsx`

## RubricJSON v2 Format

Rubrics are stored as JSON with the following structure:

```typescript
{
  version: "2.0",
  questionId: string,
  title: string,
  totalScore: number,
  scoringStrategy: {
    type: 'pick_n' | 'all' | 'weighted',
    maxPoints?: number,
    pointValue?: number,
    allowAlternative: boolean,
    strictMode: boolean
  },
  answerPoints: Array<{
    id: string,
    content: string,
    keywords: string[],
    score: number
  }>,
  gradingNotes: string[],
  createdAt: string,
  updatedAt: string
}
```

## Common Patterns

### Adding a New API Endpoint

1. Create route file in `aigradingbackend/src/app/api/[endpoint]/route.ts`
2. Use `getUserIdentifier()` to get user identifier (activation-code or device-id fallback)
3. Use `formatIdentifierForLog()` for logging (automatically masks sensitive data)
4. Return JSON with `{ success: boolean, data?: any, error?: string }`

### Frontend API Calls

Use functions from `services/proxyService.ts`:
- `getExams()`, `createExam()`, `updateExam()`, `deleteExam()`
- `loadAllRubricsFromServer()`, `saveRubricToServer()`, `loadRubricFromServer()`

These automatically handle device-id and activation-code headers.

### View Stack Navigation (RubricDrawer)

```typescript
// Push new view
pushView('questions');

// Pop to previous view
popView();

// Replace entire stack
setViewStack(['exams']);

// Current view determines what's rendered
const currentView = viewStack[viewStack.length - 1];
```

## Environment Variables

**Backend** (`.env`):
```
DATABASE_URL="postgresql://..."
```

**Frontend** (Vite environment):
```
VITE_API_BASE_URL="http://localhost:3000"  # Default
```

## Important Notes

1. **Always use device-id fallback** in new API endpoints - never require activation codes
2. **Activation code format**: `XXX-XXXX-XXXX` (e.g., `TEST-1111-2222-3333`)
3. **Device ID storage**: `localStorage.getItem('device_id')` or `localStorage.getItem('activation_code')`
4. **Rubric conflicts**: The rubric API supports conflict detection (returns 409 with server/client data)
5. **Exam deletion**: When deleting an exam, associated rubrics have their `examId` set to `null` (not deleted)

## Testing Activation Codes

Use seeded test codes (after running `npx tsx prisma/seed.ts`):
- `TEST-1111-2222-3333` - Trial (300 uses, one-time)
- `BASIC-AAAA-BBBB-CCCC` - Basic (1000 uses, reusable)
- `PRO-XXXX-YYYY-ZZZZ` - Pro (3000 uses, reusable)
- `PERM-AAAA-BBBB-CCCC` - Permanent (999999 uses, reusable)
