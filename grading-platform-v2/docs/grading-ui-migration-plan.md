# 前端评分 UI 迁移执行方案 (v1 → v2)

> **目标**：基于 `grading-platform-v2` 的 Monorepo 架构，将 v1 的评分 UI 逻辑迁移并升级，实现对 Rubric v4 的完整支持。
> **策略**：分三期执行，首期打通全流程功能，二期优化交互体验，三期升级视觉设计。

---

## 📅 第一期：打通"能用" (Functional Baseline)

**目标**：完成核心组件迁移，使 v2 的 `GradingPanel` 能够展示结构化的评分结果，替代目前的 JSON 调试视图。

### 1.1 数据层准备 (已完成 ✅)
- [x] **定义 GradingResult 类型** (`packages/domain-core/src/grading/grading-result.ts`)
    - 包含 `SegmentResult`、`PointItemResult` 等完整结构
    - 提供 `flattenGradingResult` 兼容 v1 扁平视图

### 1.2 UI 组件库迁移 (`packages/ui-kit`)
- [x] **创建基础组件目录**
    - `packages/ui-kit/src/components/grading/`
- [x] **迁移 `ModeSelector`**
    - 新建 `GradingModeSelector.tsx`
    - Props: `mode: 'assist' | 'auto'`, `onChange: (mode) => void`
    - 移除 v1 具体业务逻辑，改为纯 UI 组件
- [x] **迁移并重构 `ScoreCard`**
    - 新建 `GradingScoreCard.tsx`
    - Props: `result: GradingResult`, `onApply?: () => void`
    - **关键逻辑**：优先按 Segment 结构渲染，保留扁平回退视图。
    - 样式：基于 `@ai-grading/ui-kit` 现有 token 样式体系（未引入 Tailwind 构建链）。

### 1.3 业务层集成 (`apps/extension-app`)
- [x] **改造 `GradingPanel.tsx`**
    - **State 改造**：引入 `gradingMode` 状态（默认 'assist'）。
    - **结果展示**：新增 `<GradingScoreCard />` 结构化视图，同时保留原始响应 JSON 调试区。
    - **操作栏**：在顶部添加 `<GradingModeSelector />`。
    - **数据转换**：新增 `adaptEvaluateResponseToGradingResult`，优先消费后端 `gradingResult`，缺失时回退 `fromFlatBreakdown`。
- [ ] **联调测试**
    - 手动触发批改，验证 `ScoreCard` 能正确展示总分、Breakdown 列表。
    - 验证模式切换 UI 响应正常。

---

## 🚀 第二期：补全"好用" (Interactive Enhancements)

**目标**：移植自动循环批改逻辑，实现辅助模式下的逐项审阅，提升交互效率。

### 2.1 状态机 Hook 化 (`packages/ui-kit` 或 `apps/extension-app`)
- [x] **封装 `useGradingController`**
    - 将 v1 `GradingView` 中的状态机逻辑（idle -> scanning -> grading -> review）抽取为独立 Hook。
    - **输入**：`gradingMode`, `onEvaluate`, `onApplyScore`, `onScanPage`
    - **输出**：`status`, `step`, `error`, `actions: { start, stop, pause, resume }`
    - **核心逻辑**：
        - 实现 Auto 模式下的自动循环：`Success -> Apply -> Wait -> Scan -> Grade`。
        - 处理异常重试和暂停逻辑。

### 2.2 辅助模式审阅交互
- [ ] **增强 `GradingScoreCard`**
    - 支持 `onItemChange(itemId, newScore)` 回调。
    - 支持 `onCommentChange(newComment)` 回调。
    - 实现"一键采纳" vs "逐项确认" 的 UI 区分。
    - 在组件内部维护 `draftResult` 状态，直到用户点击"确认回填"。

### 2.3 集成状态机到 `GradingPanel`
- [x] **对接 Hook**
    - 使用 `useGradingController` 接管 `GradingPanel` 的现有散乱状态（busy, domBusy 等）。
    - 绑定 UI 按钮（开始、停止）到 Hook 的 action。
    - 增加根据 `status` 显示不同 UI（如 Loading 进度条、扫描动画等）。

---

## 🎨 第三期：做到"好看" (Visual Polish)

**目标**：基于 Rubric v4 结构升级视觉表现，实现高级交互。

### 3.1 视觉升级 (`ScoreCard` v2)
- [ ] **实现 Glassmorphism 风格**
    - 参考 `design/grading-detail-premium.html`。
    - 使用半透明背景、模糊效果、细腻阴影。
- [ ] **OCR 原文对照**
    - 在 BreakdownItem 中展示 `matchedText`。
    - 支持点击高亮原文（需要 extension host 支持）。

### 3.2 结构化渲染
- [ ] **Segment 分组展示**
    - 移除 `flattenGradingResult` 依赖。
    - 根据 `SegmentResult` 渲染分组标题。
    - 为 `rubric_matrix` 策略实现表格化渲染。
    - 为 `sequential_logic` 策略实现步骤条渲染。

---

## 📝 实施细则与注意事项

1. **类型安全**：所有组件 Props 必须严格定义，避免使用 `any`。
2. **样式隔离**：`ui-kit` 组件应通过 `className` prop 支持外部样式覆盖，但内部保持合理的默认样式。
3. **API 适配**：后端 `evaluate` 已进入兼容增强阶段，迁移窗口内同时返回 `breakdown`（legacy）与 `gradingResult`（v4）。前端通过 `adaptEvaluateResponseToGradingResult` 统一消费。
