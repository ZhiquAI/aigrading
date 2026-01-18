# 智能批改助手 UI 设计规范 v1.0

> 本规范用于统一项目中的 UI 元素设计，确保视觉一致性和开发效率。

---

## 1. 颜色系统

### 1.1 主题色

| 用途 | 变量 | 值 | Tailwind 等效 |
|-----|------|-----|--------------|
| **主色** | `--color-primary` | `#3B82F6` | `blue-500` |
| 主色悬停 | `--color-primary-hover` | `#2563EB` | `blue-600` |
| 主色激活 | `--color-primary-active` | `#1D4ED8` | `blue-700` |
| 主色背景 | `--color-primary-subtle` | `#EFF6FF` | `blue-50` |

### 1.2 语义色

| 语义 | 标准色 | Tailwind | 使用场景 |
|-----|--------|----------|---------|
| **成功** | `#059669` | `emerald-600` | 成功状态、满分标识 |
| **警告** | `#D97706` | `amber-600` | 警告提示、部分完成 |
| **危险** | `#DC2626` | `red-600` | 删除、错误、停止 |
| **信息** | `#3B82F6` | `blue-500` | 提示信息 |

### 1.3 中性色

| 用途 | Tailwind | 使用场景 |
|-----|----------|---------|
| 主文本 | `gray-800` | 标题、重要文字 |
| 正文 | `gray-600` | 正文内容 |
| 辅助文本 | `gray-400` | 次要说明 |
| 边框 | `gray-200` | 卡片、输入框边框 |
| 背景 | `gray-50` | 页面背景 |

---

## 2. 按钮规范

### 2.1 按钮变体

使用项目 `Button` 组件 (`components/ui/Button.tsx`)：

| 变体 | 用途 | 样式 |
|-----|------|------|
| `primary` | 主要操作（保存、确认、开始） | 蓝色填充 |
| `secondary` | 次要操作 | 灰色填充 |
| `success` | 成功操作（完成、已确认） | 绿色填充 |
| `danger` | 危险操作（删除、清除） | 红色填充 |
| `outline` | 普通操作 | 白底灰边框 |
| `ghost` | 轻量操作 | 透明背景 |
| `gradient` | 强调操作（激活、升级） | 蓝紫渐变 |

### 2.2 按钮尺寸

| 尺寸 | 用途 | 样式 |
|-----|------|------|
| `sm` | 紧凑空间、次要按钮 | `px-3 py-1.5 text-xs` |
| `md` | 标准按钮 | `px-4 py-2 text-sm` |
| `lg` | 强调按钮 | `px-6 py-3 text-base` |

### 2.3 使用示例

```tsx
// ✅ 正确：使用 Button 组件
import { Button } from './components/ui';

<Button variant="primary" size="sm" icon={<Save />}>
  保存配置
</Button>

<Button variant="danger" size="sm" icon={<Trash2 />}>
  删除记录
</Button>

// ❌ 错误：使用行内样式
<button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
  保存
</button>
```

---

## 3. 圆角规范

统一使用以下圆角值：

| 用途 | CSS 变量 | Tailwind | 值 |
|-----|----------|----------|-----|
| 小元素（标签、徽章） | `--radius-sm` | `rounded-md` | 6px |
| **标准元素（按钮、输入框）** | `--radius-md` | `rounded-lg` | 8px |
| 卡片 | `--radius-lg` | `rounded-xl` | 12px |
| 模态框 | `--radius-xl` | `rounded-2xl` | 16px |
| 圆形（头像、图标背景） | `--radius-full` | `rounded-full` | 9999px |

> **重要**：按钮和输入框统一使用 `rounded-lg`

---

## 4. 字体规范

### 4.1 字体大小

| 用途 | Tailwind | 场景 |
|-----|----------|------|
| 超小文本 | `text-[10px]` | 徽章、状态标签 |
| 小文本 | `text-xs` (12px) | 按钮(sm)、辅助说明 |
| 正文 | `text-sm` (14px) | 按钮(md)、正文内容 |
| 标题 | `text-base` (16px) | 卡片标题 |
| 大标题 | `text-lg` (18px) | 页面标题 |

### 4.2 字体粗细

| 用途 | Tailwind |
|-----|----------|
| 正文 | `font-normal` |
| 强调 | `font-medium` |
| 按钮/标题 | `font-bold` |

---

## 5. 间距规范

### 5.1 内边距 (Padding)

| 场景 | Tailwind |
|-----|----------|
| 紧凑按钮 | `px-3 py-1.5` |
| 标准按钮 | `px-4 py-2` |
| 卡片 | `p-4` |
| 模态框 | `p-5` 或 `p-6` |

### 5.2 外边距/间隙 (Gap)

| 场景 | Tailwind |
|-----|----------|
| 按钮组 | `gap-2` 或 `gap-3` |
| 卡片间 | `space-y-4` |
| 图标与文字 | `gap-1.5` 或 `mr-1.5` |

---

## 6. 阴影规范

| 用途 | Tailwind |
|-----|----------|
| 卡片 | `shadow-sm` |
| 悬浮卡片 | `shadow-md` |
| 弹窗/模态框 | `shadow-xl` |
| 强调按钮 | `shadow-lg shadow-{color}-500/30` |

---

## 7. 状态反馈色

### 7.1 状态背景

| 状态 | 背景色 | 边框色 | 文字色 |
|-----|--------|--------|--------|
| 成功 | `bg-green-50` | `border-green-200` | `text-green-700` |
| 警告 | `bg-amber-50` | `border-amber-200` | `text-amber-700` |
| 错误 | `bg-red-50` | `border-red-200` | `text-red-700` |
| 信息 | `bg-blue-50` | `border-blue-200` | `text-blue-700` |

### 7.2 深色模式

| 状态 | 背景色 |
|-----|--------|
| 成功 | `dark:bg-green-900/20` |
| 警告 | `dark:bg-amber-900/20` |
| 错误 | `dark:bg-red-900/20` |
| 信息 | `dark:bg-blue-900/20` |

---

## 快速参考

```
按钮：使用 Button 组件，不要写行内样式
圆角：按钮/输入框用 rounded-lg，卡片用 rounded-xl
字体：按钮用 text-xs(sm) 或 text-sm(md)，font-bold
主色：blue-500/600，危险色：red-600
```
