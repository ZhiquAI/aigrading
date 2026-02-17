# AI 智能批改助手 - 重构执行规则（当前生效）

> 本文档为项目专有规则，通用规则请参阅 `~/.codex/AGENTS.md`。

---

## 🎯 核心任务（最高优先级）

- 当前唯一核心任务：**按重启架构方案推进项目重构**
- 架构基线文档：`docs/architecture/ai-grading-platform-v2-restart-architecture.md`
- 主战场目录：`grading-platform-v2/`
- 未经明确指令，不回退到旧实现路线

---

## 🧭 工作边界与目录优先级

1. 默认只在 `grading-platform-v2/` 内开发与重构。
2. `aigradingfrontend/`、`aigradingbackend/` 仅用于：
   - 迁移参照
   - 旧系统联调与回滚验证
   - 紧急线上修复
3. `personal/` 为遗留参考目录，非必要不改。

---

## 🤝 沟通与决策规则

- 始终记住用户是编程小白，想用户所想，急用户所急，考虑周全。
- 在重构过程中，如果业务语义不清、需求边界不明确，**必须先向用户提问确认**，再实施代码修改。
- 如果项目发生重大变化，必须及时更新本文件（`AGENTS.md`）。
- 每开始一个任务，必须先列出可执行清单；每完成一个任务，必须给出阶段性小结。

---

## 🏗️ 重构硬约束（必须遵守）

- 工程形态：同仓新目录重启（Monorepo：`pnpm + turbo`）。
- 领域命名：统一英文领域命名，避免旧命名继续扩散。
- 身份体系：激活码优先，设备回退（Scope Identity 一致化）。
- API 方向：`grading-platform-v2` 仅维护 `api/v2`；旧接口继续留在旧项目独立运行，不在 v2 内维护兼容路由。
- AI 策略：核心链路统一走后端网关（`ai-gateway`），避免前端直连成为主链路。

---

## 📦 Monorepo 事实基线（当前代码）

- 根目录：`grading-platform-v2/`
- Workspace：`apps/*`、`packages/*`、`infra/scripts/*`
- 顶层脚本：
  - `pnpm dev`
  - `pnpm build`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`

核心应用：
- `apps/extension-app`
- `apps/api-server`
- `apps/admin-console`

核心包：
- `packages/domain-core`
- `packages/api-contracts`
- `packages/ai-gateway`
- `packages/config-kernel`
- `packages/extension-bridge`
- `packages/logger-observability`
- `packages/ui-kit`

---

## 🔌 API v2 目标清单（重构对齐）

按架构文档推进以下资源：

1. `POST /api/v2/licenses/activate`
2. `GET /api/v2/licenses/status`
3. `GET /api/v2/rubrics`
4. `POST /api/v2/rubrics`
5. `POST /api/v2/rubrics/generate`
6. `POST /api/v2/rubrics/standardize`
7. `GET /api/v2/exams`
8. `POST /api/v2/exams`
9. `POST /api/v2/gradings/evaluate`
10. `GET /api/v2/records`
11. `POST /api/v2/records/batch`
12. `DELETE /api/v2/records/:id`
13. `GET /api/v2/settings`
14. `PUT /api/v2/settings`
15. `POST /api/v2/settings/model/test`

旧系统隔离策略（迁移期）：
- 旧接口仅在旧项目服务实例中保留（`aigradingfrontend` / `aigradingbackend`）
- `grading-platform-v2` 只提供 `/api/v2/*` 与基础健康检查
- 如需回滚，切回旧项目服务，不在 v2 中做双路由转发

评分契约迁移约束（2026-02-17 起）：
- `POST /api/v2/gradings/evaluate` 在迁移窗口内同时返回：
  - `breakdown`（legacy 扁平结构，兼容旧记录链路）
  - `gradingResult`（v4 Segment 结构，供新 UI 主链路消费）

---

## ✅ 变更完成后的验证规则

### 1) 重构主线验证（默认）

在 `grading-platform-v2/` 下执行：

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

### 2) 旧系统联动触达时的附加验证

若本次改动影响旧前端（`aigradingfrontend/`），必须追加：

```bash
cd aigradingfrontend && npm run build
```

若本次改动影响旧后端关键契约，建议追加：

```bash
cd aigradingbackend && npm run build && npm run check:rubric-contract
```

---

## 📝 开发记录规则

- 每小时自动记录一次开发记录。
- 记录主文件：`DEVELOPMENT_LOG.md`
- 自动化脚本：
  - `scripts/hourly-dev-log.sh`
  - `scripts/install-hourly-dev-log.sh`
  - `scripts/uninstall-hourly-dev-log.sh`

---

## 🔄 Git 执行规则

- 在编写代码过程中，验证通过后自动提交并推送到 GitHub，无需人工确认。
- 推荐提交前缀：`feat:`、`fix:`、`refactor:`、`chore:`。
- 推送失败时，立即反馈具体阻塞原因（权限、冲突、分支保护等）。

---

## 📚 文档同步规则

出现以下变更时，必须同步更新文档：

1. API 契约或错误码调整
2. 数据模型或字段语义调整
3. 重构阶段目标、目录边界、迁移策略调整

至少同步：
- `docs/architecture/ai-grading-platform-v2-restart-architecture.md`
- 本文件 `AGENTS.md`

---

> **最后更新**: 2026-02-17
