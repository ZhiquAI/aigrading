# ⚡ Bold Energetic 设计语言规范 v1.0

> 📅 创建时间：2026-02-10
> 🎨 风格定位：AI 品牌感 + 教师亲和力

---

## 一、设计理念

**大胆活力风 (Bold Energetic)** — 以深邃暗底为画布，用霓虹渐变和发光效果注入"AI 科技感"，同时通过温暖的珊瑚橙点缀保持教育场景的亲和力。

| 维度 | 定义 |
|------|------|
| 基调 | 深邃暗底 + 霓虹渐变 |
| 情绪 | 专业、前沿、有活力 |
| 受众 | 40+ 岁教师群体（需要"高端但不冷漠"的感觉） |

---

## 二、调色板

### 主色系

| 名称 | 色值 | 用途 |
|------|------|------|
| **Electric Violet** (电光紫) | `#7C3AED` | 主色调，品牌标识，导航激活态 |
| **Neon Cyan** (霓虹青) | `#06B6D4` | 辅助色，与紫形成渐变，阅卷模块 |
| **Hot Coral** (活力珊瑚橙) | `#FF6B35` | 强调色/CTA，记录模块，重要操作 |
| **Electric Magenta** (洋红) | `#E040FB` | 徽章/高亮，稀少使用 |

### 核心渐变

```css
/* Hero 渐变 — 主品牌 */
--gradient-hero: linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%);

/* Energetic 渐变 — CTA / 强调 */
--gradient-energetic: linear-gradient(135deg, #FF6B35 0%, #E040FB 100%);

/* Neon 三色渐变 — 特殊场景 */
--gradient-neon: linear-gradient(135deg, #06B6D4 0%, #7C3AED 50%, #E040FB 100%);
```

### 表面色

| 名称 | 色值 | 用途 |
|------|------|------|
| App 背景 | `#0A0E1A` | 最底层画布 |
| Card 背景 | `rgba(15, 23, 42, 0.75)` | 卡片容器（半透明暗玻璃） |
| Float 背景 | `rgba(15, 23, 42, 0.85)` | 浮层/弹窗 |
| Elevated | `rgba(30, 41, 59, 0.6)` | 悬浮区域 |

### 文字色

| 名称 | 色值 | 用途 |
|------|------|------|
| Main | `#F1F5F9` | 标题/主体文字 |
| Body | `#CBD5E1` | 正文 |
| Muted | `#64748B` | 辅助说明 |
| Light | `#334155` | 禁用/极淡 |

### 功能色

| 名称 | 色值 |
|------|------|
| Success | `#10B981` |
| Danger | `#EF4444` |
| Warning | `#F59E0B` |

---

## 三、排版

| 属性 | 值 |
|------|------|
| 主字体 | `Space Grotesk` (力量感几何无衬线) |
| 后备字体 | `Inter`, system-ui |
| 等宽字体 | `JetBrains Mono` |
| 标签风格 | **大写 + 宽字距 (tracking-widest)** + font-black |
| 标题风格 | font-bold / font-black |

### 字体加载

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

---

## 四、阴影与光效

### 标准阴影（暗色环境）

```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.4), 0 1px 2px -1px rgba(0,0,0,0.3);
--shadow-md: 0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -2px rgba(0,0,0,0.3);
--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -4px rgba(0,0,0,0.4);
```

### 霓虹发光

```css
/* 主品牌光晕 */
--shadow-neon: 0 0 20px rgba(124,58,237,0.4), 0 0 60px rgba(6,182,212,0.2);

/* 小号光晕 */
--shadow-neon-sm: 0 0 10px rgba(124,58,237,0.3), 0 0 30px rgba(6,182,212,0.1);

/* 活力光晕 */
--shadow-energetic: 0 0 20px rgba(255,107,53,0.3), 0 0 60px rgba(224,64,251,0.15);
```

---

## 五、圆角

| Token | 值 | 用途 |
|-------|------|------|
| `radius-sm` | 8px | 小元素 |
| `radius-md` | 12px | 按钮、输入框 |
| `radius-lg` | 16px | 卡片 |
| `radius-xl` | 20px | 大卡片 |
| `radius-2xl` | 24px | 特殊面板 |
| `radius-full` | 9999px | 药丸形 |

---

## 六、动画

| 名称 | 效果 | 用途 |
|------|------|------|
| `neonPulse` | 边框光晕脉冲 (2s) | 激活态指示器、重要卡片 |
| `glowBreathe` | 透明度呼吸 (3s) | 背景氛围光 |
| `energeticSlideUp` | 弹性上滑 + scale (0.5s) | 页面/卡片入场 |
| `gradientShift` | 渐变色位移 (4s) | 动态渐变背景 |
| `navIndicatorGlow` | 导航指示器发光 (2s) | 底部导航激活态 |
| `shimmer` | 横向扫光 (2.5s) | 加载骨架/闪光效果 |

---

## 七、组件样式规范

### 底部导航栏

```
背景：#0A0E1A / 95% 不透明 + backdrop-blur-xl
边框：顶部 1px, rgba(30, 41, 59, 0.6)
阴影：向上 30px 紫色微光
高度：56px + safe-area-inset-bottom

Tab 图标：
  - 默认：text-slate-600, strokeWidth 1.8
  - 激活：per-tab color, strokeWidth 2.5, -translate-y-0.5

激活指示器：
  - 3px 渐变线条（per-tab 色→透明）
  - navIndicatorGlow 动画
  - 固定在 tab 顶部
```

### Tab-Module 配色

| Tab | 图标色 | 光晕色 | 氛围光 |
|-----|--------|--------|--------|
| 细则 | `primary-400` (#A78BFA) | 紫 | `primary-500` |
| 阅卷 | `neon-400` (#22D3EE) | 青 | `neon-500` |
| 记录 | `energetic-400` (#FF8A5C) | 橙 | `energetic-500` |
| 设置 | `slate-300` | 灰 | `slate-500` |

### 卡片 (Glass Card)

```css
background: rgba(15, 23, 42, 0.75);
backdrop-filter: blur(12px);
border: 1px solid rgba(124, 58, 237, 0.08);
box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
border-radius: 16px;
```

### 霓虹边框

```css
border: 1px solid rgba(124, 58, 237, 0.2);
box-shadow: 0 0 10px rgba(124, 58, 237, 0.1),
            inset 0 0 10px rgba(124, 58, 237, 0.05);

/* hover 增强 */
border-color: rgba(124, 58, 237, 0.4);
box-shadow: 0 0 20px rgba(124, 58, 237, 0.2),
            inset 0 0 15px rgba(124, 58, 237, 0.08);
```

### 渐变文字

```css
background: linear-gradient(135deg, #7C3AED, #06B6D4);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

---

## 八、响应式与无障碍

- **prefers-reduced-motion**: 所有动画 duration 归零
- **scrollbar**: 5px 宽，紫色半透明 thumb
- **selection**: `primary-500/30` 底色

---

## 九、实施文件清单

| 文件 | 职责 |
|------|------|
| `design-tokens.css` | CSS 自定义属性（调色板/阴影/渐变/排版） |
| `tailwind.config.js` | Tailwind 扩展主题（色组/渐变/阴影/动画） |
| `index.css` | 全局样式 + 动画 keyframes + 工具类 |
| `ModernLayout.tsx` | 导航壳层视觉实现 |
| `v2.html` | Space Grotesk 字体加载 |
