# 评分细则 UI × v4 框架适配决策文档

> 日期：2026-02-17 | 状态：已确认

---

## 一、适配度评估

| 维度 | 适配度 | 说明 |
|------|--------|------|
| 输入表单 | 🟡 部分适配 | metadata 对齐，缺 Segment 级输入 |
| 结果展示 | 🟡 部分适配 | 有 Segment 感知但降级只读 |
| 结果编辑 | 🔴 不适配 | 多段细则无法编辑 |
| 内部类型 | 🔴 不适配 | `RubricResultPreview` 扁平，无 Segment 层级 |
| 策略/约束 | 🔴 缺失 | `matching`、`constraints`、`globalPolicy` 无 UI |

**结论：可"生存级"使用（单段简单题），无法发挥 v4 核心能力。**

---

## 二、核心设计决策

### 决策 1：简单 UI + AI 驱动 ✅

不在 UI 上暴露 v4 的结构复杂度（Segment 配置、匹配模式、聚合策略等），全部由 AI 根据学科+题型+图片自动推断。

| 层级 | 设计 |
|------|------|
| 输入 | 保持当前表单不变（学科/题型/题号/总分/图片/特殊规则） |
| 生成 | AI 输出完整 v4 JSON（含 segments、matching、constraints） |
| 审阅 | 语义化展示（分段卡片 + 中文标签），允许改内容/分值 |
| 保存 | 存完整 v4 JSON |

> 对 AI 生成质量要求更高 → 重心放在 Prompt 工程和标准化管线上。

### 决策 2：三种策略保留，但统一渲染 ✅

| 策略 | Schema | UI渲染 | AI 生成 |
|------|--------|--------|---------|
| `point_accumulation` | 保留 | 得分点列表 | 默认策略 |
| `sequential_logic` | 保留（不生成 `dependsOn`） | **共用**得分点列表，标签为"按步给分" | 数学/物理题 |
| `rubric_matrix` | 保留 | 维度×等级（后续开发） | 作文/论述题 |

> Schema 不改 → 零迁移成本。UI 统一渲染 → 减少组件数。

### 决策 3：Segment 纠错靠重新生成 ✅

| 阶段 | 策略 |
|------|------|
| MVP | AI 拆错 → 老师在特殊规则补提示 → 重新生成 |
| V1.5 | 允许删除多余 Segment（整段删除按钮） |
| V2 | 允许跨 Segment 拖拽得分点（需求明确后再做） |

---

## 三、具体执行清单

### 3.1 AI 生成质量门槛（后端 `standardize` 接口）

| 校验规则 | 行为 | 优先级 |
|---------|------|--------|
| ∑ segment.maxScore ≠ totalScore | 按比例归一化 | P0 |
| 得分点内容为空/重复 | 自动过滤 | P0 |
| segments 数组为空 | 拒绝，返回错误 | P0 |
| 策略类型 vs 学科不匹配 | 告警（不阻断） | P1 |
| keywords 为空 | AI 补充一轮 | P2 |

### 3.2 校验职责划分

| 校验项 | 位置 |
|--------|------|
| 总分/题号/图片为空 | **前端**（提交前拦截） |
| 分值闭合、得分点丰度、策略合理性 | **后端**（standardize 管线） |
| 结构修复（补默认值） | **后端** |

### 3.3 特殊规则输入优化

保持自由文本 + 加快捷标签：

```
💡 常用规则：[错别字扣分] [未写结论扣分] [只有两小问] [任答N点即可]
┌──────────────────────────────┐
│ 错别字每3个扣1分               │
│ 未写结论扣1分                  │
└──────────────────────────────┘
```

### 3.4 Prompt 版本管理

```
ai-gateway/prompts/
  rubric-generate-v4.ts      ← 文件名带版本号
  rubric-standardize-v4.ts
  grading-evaluate-v4.ts
```

- 文件名带 `-v4` 后缀
- 内容显式约束输出格式（"version 必须为 4.0"、"不要生成 dependsOn"）
- Schema 升级时 checklist 加一项"更新对应 Prompt"

---

## 四、UI 升级路径（优先级排序）

| 优先级 | 任务 | 工作量 | 依赖 |
|--------|------|--------|------|
| P0 | 结果页分段渲染（解除多段只读） | 1-2 天 | 无 |
| P1 | `RubricResultPreview` 类型升级为 Segment 感知 | 半天 | P0 |
| P2 | 特殊规则快捷标签 | 半天 | 无 |
| P3 | 约束/策略语义化标签展示 | 1 天 | P0 |
| P4 | `rubric_matrix` 维度×等级渲染组件 | 2-3 天 | P0 |

---

## 五、关键文件索引

| 文件 | 用途 |
|------|------|
| [rubric-v4.ts](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/packages/domain-core/src/rubric/rubric-v4.ts) | v4 Schema 类型定义 |
| [RubricInputView.tsx](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app/src/features/rubric/views/RubricInputView.tsx) | 输入表单 UI |
| [RubricResultView.tsx](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app/src/features/rubric/views/RubricResultView.tsx) | 结果展示/编辑 UI |
| [types.ts](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app/src/features/rubric/types.ts) | `RubricResultPreview` 类型（待升级） |
| [RubricPanel.tsx](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/apps/extension-app/src/features/rubric/RubricPanel.tsx) | 细则面板主控逻辑 |
| [rubric-model-v2-checklist.md](file:///Users/hero/Desktop/ai-grading/grading-platform-v2/docs/architecture/rubric-model-v2-checklist.md) | v4 Schema 设计清单 |
