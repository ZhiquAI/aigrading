# UI 迁移方案：aigradingfrontend → grading-platform-v2

## 背景

- **源项目**: aigradingfrontend（当前生产环境）
- **目标项目**: grading-platform-v2（重构版本）
- **用户已还原**: 细则(RubricPanel)、阅卷(GradingPanel)、记录(RecordsPanel)、设置(SettingsPanel) 模块

## 调整后的迁移范围

> **注意**: 以下模块已由用户在 v2 项目中手动还原，无需迁移：
> - RubricPanel.tsx ✅
> - GradingPanel.tsx ✅
> - RecordsPanel.tsx ✅
> - SettingsPanel.tsx / SettingsSheetPanel.tsx ✅

### 1. 设计系统迁移

| 源文件 | 目标文件 | 说明 |
|-------|---------|------|
| `aigradingfrontend/design-tokens.css` | `grading-platform-v2/apps/extension-app/src/styles.css` | 提取核心 CSS 变量 |

**需要保留的设计 tokens**:
- 颜色系统（primary, secondary, accent, 功能色）
- 阴影系统（shadow-xs ~ shadow-xl）
- 圆角系统（sm ~ full）
- 字体系统

### 2. UI 组件迁移（聚焦于替换 legacy-* 类名）

| 组件 | 源路径 | 目标路径 | 优先级 |
|-----|-------|---------|--------|
| Button | `components/ui/Button.tsx` | `packages/ui-kit/components/ui/button.tsx` | P0 |
| Card | `components/ui/Card.tsx` | `packages/ui-kit/components/ui/card.tsx` | P0 |
| Badge | `components/ui/Badge.tsx` | `packages/ui-kit/components/ui/badge.tsx` | P1 |
| StatusIndicator | `components/ui/StatusIndicator.tsx` | `packages/ui-kit/components/ui/status-indicator.tsx` | P1 |
| Progress | `components/ui/Progress.tsx` | `packages/ui-kit/components/ui/progress.tsx` | P2 |
| EmptyState | `components/ui/EmptyState.tsx` | `packages/ui-kit/components/ui/empty-state.tsx` | P2 |

**目的**: 这些组件用于后续渐进式替换模块中的 `legacy-*` CSS 类名

## 实施步骤

### Step 1: 安装 shadcn/ui 依赖

```bash
cd grading-platform-v2/apps/extension-app
npm install class-variance-authority clsx tailwind-merge lucide-react
npm install @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-dropdown-menu
npm install -D tailwindcss @tailwindcss/vite
```

### Step 2: 配置 Tailwind CSS（如需要）

创建 `tailwind.config.js`（可选，当前 styles.css 已足够）

### Step 3: 创建 UI Kit 包结构

```
packages/ui-kit/
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── status-indicator.tsx
│   │   ├── progress.tsx
│   │   └── empty-state.tsx
│   └── index.ts
├── lib/
│   └── utils.ts          # cn() 工具函数
├── package.json
└── index.ts
```

### Step 4: 迁移设计系统

将 `design-tokens.css` 中的核心变量整合到 `styles.css`

### Step 5: 迁移 UI 组件

按优先级迁移：
1. Button, Card（P0）
2. Badge, StatusIndicator（P1）
3. Progress, EmptyState（P2）

### Step 6: 渐进式替换（可选）

在模块中逐步用新组件替换 `legacy-*` 类名

## 关键文件

### 需要修改的文件

| 文件 | 操作 |
|-----|------|
| `grading-platform-v2/apps/extension-app/package.json` | 添加依赖 |
| `grading-platform-v2/apps/extension-app/src/styles.css` | 整合设计系统 |
| `grading-platform-v2/packages/ui-kit/package.json` | 更新包配置 |
| `grading-platform-v2/apps/extension-app/src/features/*/*Panel.tsx` | 使用新组件（可选） |

### 需要创建的文件

| 文件 | 说明 |
|-----|------|
| `packages/ui-kit/components/ui/button.tsx` | Button 组件 |
| `packages/ui-kit/components/ui/card.tsx` | Card 组件 |
| `packages/ui-kit/components/ui/badge.tsx` | Badge 组件 |
| `packages/ui-kit/components/ui/status-indicator.tsx` | StatusIndicator 组件 |
| `packages/ui-kit/components/ui/progress.tsx` | Progress 组件 |
| `packages/ui-kit/components/ui/empty-state.tsx` | EmptyState 组件 |
| `packages/ui-kit/lib/utils.ts` | cn() 工具 |
| `packages/ui-kit/index.ts` | 统一导出 |

## 验证方法

1. **构建验证**: `pnpm build` 成功无错误
2. **开发验证**: `pnpm dev` 启动正常
3. **功能验证**: 打开扩展，UI 正常显示
4. **样式验证**: 颜色、圆角、阴影与设计系统一致

## 注意事项

1. **保持向后兼容**: 新组件保持与 `legacy-*` 类名相似的命名
2. **渐进式迁移**: 不要求一次性全部替换，可分批进行
3. **类型保持**: 保留原有的 TypeScript 类型定义
4. **模块完整**: 已还原的模块（RubricPanel, GradingPanel 等）保持不变，仅在新组件开发后逐步集成
