# shadcn/ui UI 设计规范

## 项目概述

本文档定义了基于 shadcn/ui 组件库的 Chrome 扩展侧边栏 UI 设计系统，与现有的 Educacy Soft Light 设计风格保持一致。

**项目位置**: `/Users/hero/Desktop/ai-grading/grading-platform-v2`
**目标平台**: Chrome 扩展侧边栏 (宽约 375px)
**语言**: 简体中文

---

## 1. 设计原则

### 1.1 shadcn/ui 核心原则

- **可定制性**: 组件源码 Copy/Paste 到项目中，而非 npm 包引入
- **简洁性**: 最小化默认样式，易于主题定制
- **可访问性**: 内置 WCAG 2.1 AA 级支持
- **现代化**: 遵循最新 React/TypeScript 最佳实践

### 1.2 设计风格定位

- **Educacy Soft Light**: 柔和的编辑风格，适合教育场景
- **色彩**: 清新淡雅，强调功能而非装饰
- **排版**: 清晰可读，层次分明

---

## 2. 设计令牌 (Design Tokens)

### 2.1 颜色系统

```css
/* Primary - 科技蓝 */
--primary: #006FEE;
--primary-foreground: #ffffff;
--primary-hover: #005BC4;
--primary-active: #004799;
--primary-subtle: rgba(0, 111, 238, 0.08);
--primary-muted: rgba(0, 111, 238, 0.12);

/* Secondary - 优雅紫 */
--secondary: #7828C8;
--secondary-foreground: #ffffff;
--secondary-subtle: rgba(120, 40, 200, 0.08);

/* Accent - 柔和杏 */
--accent: #DCA476;
--accent-foreground: #09090b;

/* 功能色 */
--destructive: #EF4444;
--success: #10B981;
--warning: #F59E0B;

/* 中性色 */
--background: #ffffff;
--foreground: #09090b;
--muted: #f4f4f5;
--muted-foreground: #71717a;
--card: #ffffff;
--card-border: #e4e4e7;
--input: #e4e4e7;
```

### 2.2 间距系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-1` | 4px | 紧凑间距 |
| `--space-2` | 8px | 组件内间距 |
| `--space-3` | 12px | 卡片内间距 |
| `--space-4` | 16px | 区块间距 |
| `--space-5` | 20px | 区块间距 |
| `--space-6` | 24px | 大区块间距 |

### 2.3 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 4px | 小元素 |
| `--radius` | 8px | 默认 |
| `--radius-lg` | 12px | 卡片 |
| `--radius-xl` | 16px | 大卡片 |
| `--radius-2xl` | 24px | Hero 区域 |

### 2.4 阴影系统

```css
--shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
```

---

## 3. 组件规范

### 3.1 Button (按钮)

**Primary Button**
```tsx
<Button className="bg-primary text-primary-foreground hover:bg-primary/90">
  按钮文字
</Button>
```

| 属性 | 值 |
|------|-----|
| Height | 40px (md), 32px (sm), 48px (lg) |
| Padding | 16px 水平 |
| Border Radius | 8px |
| Font Size | 14px |
| Font Weight | 500 |

**Variants**
- `default` / `primary`: 主题色填充
- `secondary`: 次要填充
- `outline`: 边框样式
- `ghost`: 透明背景
- `destructive`: 危险操作红色

### 3.2 Card (卡片)

```tsx
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述文字</CardDescription>
  </CardHeader>
  <CardContent>
    内容区域
  </CardContent>
  <CardFooter>
    底部操作
  </CardFooter>
</Card>
```

**样式规范**
- Border: 1px solid var(--card-border)
- Border Radius: 12px (--radius-lg)
- Background: var(--card)
- Shadow: var(--shadow-xs)
- Padding: 24px (header/content), 0 24px 24px (footer)

### 3.3 Input / Textarea

```tsx
<Input
  placeholder="占位符"
  className="focus-visible:ring-2 focus-visible:ring-primary"
/>
```

**样式规范**
- Height: 40px (Input), min-height 100px (Textarea)
- Border: 1px solid var(--input-border)
- Border Radius: 8px
- Focus: 2px ring in primary color

### 3.4 Badge (标签)

```tsx
<Badge variant="default">标签</Badge>
<Badge variant="secondary">次要</Badge>
<Badge variant="success">成功</Badge>
<Badge variant="warning">警告</Badge>
<Badge variant="destructive">危险</Badge>
```

**样式规范**
- Height: 24px
- Padding: 0 8px
- Border Radius: 9999px (胶囊形)
- Font Size: 12px
- Font Weight: 500

### 3.5 Bottom Navigation (底部导航)

```tsx
<BottomNav>
  <BottomNavItem active icon={...} label="评分细则" />
  <BottomNavItem icon={...} label="智能批改" />
  <BottomNavItem icon={...} label="阅卷记录" />
</BottomNav>
```

**样式规范**
- Height: 64px
- Background: var(--card)
- Border Top: 1px solid var(--card-border)
- Item Padding: 8px 16px
- Active 状态: Primary 颜色背景 + Primary 颜色文字

### 3.6 Sheet (滑动面板)

```tsx
<Sheet>
  <SheetTrigger>打开</SheetTrigger>
  <SheetContent side="bottom">
    <SheetHeader>
      <SheetTitle>标题</SheetTitle>
      <SheetDescription>描述</SheetDescription>
    </SheetHeader>
    <SheetBody>内容</SheetBody>
    <SheetFooter>
      <Button>操作</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

**样式规范**
- Max Height: 85vh
- Border Radius: 16px (顶部圆角)
- Overlay: rgba(0, 0, 0, 0.5)
- Shadow: var(--shadow-xl)

---

## 4. 页面布局

### 4.1 App Shell (应用外壳)

```
┌────────────────────────┐
│      App Header       │  44px
│  (顶部标题栏/品牌)     │
├────────────────────────┤
│                        │
│    Page Content        │  可变
│    (页面主要内容)      │
│                        │
├────────────────────────┤
│    Bottom Navigation   │  64px
│   (底部导航栏)         │
└────────────────────────┘
```

### 4.2 Page Header (页面头部)

```
┌──────────────────────────────────┐
│  [Icon]  页面标题               │
│          副标题/统计            │
│                   [Action Btn] │
└──────────────────────────────────┘
```

- Height: 56px (包含 padding)
- Position: Sticky
- Background: 毛玻璃效果 (backdrop-filter: blur(12px))
- Border Bottom: 1px solid var(--card-border)

### 4.3 响应式断点

由于是 Chrome 扩展侧边栏，主要适配固定宽度:

- **窄模式**: 320px (最小)
- **标准模式**: 375px (推荐)
- **宽模式**: 420px (最大)

---

## 5. 模块设计

### 5.1 评分细则模块 (Rubric)

**Home View**
- Hero Card: AI 生成入口 (主色调渐变)
- Action Grid: 快捷操作 (2列)
- Recent Panel: 最近使用列表

**编辑 View**
- Form Fields: 题目内容、总分、策略
- Points Editor: 打分点编辑器
- Preview: 实时预览

### 5.2 智能批改模块 (Grading)

**Home View**
- Stats Card: 今日批改统计
- Student Queue: 学生队列
- Alert: 状态提示

**Grading View**
- Answer Display: 答卷展示
- Rubric Panel: 评分细则侧边
- Score Input: 分数输入

### 5.3 阅卷记录模块 (Records)

**List View**
- Filter Bar: 筛选标签
- Records List: 记录卡片列表
- Empty State: 空状态

### 5.4 设置模块 (Settings)

**Sheet Panel**
- Account: 账户信息
- AI Settings: AI 提供商/模型
- Platform: 平台 Cookie
- Appearance: 外观设置

---

## 6. 交互设计

### 6.1 过渡动画

```css
/* 默认过渡 */
transition: all 0.2s ease;

/* 快速交互 */
transition: all 0.15s ease;
```

### 6.2 按下效果

```css
/* Button pressed */
transform: scale(0.98);

/* Card hover */
border-color: var(--primary-muted);
box-shadow: var(--shadow-md);
```

### 6.3 加载状态

- Skeleton: 骨架屏占位
- Spinner: 旋转指示器
- Progress: 进度条

---

## 7. 可访问性

### 7.1 键盘导航

- Tab 键在可交互元素间切换
- Enter/Space 激活按钮
- Escape 关闭弹层

### 7.2 焦点管理

- Focus Ring: 2px solid var(--ring)
- Focus Offset: 2px
- Focus Visible: 仅键盘触发时显示

### 7.3 屏幕阅读器

- aria-label 属性
- aria-describedby 描述
- role 属性正确设置

---

## 8. 实现建议

### 8.1 组件安装

```bash
# 安装 shadcn/ui CLI
npx shadcn-ui@latest init

# 安装核心组件
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add sheet
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add select
npx shadcn-ui@latest add slider
npx shadcn-ui@latest add toggle
npx shadcn-ui@latest add radio-group
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add label
npx shadcn-ui@latest add scroll-area
```

### 8.2 Tailwind 配置

```javascript
// tailwind.config.js
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          hover: "var(--primary-hover)",
          active: "var(--primary-active)",
          subtle: "var(--primary-subtle)",
          muted: "var(--primary-muted)",
        },
        // ... 其他颜色
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
    },
  },
};
```

### 8.3 自定义组件

**BottomNav**
```tsx
// components/bottom-nav.tsx
export function BottomNav({ children }: { children: React.ReactNode }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2">
      {children}
    </nav>
  );
}
```

---

## 9. 设计稿资源

- **HTML 预览**: `docs/design/shadcn-ui-design-v1.html`
- **设计令牌**: `aigradingfrontend/design-tokens.css`
- **现有样式**: `apps/extension-app/src/styles.css`

---

## 10. 后续计划

1. 实现基础 shadcn/ui 组件
2. 创建 BottomNav 组件
3. 重构现有页面使用新组件
4. 添加深色模式支持
5. 完善动画和过渡效果
