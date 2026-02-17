# 前端评分 UI 分析报告：v1 vs v2

> 分析日期：2026-02-17  
> 目标：基于当前 v1 和 v2 代码分析评分模式的 UI 设计现状，制定迁移方案

---

## 一、v1 (`aigradingfrontend`) 现状

### 架构总览

```
HeroUIDefaultLayout (主布局)
├── 底部 Tab Bar: 评分细则 | 智能批改 | 阅卷记录
├── RubricPanelHeroSimple — 细则管理
├── GradingView (1400行巨型组件) — 核心批改
│   ├── 状态机: idle → scanning → grading → review → error
│   ├── 顶栏: [辅助/自动] 模式切换 + 题号选择器
│   ├── 中区(状态视图):
│   │   ├── idle: 系统健康检查清单 + RubricLibrary
│   │   ├── scanning: 扫描动画
│   │   ├── grading: 4步进度动画
│   │   ├── review: 分数卡片 + 扁平 breakdown 列表
│   │   └── error: 错误信息
│   └── 底栏: 开始/停止/暂停按钮
├── HistoryViewHero — 阅卷记录
└── SettingsViewHero — 设置
```

### 两种评分模式

| 模式 | 流程 | UI 差异 |
|------|------|---------|
| **辅助 (Assist)** | executeGrading → fillScore(autoSubmit=false) → 等用户确认 | review 页顶部多一行"请确认"提示 |
| **自动 (Auto)** | executeGrading → fillScore(autoSubmit=true) → 1.5s 后自动 scanPage | 同上，无独立 UI |

### 关键问题

1. **GradingView 1400行严重违反单一职责** — Chrome 通信 + AI 调用 + 状态管理 + 全部 UI 渲染混在一起
2. **评分结果是扁平的** — `BreakdownItem{ label, score, max, comment }` 不感知 Segment
3. **辅助模式缺乏深度审阅** — 只能改总分，不能逐项确认/驳回
4. **无 OCR 文本展示 / 原图对照**

---

## 二、v2 (`grading-platform-v2`) 现状

### 架构总览

```
extension-app/src
├── App.tsx (254行) — 3 Tab + WorkspaceSheets 浮层
├── store/useRootStore.ts — useSyncExternalStore 自建 store, 6 slices
├── features/
│   ├── rubric/ — RubricHomeView + RubricPanel(23KB)
│   ├── grading/ — GradingHomeView + GradingPanel(444行)
│   ├── records/, settings/, health/, workspace/
└── lib/ — api.ts, extensionBridge.ts

packages/
├── ui-kit — 共享组件库 (Badge, Button, Card, StatusIndicator 等)
├── extension-bridge — Chrome 通信适配器
├── domain-core — 领域逻辑 + Rubric v4 类型
├── api-contracts — Zod schema
├── ai-gateway, config-kernel, logger-observability
```

### 关键发现

- **GradingPanel 是纯开发者调试面板**：`<input>` + `<textarea>` + `<pre>{JSON.stringify(result)}</pre>`
- **结果类型未结构化**：`breakdown: unknown`
- **无自动循环批改**：纯手动单次操作
- **架构优于 v1**：职责分离、Chrome 通信封装到独立 package

---

## 三、对比矩阵

| 维度 | v1 | v2 |
|------|----|----|
| 组件粒度 | 1400行巨壳 | 444行 + 独立 features |
| 状态管理 | Zustand (有 getter 陷阱) | 原生 useSyncExternalStore, 6 slices |
| Chrome 通信 | 直接 `chrome.tabs` API | `extension-bridge` 包封装 |
| AI 调用 | 混在组件里 | 统一 `lib/api.ts` → 后端 |
| 评分结果 UI | `ScoreCard` + `BreakdownItem[]` | `<pre>` 原始 JSON |
| Segment 感知 | ❌ | ❌ |
| 模式切换 | Assist/Auto 完整 UI | 仅 store 定义字段 |
| 自动循环批改 | ✅ `scanPage → grade → fillScore` | ❌ |

---

## 四、推荐方案：v1 UI 能力迁移到 v2 架构

**核心思路：借 v2 骨架，装 v1 肌肉，换 v4 大脑**

### 第一期：打通"能用"（~2-3 天）

1. 在 `packages/domain-core` 中定义 **GradingResult 类型**（基于 v4 Segment 结构）
2. 把 v1 的 `ScoreCard` / `ModeSelector` 抽到 `packages/ui-kit`，适配 v4 数据结构
3. 在 v2 的 `GradingPanel` 中集成这些组件，替代 `<pre>` 渲染

### 第二期：补全"好用"（~3-5 天）

4. 从 v1 移植自动循环逻辑，重构为状态机 hook（`useGradingMachine`）
5. 实现辅助模式的逐项审阅交互
6. 添加状态过渡动画

### 第三期：做到"好看"（~2-3 天）

7. 参考 `design/grading-detail-premium.html` 的 Glass Card 设计升级视觉
8. 实现 Segment 分组折叠和策略差异化渲染

### 为什么选这条路

- **不丢 v1 的经验**：自动循环、填分时序、Chrome 存储等踩坑经验保留
- **不背 v1 的债务**：1400 行巨壳被分解为可维护的 hooks + 组件
- **v4 Schema 自然融入**：迁移过程中同步升级为 Segment 感知结构
