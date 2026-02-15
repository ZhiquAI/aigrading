# UI 设计分析文档

## 1. 项目 UI 概览

| 项目 | UI 框架 | 设计风格 | 状态 |
|------|---------|----------|------|
| **aigradingfrontend** | HeroUI + Tailwind CSS | 现代化彩色风格 | 成熟 |
| **grading-platform-v2** | 纯 CSS | 拟态玻璃效果 | 重构中 |

---

## 2. aigradingfrontend - 成熟设计系统

### 2.1 设计系统 (design-tokens.css)

```css
/* 核心色板 */
:root {
    /* Primary: Tech Product Blue */
    --color-primary: #006FEE;
    --color-primary-hover: #005BC4;
    --color-primary-active: #004799;
    --color-primary-subtle: rgba(0, 111, 238, 0.12);

    /* Secondary: Electric Mist Blue */
    --color-secondary: #7828C8;
    --color-secondary-hover: #6622AA;

    /* Accent / CTA: Soft Apricot */
    --color-accent: #DCA476;

    /* Functional Colors */
    --color-danger: #EF4444;
    --color-warning: #F59E0B;
    --color-success: #10B981;

    /* Neutral / Surface — Soft Light */
    --color-text-main: #111827;
    --color-text-body: #526179;
    --color-text-muted: #8A96AA;

    --color-bg-app: #EDF2F3;
    --color-bg-card: #FFFFFF;

    --color-border: #DFE5ED;

    /* Typography */
    --font-sans: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### 2.2 ModernLayout 架构

```
┌─────────────────────────────────────────────┐
│  [渐变顶部指示条 - 模块主题色]              │
├─────────────────────────────────────────────┤
│  [Task 进度条 - 可折叠]                    │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 页面内容区                            │   │
│  │ • RubricPanel (细则)                │   │
│  │ • GradingViewV2 (批改)              │   │
│  │ • RecordsViewV2 (记录)               │   │
│  │ • SettingsViewV2 (设置)              │   │
│  └─────────────────────────────────────┘   │
│                                             │
├─────────────────────────────────────────────┤
│  [底部导航栏 - 4 个 Tab]                   │
│  📋细则  ✓阅卷  📜记录  ⚙设置             │
└─────────────────────────────────────────────┘
```

### 2.3 视觉特性

#### 模块化主题色

| Tab | 渐变起始色 | 渐变结束色 | 强调色 |
|-----|-----------|-----------|--------|
| 细则 | `#2F6FFF` | `#5F92FF` | 蓝色 |
| 批改 | `#5F8AED` | `#7AA5F5` | 紫蓝 |
| 记录 | `#8F9FCC` | `#B49FCF` | 灰紫 |
| 设置 | `#95A8C2` | `#BBC7D8` | 灰色 |

#### 毛玻璃效果
```css
background: rgba(255, 255, 255, 0.85);
backdrop-filter: blur(12px);
```

#### 发光指示条
```css
background: linear-gradient(90deg, transparent, rgba(47, 111, 255, 0.7), transparent);
box-shadow: 0 0 8px rgba(47, 111, 255, 0.7);
```

---

## 3. grading-platform-v2 - 重构中的设计

### 3.1 设计系统 (styles.css)

```css
:root {
    /* 基础色板 */
    --legacy-primary: #2f6fe4;
    --legacy-primary-strong: #245ed6;
    --legacy-secondary: #7130d7;
    --legacy-accent-cyan: #0ea5e9;
    --legacy-accent-teal: #14b8a6;
    --legacy-accent-violet: #7c3aed;

    /* 背景 */
    --legacy-bg: #f2f6fd;
    --legacy-surface: #ffffff;
    --legacy-border: #d7dbe3;

    /* Mesh 渐变背景 */
    --legacy-mesh-rubric:
        radial-gradient(circle at 5% -12%, #d9ecff 0%, rgba(217, 236, 255, 0) 44%),
        radial-gradient(circle at 102% -4%, #e9d7ff 0%, rgba(233, 215, 255, 0) 43%),
        radial-gradient(circle at 92% 106%, #ccf2e8 0%, rgba(204, 242, 232, 0) 38%),
        linear-gradient(160deg, #ecf4ff 0%, #f4ebff 50%, #e7f3f7 100%);
}
```

### 3.2 布局架构

```
┌─────────────────────────────────────────────┐
│  [顶部栏 - 应用标题 + 试用标签 + 设置]       │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Hero Card (AI 驱动大卡片)           │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌──────────┐  ┌──────────┐               │
│  │ 导入细则  │  │ 模板库   │               │
│  └──────────┘  └──────────┘               │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 最近细则 (空状态)                    │   │
│  └─────────────────────────────────────┘   │
│                                             │
├─────────────────────────────────────────────┤
│  [底部导航 - 3 个 Tab]                      │
│  📋细则  ✓智能批改  📜阅卷记录              │
└─────────────────────────────────────────────┘
```

### 3.3 视觉特性

#### Mesh 渐变背景
- 每个页面有不同的 radial-gradient 组合
- 营造层次感和深度

#### 毛玻璃面板
```css
background: rgba(255, 255, 255, 0.68);
backdrop-filter: blur(14px);
```

#### Sheet 抽屉
```css
.legacy-sheet-mask {
    background: rgba(17, 24, 39, 0.36);
    display: flex;
    align-items: flex-end;
}
```

---

## 4. UI 组件层级

### 4.1 aigradingfrontend (完整)

```
ModernLayout
├── TaskProgressBar (任务进度)
│   └── TaskItem[]
├── RubricPanel
│   ├── RubricListView
│   ├── RubricEditPanel
│   ├── CreateRubricWizard
│   └── RubricResultView
├── GradingViewV2
├── RecordsViewV2
├── SettingsViewV2
└── BottomNav (底部导航)
```

### 4.2 grading-platform-v2 (骨架)

```
App
├── legacy-page-area
│   ├── rubric-view (静态)
│   ├── grading-view (静态)
│   └── records-view (静态)
├── legacy-nav
├── workspaceView Sheet
│   ├── RubricPanel (待完善)
│   ├── GradingPanel (待完善)
│   └── RecordsPanel (待完善)
└── settings Sheet
    └── SettingsSheetPanel (待完善)
```

---

## 5. 关键设计模式对比

### 5.1 导航模式

| 特性 | aigradingfrontend (旧) | grading-platform-v2 (新) |
|------|------------------------|------------------------|
| 方式 | Tab 状态切换 | View Stack + Sheet |
| 切换动画 | Tailwind animate | CSS @keyframes |
| 过渡 | 流畅 | 基础 |

### 5.2 组件架构

| 特性 | aigradingfrontend | grading-platform-v2 |
|------|------------------|---------------------|
| 组件库 | HeroUI 组件 | 纯 CSS + BEM |
| 响应式 | Tailwind 断点 | 固定 368px 宽度 |
| 主题 | CSS 变量 | CSS 变量 |
| 图标 | Lucide React | 内联 SVG |

---

## 6. 设计亮点

### 6.1 aigradingfrontend

- ✅ 完整的 HeroUI 组件生态
- ✅ 渐变主题色随 Tab 切换
- ✅ 任务进度实时反馈
- ✅ 响应式设计
- ✅ 毛玻璃效果
- ✅ 现代化字体 (Plus Jakarta Sans)

### 6.2 grading-platform-v2

- ✅ Mesh 渐变背景有层次感
- ✅ 毛玻璃效果现代
- ✅ 固定宽度适合 Chrome 扩展
- ✅ Sheet 抽屉交互
- ✅ 内联 SVG 无外部依赖

---

## 7. 设计问题与建议

### 7.1 当前问题

1. **两套设计系统并存**
   - aigradingfrontend: HeroUI + Tailwind
   - grading-platform-v2: 纯 CSS
   - 维护成本高

2. **grading-platform-v2 组件不完整**
   - Panel 内部逻辑未实现
   - 无状态管理
   - 纯静态展示

3. **UI 一致性不足**
   - 颜色、间距、字体不统一

### 7.2 改进建议

#### 短期
1. 完善 extension-app Panel 内部逻辑
2. 引入 Zustand 状态管理
3. 统一两个项目的 Design Tokens

#### 长期
1. 考虑复用 HeroUI 组件库
2. 建立统一的 Design System
3. 完善动画过渡效果

---

## 8. CSS 类名规范

### 8.1 aigradingfrontend (Tailwind)

```html
<!-- 使用 Tailwind 工具类 -->
<div class="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
    <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        按钮
    </button>
</div>
```

### 8.2 grading-platform-v2 (BEM)

```css
/* BEM 命名规范 */
.legacy-rubric-header { }
.legacy-rubric-header__title { }
.legacy-rubric-header--active { }

/* 块 */
.legacy-hero-card { }
/* 元素 */
.legacy-hero-card__title { }
/* 修饰符 */
.legacy-hero-card--disabled { }
```

---

## 9. 响应式设计

### 9.1 aigradingfrontend

```css
/* Tailwind 断点 */
sm: 640px   /* 手机横屏 */
md: 768px   /* 平板 */
lg: 1024px  /* 小屏笔记本 */
xl: 1280px  /* 桌面 */
2xl: 1536px /* 大屏 */
```

### 9.2 grading-platform-v2

```css
/* 固定宽度 - Chrome 扩展最佳实践 */
.legacy-shell {
    width: 100%;
    max-width: 368px;  /* Chrome 扩展 popup 常用宽度 */
    height: 100%;
}
```

---

## 10. 动画效果

### 10.1 aigradingfrontend

```css
/* Tailwind 内置动画 */
.animate-pulse    /* 脉冲 */
.animate-spin     /* 旋转 */
.animate-bounce   /* 弹跳 */

/* 自定义 keyframes */
@keyframes slide-in-from-top {
    from { transform: translateY(-10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
.animate-in { animation: slide-in-from-top 0.3s ease-out; }
```

### 10.2 grading-platform-v2

```css
/* 基础动画 */
@keyframes legacy-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
.legacy-rubric-loader {
    animation: legacy-spin 1s linear infinite;
}
```

---

## 11. 总结

| 维度 | aigradingfrontend | grading-platform-v2 |
|------|------------------|---------------------|
| 完整度 | 高 | 低 |
| 美观度 | 高 | 中 |
| 维护性 | 中 | 高 (代码简洁) |
| 开发效率 | 高 (组件库) | 低 (纯 CSS) |
| 推荐场景 | 生产环境 | 新功能开发 |

**建议**: 短期内在 grading-platform-v2 中复用 aigradingfrontend 的设计系统和组件，提高开发效率。
