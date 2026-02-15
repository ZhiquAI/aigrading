# AI Grading Platform V2 重启架构方案（同仓新目录 + 统一命名）

## 一、方案摘要
基于已确认的决策，项目按“同仓新目录重启”方式落地，采用 `pnpm + Turbo` 的 Monorepo，统一英文领域命名，业务身份以“激活码优先、设备回退”为核心，AI 全量走后端网关；旧系统保留在独立目录作为回滚备份，不在 v2 内维护兼容路由。

新根目录固定为：`/Users/hero/Desktop/ai-grading/grading-platform-v2`

---

## 二、目标与边界
### 目标
1. 重建前后端统一工程结构，消除当前双链路与命名分裂。
2. 建立可扩展的领域边界：激活、细则、批改、记录、设置、DOM 适配。
3. 所有核心接口仅保留 `api/v2`，旧接口不在 v2 工程内继续维护。
4. 支撑多学科、多题型、混合题与后续云端扩展。

### 非目标
1. 本阶段不做 AI 模型策略大幅实验改造。
2. 本阶段不做 K8s 与多区域部署。
3. 本阶段不彻底重写旧 `personal` 目录，仅做参考与迁移数据源。

---

## 三、Monorepo 目录设计（决策完成）
```text
grading-platform-v2/
  apps/
    extension-app/              # Chrome 插件（UI + content/background）
    api-server/                 # Next.js 14 API
    admin-console/              # 管理后台（可选，同期建议纳入）
  packages/
    domain-core/                # 纯业务领域模型与规则
    api-contracts/              # Zod 契约、DTO、错误码
    ui-kit/                     # 通用 UI 组件（HeroUI 二次封装）
    extension-bridge/           # 插件消息协议与 DOM 适配接口
    ai-gateway/                 # 模型路由、fallback、结果归一化
    config-kernel/              # 配置项定义、默认值、合并策略
    logger-observability/       # 日志、trace-id、告警事件
  infra/
    docker/
    nginx/
    scripts/
  docs/
    architecture/
    api/
    migration/
  turbo.json
  pnpm-workspace.yaml
  package.json
```

---

## 四、统一命名规范（前后端/数据层）
## 1) 通用规范
| 类别 | 规则 | 示例 |
|---|---|---|
| 目录 | `kebab-case` | `grading-records` |
| React 组件 | `PascalCase` + 语义后缀 | `RubricCreatePage` |
| Hook | `use` 前缀 | `useRubricDraft` |
| Store Slice | `<domain>Slice` | `settingsSlice` |
| API 路由 | 资源名复数 + REST | `/api/v2/rubrics` |
| Prisma Model | `PascalCase` 单数 | `GradingRecord` |
| DB 字段 | `camelCase` | `scopeKey`, `questionKey` |
| 事件名 | `<domain>.<action>` | `record.created` |

## 2) UI 组件命名模板
1. 页面容器：`<Domain><Action>Page`
2. 业务模块：`<Domain><Section>Panel`
3. 表单：`<Domain><Action>Form`
4. 表格：`<Domain>Table`
5. 弹窗：`<Domain><Action>Dialog`
6. 顶部导航：`AppTopHeader`
7. 底部导航：`AppBottomNav`

## 3) 关键旧名到新名映射（首批）
| 旧模块 | 新模块 |
|---|---|
| `RubricPanelHeroSimple` | `RubricCreatePage` |
| `RubricPanelHero` | `RubricWorkspacePage` |
| `GradingViewHero` | `GradingRunnerPage` |
| `HistoryViewHero` | `RecordListPage` |
| `SettingsViewHero` | `SettingsCenterPage` |
| `useAppStore` | `useRootStore`（拆分 slices） |
| `record-sync.ts` | `recordSyncService`（放 `domain-core` 接口层） |
| `proxyService.ts` | `gatewayClient`（按 domain 拆） |

---

## 五、领域架构与责任分层
## 1) 领域上下文
1. `identity-license`: 激活码、设备绑定、配额、身份解析。
2. `rubric`: 细则生成、标准化、模板、发布状态。
3. `grading`: 阅卷请求、评分引擎、结果解释。
4. `records`: 批改记录、筛选、导出、同步。
5. `settings`: 用户偏好、模型配置、策略参数。
6. `platform-bridge`: content/background 与 DOM 交互协议。

## 2) 分层约束
1. `apps/*` 不直接访问数据库。
2. API 只通过 `domain-core` 执行业务。
3. Zod 契约只定义在 `api-contracts`，前后端共享。
4. DOM 逻辑只在 `extension-app` + `extension-bridge`。
5. AI SDK 只在 `ai-gateway`，前端不直连模型。

---

## 六、核心接口与类型重定义（公开接口变更）
## 1) 身份解析标准（全域）
请求头标准：
1. `x-activation-code`（可选）
2. `x-device-id`（建议必传）
3. `x-request-id`（可选，链路追踪）

解析结果统一类型：
```ts
type ScopeIdentity = {
  scopeKey: string;       // "ac:XXXX" | "device:YYYY" | "anon:ZZZZ"
  scopeType: "activation" | "device" | "anonymous";
  activationCode?: string;
  deviceId?: string;
};
```

## 2) API v2 资源清单
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

## 3) 旧系统隔离策略
1. 旧接口仅保留在旧项目目录中运行，不进入 `grading-platform-v2`。
2. `grading-platform-v2` 只提供 `/api/v2/*` 与基础健康检查接口。
3. 如需回滚，切回旧项目服务实例，不在 v2 内做双路由转发。

---

## 七、数据模型重构（Prisma）
## 1) 新增与重命名原则
1. 所有业务表引入 `scopeKey`，统一数据隔离。
2. 激活绑定增加唯一约束，防并发重复绑定。
3. 记录表支持幂等键 `idempotencyKey`，避免重复写入。
4. 配置表从 JWT user-only 扩展到 scope-based。

## 2) 建议模型（首版）
1. `LicenseCode`
2. `LicenseBinding`（`@@unique([code, deviceId])`）
3. `ScopeQuota`
4. `RubricDocument`
5. `RubricTemplate`
6. `GradingRecord`
7. `GradingRecordItem`
8. `SettingEntry`
9. `ExamSession`

---

## 八、前端架构重组（插件端）
## 1) 应用层
1. `app-shell`: Header/Nav/Layout
2. `features/rubric`
3. `features/grading`
4. `features/records`
5. `features/settings`
6. `features/license`

## 2) 状态管理拆分
`useRootStore` 由以下 slices 组成：
1. `sessionSlice`
2. `licenseSlice`
3. `rubricSlice`
4. `gradingSlice`
5. `recordSlice`
6. `settingsSlice`
7. `uiSlice`

## 3) DOM 适配层
1. `platform-zhixue-adapter`
2. `platform-haofenshu-adapter`
3. `adapter-registry`

消息协议统一：
1. `PAGE_CONTEXT_REQUEST`
2. `PAGE_CONTEXT_RESPONSE`
3. `GRADE_APPLY_REQUEST`
4. `GRADE_APPLY_RESPONSE`
5. `RUBRIC_DETECT_REQUEST`
6. `RUBRIC_DETECT_RESPONSE`

---

## 九、后端架构重组（api-server）
## 1) 模块目录
```text
src/modules/
  identity-license/
  rubric/
  grading/
  records/
  settings/
  exams/
src/shared/
  middleware/
  scope-resolver/
  errors/
  validators/
  telemetry/
```

## 2) 关键后端约束
1. 所有写接口支持 `idempotency-key`。
2. 激活流程使用事务 + 唯一约束校验。
3. AI 返回统一走 normalize + validate 双阶段。
4. 评分记录落库策略统一，不再“有激活码才写库”。

---

## 十、迁移与灰度计划（旧系统隔离 + 可回滚）
## Phase 0：骨架初始化（1 周）
1. 建 `grading-platform-v2` Monorepo 与基础包。
2. 建立 `api-contracts` 与统一错误码。
3. 接入 Turbo pipeline 与 CI skeleton。

## Phase 1：身份与激活重构（1 周）
1. 实现 `scope-resolver`。
2. 上线 `licenses v2`。
3. 完成激活并发安全改造。
4. 确认 v2-only API 边界，旧系统作为独立回滚路径。

## Phase 2：细则与批改核心（2 周）
1. 迁移 rubric v3 生成与标准化。
2. 迁移 grading evaluate + AI 网关。
3. 保留旧页面，新增 v2 feature flag。

## Phase 3：记录与设置（1.5 周）
1. records 全量迁移到 v2 API。
2. settings 改为 scope-based 配置。
3. 清理双存储 key 与双接口分叉。

## Phase 4：插件 DOM 适配与联调（1 周）
1. content/background 新协议接入。
2. 智学网/好分数回归。
3. 关闭旧链路开关，保留回滚 1 个版本窗口。

---

## 十一、测试方案与验收标准（核心链路强测）
## 1) 必测场景
1. 激活码首次激活、重复激活、超设备数、过期码、禁用码。
2. 混合题细则生成（多小问 segments）与评分策略可见性。
3. 阅卷成功后记录落库、列表可见、删除与导出正确。
4. 设置保存后 background/content 可读取一致配置。
5. 匿名设备 -> 激活后数据连续性（scope 迁移）正确。
6. DOM 两平台页面识别、定位答题卡、写分动作正确。

## 2) 测试层次
1. `api-contract` 契约测试（前后端共享 schema）。
2. 核心模块集成测试（identity/rubric/grading/records/settings）。
3. 插件端 E2E（消息协议 + DOM 适配）。

## 3) 发布门禁
1. 所有契约测试通过。
2. 核心链路集成测试通过。
3. 手工验收清单通过后才切主流量。

---

## 十二、云部署与运维基线（Docker + VM）
1. `api-server` 容器化，Nginx 反代。
2. `PostgreSQL` 独立实例，生产禁用 SQLite。
3. 日志统一 JSON，按 `scopeKey + requestId` 可检索。
4. 健康检查：`/api/health`。
5. 备份策略：每日全量 + 每小时增量（数据库）。
6. 回滚策略：保留上一版镜像与迁移回退脚本。

---

## 十三、实施里程碑与交付物
1. 里程碑 M1：Monorepo 可运行，v2 API 基础通。
2. 里程碑 M2：激活 + 细则 + 批改核心链路打通。
3. 里程碑 M3：记录 + 设置 + DOM 双平台回归通过。
4. 里程碑 M4：灰度完成并切主，旧链路进入冻结维护。

交付物：
1. 新目录骨架与工程脚手架。
2. API 契约文档（OpenAPI + Zod）。
3. 迁移脚本与回滚手册。
4. 测试报告与验收清单。

---

## 十四、已锁定假设与默认决策
1. 重启方式：同仓新目录。
2. 工程组织：`pnpm + Turbo` Monorepo。
3. 命名规范：全英文领域命名。
4. 身份模型：激活码优先，设备回退。
5. AI 策略：后端统一网关。
6. 迁移策略：旧系统隔离 + 灰度。
7. 部署：Docker + 云主机。
8. 质量门禁：核心链路强测。
