# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI 智能批改助手 - An AI-powered grading assistant for teachers, primarily for subjective questions in history exams. The system consists of:

- **Frontend**: Chrome Extension (React + Vite + TypeScript)
- **Backend**: Next.js API server (PostgreSQL + Prisma)

The system integrates with Chinese educational platforms (智学网, 好分数) to provide AI-assisted grading with support for multiple AI providers (Gemini, OpenAI, 智谱AI).

## Development Commands

### Frontend (Chrome Extension)
```bash
cd aigradingfrontend
npm run dev          # Development build with hot reload
npm run build        # Production build (outputs to dist/)
npm run build:check  # Type-check + build
```

To load the extension in Chrome:
1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Load unpacked extension from `aigradingfrontend/dist`

### Backend (Next.js API)
```bash
cd aigradingbackend
npm run dev          # Start development server (port 3000)
npm run build        # Production build (includes Prisma client generation)
npm run db:push      # Push schema changes to database
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio (database UI)
```

### Database Seeding (Test Data)
```bash
cd aigradingbackend
npx tsx prisma/seed.ts  # Insert test activation codes
```

## Tech Stack

### Frontend
- **Framework**: React 18 + Vite 5
- **Language**: TypeScript 5.2+
- **Styling**: Tailwind CSS 4.1
- **State Management**: Zustand
- **Key Libraries**:
  - `@google/generative-ai` - Gemini AI integration
  - `lucide-react` - Icons
  - `@tanstack/react-virtual` - Virtual scrolling
  - `chart.js` - Data visualization

### Backend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Database**: PostgreSQL (Production) / SQLite (Development)
- **ORM**: Prisma 5
- **Auth**: JWT (Stateless)
- **AI Services**:
  - Gemini (via GPTsAPI proxy) - Primary
  - Zhipu GLM-4 - Backup
  - CherryIN, LaoZhang AI - Cost optimization options

## Development Conventions & Best Practices

### Code Quality
- **Language**: Use TypeScript for all new code - no `any` types without justification
- **Type Safety**: Enable strict mode in tsconfig.json
- **Error Handling**: Always include proper error messages and logging

### Styling
- **Use Tailwind CSS**: Utility classes only - avoid custom CSS files
- **Component Styling**: Prefer `clsx` or `cn()` utility for conditional classes
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints

### Database Operations
- **Always use Prisma**: Never write raw SQL queries
- **After Schema Changes**: Run `npm run db:push` to sync database
- **Migrations**: Use `npx prisma migrate dev` for production-safe schema changes

### API Integration
- **Use Service Layers**: Call functions from `services/` or `lib/` instead of direct API calls
- **Backend Services**: Use services in `aigradingbackend/src/lib/` (e.g., `gpt.ts`, `zhipu.ts`)
- **Frontend Services**: Use functions from `services/proxyService.ts` for backend communication

### Security
- **Environment Variables**: Store sensitive keys (API Keys, DB URL) in `.env` files
- **Never Commit**: `.env`, `.env.local`, or any files with secrets
- **Device-ID Fallback**: Always support both activation codes AND device IDs in new APIs

### Code Organization
- **Frontend Components**: Organize by feature in `src/components/`
- **API Routes**: Place in `aigradingbackend/src/app/api/` following REST conventions
- **Shared Types**: Define in dedicated `types.ts` files or `lib/` directory


## Architecture Overview

### Device-ID Fallback Mechanism

**Critical**: The system uses a "device-id fallback" mechanism for user identification:

- **Priority 1**: Activation code (`x-activation-code` header) - enables cross-device sync
- **Priority 2**: Device ID (`x-device-id` header) - enables anonymous/trial users to use cloud storage

Backend APIs accept either identifier. When no activation code is provided, the system uses `device:${deviceId}` as the identifier in the database.

**Implications**:
- Anonymous users can create exams, rubrics, and grading records without activation
- Activated users can sync data across devices using their activation code
- Both types of users are stored in the same database tables, differentiated by identifier format

### Data Model Hierarchy

```
Exam (考试)
  └── DeviceRubric (评分细则) - linked via examId
      └── GradingRecord (批改记录) - linked via questionKey
```

**Key Design**:
- Exams are containers/folders for organizing rubrics by exam
- Users select exam first, then configure rubrics for that exam
- This is reflected in the UI navigation flow: exams → questions → detail → editor

### State Management (Frontend)

- **Zustand Store** (`stores/useAppStore.ts`): Centralized state with persistence
- **View Stack Pattern**: Used in `RubricDrawer.tsx` for navigation
  - Stack: `['exams', 'questions', 'detail', 'point_editor', 'question_settings']`
  - Push/pop views to navigate; render based on `currentView`

### Key Files Reference

| File | Purpose |
|------|---------|
| `aigradingfrontend/src/components/v2/views/RubricDrawer.tsx` | Main rubric management UI with exam-question hierarchy |
| `aigradingfrontend/services/proxyService.ts` | Backend API client (exams, rubrics, activation) |
| `aigradingfrontend/stores/useAppStore.ts` | Global state (Zustand) |
| `aigradingbackend/src/app/api/exams/route.ts` | Exam CRUD endpoints |
| `aigradingbackend/src/app/api/rubric/route.ts` | Rubric CRUD endpoints |
| `aigradingbackend/src/lib/rubric-types.ts` | RubricJSON v2 schema and validation |
| `aigradingbackend/prisma/schema.prisma` | Database schema |

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
