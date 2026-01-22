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

## 6. Current Development Phase
- **Status**: Backend v0.1.0, Frontend v0.0.0.
- **Active Tasks**:
    - **Phase 1**: Security hardening (JWT refresh, Rate limiting).
    - **Phase 2**: Grading records enhancement (Syncing via Activation Code).
    - **Integration**: "CherryIN" API platform integration for cost optimization.

## 7. Key Configuration Files
- `aigradingbackend/.env`: Backend environment variables.
- `aigradingbackend/prisma/schema.prisma`: Database schema definition.
- `aigradingfrontend/vite.config.ts`: Frontend build config.
- `backend_development_plan.md`: Detailed roadmap and architectural decisions.
