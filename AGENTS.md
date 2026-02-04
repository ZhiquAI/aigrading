# AI 智能批改助手 - 项目规则

> 本文档为项目专有规则，通用规则请参阅全局配置 `~/.codex/AGENTS.md`。

---

## 🏗️ 项目架构

本项目核心是为历史老师提供的一套 AI 辅助评卷系统。

> [!IMPORTANT]
> **开发焦点**：核心开发力量已完全转向**全栈版**。非必要不改动 `personal` 目录下的代码。

### 目录结构
-   **`aigradingfrontend`**：全栈版前端（Chrome 插件）。React 18 + Vite 5 + **Tailwind CSS 4**。
-   **`aigradingbackend`**：全栈版后端（Next.js 14）。Prisma 5 + PostgreSQL/SQLite。
-   **`personal`**：**遗留版本 (Legacy)**。仅作历史参考。

### 核心逻辑：用户识别机制
-   **已激活用户**：`x-activation-code` 请求头 → 跨设备同步。
-   **匿名用户**：`x-device-id` 请求头 → 构造 `device:${deviceId}` 标识符。
-   **临时访客**：生成 `anonymous:${timestamp}_${random}` 标识。

> [!NOTE]
> 编写数据查询时，务必调用 `getUserIdentifier()` 函数确保数据隔离。

---

## 📚 数据模型

### 数据层次
`考试 (Exam) -> 评分细则 (DeviceRubric) -> 批改记录 (GradingRecord)`

### RubricJSON v2 协议
-   `version`: `'2.0'`
-   `scoringStrategy`: `pick_n` / `all` / `weighted`
-   `answerPoints`: 含 `id`, `content`, `keywords`, `score`
-   `gradingNotes`: AI 阅卷指令

---

## ⚙️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18, Vite 5, Zustand 5, Tailwind CSS 4 |
| 后端 | Next.js 14, Prisma 5, JWT, Bcryptjs |
| AI | Gemini 2.5 Flash (OpenRouter), GPT-4o (OpenRouter), 智谱 GLM-4.7 |

---

## 🚀 快速启动

```bash
# 后端
cd aigradingbackend && npm install
cp .env.example .env && npx prisma db push && npm run dev

# 前端
cd aigradingfrontend && npm install && npm run dev
```

---

## 🧩 开发约定

- 每次修改完成后，请主动执行前端构建：`cd aigradingfrontend && npm run build`。

---

## 🔌 核心 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/exams` | GET/POST | 考试列表 |
| `/api/rubric` | GET/POST/DELETE | 评分细则 (409 冲突检测) |
| `/api/ai/grade` | POST | AI 批改 |
| `/api/activation/verify` | POST | 验证激活码 |

> Headers 需携带 `x-activation-code` 或 `x-device-id`。

---

## 🧠 前端状态管理

### Zustand Store (`useAppStore.ts`)
- `exams`, `rubrics`, `activationCode`, `quota`, `currentQuestionKey`

### View Stack 导航
```typescript
pushView('questions');  // 进入
popView();              // 返回
```

---

## 🔑 测试激活码

| 激活码 | 类型 | 额度 |
|--------|------|------|
| `TEST-1111-2222-3333` | 试用 | 300 |
| `BASIC-AAAA-BBBB-CCCC` | 基础 | 1000 |
| `PRO-XXXX-YYYY-ZZZZ` | 专业 | 3000 |
| `PERM-AAAA-BBBB-CCCC` | 永久 | 999999 |

---

## 🐛 常见错误

| 错误 | 解决方案 |
|------|----------|
| `API Key 未配置` | 检查 `.env` |
| `Prisma: P2025` | 检查 `questionKey`/`examId` |
| `CORS 错误` | 检查 `middleware.ts` |

---

## 🔗 参考文档

- [GEMINI.md](./GEMINI.md) - 技术背景
- [CLAUDE.md](./CLAUDE.md) - 代码模式
- [backend_development_plan.md](./backend_development_plan.md) - 后端路线图

---

> **最后更新**: 2026-02-04
