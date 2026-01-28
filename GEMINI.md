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
