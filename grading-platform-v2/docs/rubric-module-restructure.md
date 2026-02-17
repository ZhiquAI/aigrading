# 评分细则模块结构重构方案

> 日期：2026-02-17 | 状态：已批准

---

## 一、现状问题

| 问题 | 位置 | 影响 |
|------|------|------|
| 主控制器 787 行，职责混合 | `RubricPanel.tsx` | 难维护、难扩展 |
| 工具函数重复定义 | `RubricPanel` + `RubricResultView` | `toRecord/toRecordList/normalizePoint` 两处各写一遍 |
| 列表逻辑重复 | `RubricHomeView` vs `RubricWelcomeView` + `RubricListView` | 3 个组件做同一件事 |
| 内部类型缺失 | `types.ts` 只有 18 行 | 到处 `unknown` |

---

## 二、目标结构

```
features/rubric/
├── RubricPanel.tsx           (≤200行，视图路由 + hook 组装)
├── RubricHomeView.tsx        (149行，不变，首页容器)
├── types.ts                  (~60行，共享类型)
├── hooks/
│   ├── useRubricForm.ts      (~120行，表单状态)
│   └── useRubricApi.ts       (~200行，API 交互)
├── utils/
│   └── rubric-parser.ts      (~180行，数据解析/转换)
└── views/
    ├── RubricInputView.tsx    (282行，不变)
    ├── RubricGeneratingView.tsx (35行，不变)
    └── RubricResultView.tsx   (~300行，删重复工具函数)

删除：WelcomeView.tsx、ListView.tsx
```

---

## 三、执行步骤

### 阶段一：结构重构（~1 天，零 UI 变化）

#### Step 1：提取工具函数 → `utils/rubric-parser.ts`

- 从 `RubricPanel.tsx` L53-290 剪切：`toRecord`, `toRecordList`, `firstText`, `normalizePoint`, `buildRubricResultPreview`, `extractQuestionKey`, `strategyLabelMap`, `parseRubricInput`, `toPrettyString`, `parseScore`, `fileToDataUrl`
- 从 `RubricResultView.tsx` L30-97 删除重复函数，改为导入
- 编译检查

#### Step 2：提取 hooks

- 新建 `hooks/useRubricForm.ts`：剪切 10 个表单 useState + `handleClearInput` + `handleImageUpload` + 计算属性
- 新建 `hooks/useRubricApi.ts`：剪切 `handleGenerate/Save/Delete/Load/Standardize/ImportJson/loadSummaries` + `busy/error/success` 状态
- `RubricPanel.tsx` 改为调用 hooks
- 编译检查

#### Step 3：合并首页+列表，删除冗余视图

- 删除 `views/RubricWelcomeView.tsx`
- 删除 `views/RubricListView.tsx`
- `RubricPanel` 去掉 `welcome` ViewState
- 清理 `rubric.css` 中无用样式
- 编译检查

#### Step 4：扩展 types.ts

- 移出 `ViewState`, `EntryIntent` 到 types.ts
- 新增 `RubricFormState`, `SegmentPreview`
- 编译检查

#### Step 5：验证

```bash
npx playwright test tests/visual/sidepanel.visual.spec.ts --update-snapshots
```

---

### 阶段二：v4 框架适配（紧接着做，~3 天）

#### Step 6：ResultView 分段渲染

- 新建 `views/SegmentCardList.tsx`
- 按 segments 分组渲染，每组一个卡片（小问标题 + 策略标签 + 分值 + 得分点）
- 解除多段只读，允许编辑 content/score/keywords

#### Step 7：特殊规则快捷标签

- `RubricInputView` textarea 上方加 4 个快捷标签按钮
- 点击追加文本：`错别字扣分` / `未写结论扣分` / `只有两小问` / `任答N点即可`

#### Step 8：上次配置记忆

- `useRubricForm` 中 grade/subject/questionType 初始值从 localStorage 读取
- 变化时自动写入

#### Step 9：约束标签展示

- `SegmentCardList` 底部渲染 `constraints[]` 为语义化标签
- 只展示，暂不编辑

#### Step 10：Prompt 版本化

- 后端 AI Prompt 文件加 `-v4` 后缀
- 内容显式约束输出格式

---

## 四、关键文件索引

| 文件 | 角色 |
|------|------|
| [RubricPanel.tsx](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app/src/features/rubric/RubricPanel.tsx) | 主控制器（待精简） |
| [RubricHomeView.tsx](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app/src/features/rubric/RubricHomeView.tsx) | 首页容器（保留） |
| [RubricInputView.tsx](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app/src/features/rubric/views/RubricInputView.tsx) | 输入表单（保留） |
| [RubricResultView.tsx](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app/src/features/rubric/views/RubricResultView.tsx) | 结果展示（清理重复） |
| [types.ts](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app/src/features/rubric/types.ts) | 共享类型（待扩展） |
| [rubric-v4.ts](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/packages/domain-core/src/rubric/rubric-v4.ts) | v4 Schema 定义 |
| [rubric-ui-v4-decision.md](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/docs/architecture/rubric-ui-v4-decision.md) | v4 适配决策文档 |
