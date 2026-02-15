# UI Kit 迁移适配规范（Migration Contract）

## 目标

统一 `apps/extension-app` 在迁移期的组件接入方式，避免同一页面混用多套规则导致回归风险。

## 适用范围

- 路径：`apps/extension-app/src/**`
- 组件来源：`@ai-grading/ui-kit`
- 样式来源：`apps/extension-app/src/styles/**`

## 强制规则

1. 新增交互组件优先使用 `@ai-grading/ui-kit`，不新增裸 `button`/`badge` 方案。
2. 迁移期保留现有 `classic-*` 类名，组件层使用 `variant="unstyled"` 对接旧样式。
3. 只有当页面完全脱离 `classic-*` 后，才允许改用标准 `variant`（如 `primary`/`outline`）。
4. 不在业务组件中直接写大段内联样式，视觉统一落到 `src/styles`。
5. 新增状态展示优先使用 `StatusIndicator`；空态优先使用 `EmptyState`；进度条优先使用 `Progress`。
6. 每次 UI 迁移必须通过：`pnpm lint && pnpm typecheck && pnpm test && pnpm build`。

## 推荐用法

### Button/Card 渐进替换（迁移期）

```tsx
import { Button, Card } from "@ai-grading/ui-kit";

<Card variant="unstyled" className="classic-module-card">
  <Button variant="unstyled" className="classic-btn-primary">开始</Button>
</Card>
```

### 状态与空态

```tsx
import { StatusIndicator, EmptyState } from "@ai-grading/ui-kit";

<StatusIndicator status="success" label="检测状态：已检测到" className="classic-status-item" />
<EmptyState title="暂无记录" description="完成一次批改后会自动沉淀历史。" className="classic-history-empty" />
```

## 禁止项

- 在迁移页面新增未抽象的 `legacy-*` / 非规范前缀类名。
- 直接改动 `ui-kit` 标准组件默认样式去适配单页面。
- 在未加视觉回归基线前进行大面积样式重写。

## 验收清单

1. 组件替换后功能行为不变。
2. 页面视觉与迁移前一致（或有明确设计说明）。
3. 类型检查与构建通过。
4. 涉及关键页面时补充或更新视觉基线截图。
