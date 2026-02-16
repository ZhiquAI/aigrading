# Rubric Schema v2 评估报告

> 评估日期：2026-02-17
> 对比基线：当前已落地的 [RubricJSON v3](file:///Users/hero/Desktop/ai-grading/aigradingbackend/src/lib/rubric-v3.ts)

---

## 📊 总体评价：设计思路清晰，但存在若干落地风险

清单的**方向正确**——用统一的 `Segment` 骨架承载"单题型"和"混合题型"，并引入"学科 × 题型策略矩阵"覆盖多学科。但文档定义和当前**已落地的 v3 Schema 之间存在显著冲突和冗余**，需处理好迁移关系。

---

## ✅ 优势

| 维度 | 评价 |
|------|------|
| **Segment 化设计** | 用 `segments[]` 拆分混合题合理，同一道题不同小问可有不同 `strategyType`，v3 已验证 |
| **策略矩阵** | "学科 × 题型" 矩阵表是优秀的文档化手段，能帮 AI 生成时选择正确策略组合 |
| **全局策略** | `globalPolicy` 引入 `minConfidence` 和 `ocrTolerance`，v3 中完全没有，有价值 |
| **落地建议** | 冲突策略、术语词典、质量门槛三条建议非常务实 |

---

## ⚠️ 问题与风险

### 1. 版本号混乱

文档标题叫 "Rubric Schema v2"，但接口定义中 `version: "4.0"`。当前已落地的是 `version: "3.0"`。

> [!IMPORTANT]
> 建议统一为 `4.0`，因为 `3.0` 已正式使用，不能回退版本号。文档标题相应改为 "Rubric Schema v4"。

---

### 2. 与 v3 不向后兼容

v3 结构（扁平）：
```
RubricV3 → strategyType + content (points/steps/dimensions/segments)
```

新 Schema 结构（嵌套）：
```
RubricV2 → segments[] → each segment has own strategyType + matching + scoring + content
```

核心差异总结：

| 对比项 | 当前 v3 | 新 Schema |
|--------|---------|-----------|
| `strategyType` 位置 | 顶层字段 | 仅在 `Segment` 内 |
| `scoringStrategy` 位置 | `content.scoringStrategy` | `Segment.scoring`（改名） |
| `matching` | **不存在** | 新增在 Segment 内 |
| `metadata.questionType` | 自由字符串 | `"single" \| "mixed"` 枚举 |
| `content` 结构 | 直接包含 `points/steps/dimensions` | 嵌套在 `Segment.content` |
| `globalPolicy` | **不存在** | 新增 |
| `constraints.type` | 自由字符串 | 限定为 4 种枚举 |

> [!CAUTION]
> 所有已保存的 v3 细则无法直接加载到新 Schema 下。需要显式的迁移层（`rubric-convert.ts`）做 v3 → v4 转换。

---

### 3. `Segment.content` 存在"结构歧义陷阱"

三个可选数组（`points?`, `steps?`, `dimensions?`）并列在一个对象里，**比 v3 的 Union 类型更弱**：

- 没有语义约束：`point_accumulation` 的 Segment 可以同时拥有 `steps` 和 `dimensions`
- v3 用 Zod 的 `superRefine` 做了严格交叉校验，新设计丢失了这个能力

> [!WARNING]
> 应保留 v3 的 `content: PointContent | StepContent | MatrixContent` Union 模式。

---

### 4. `MatchMode` 中 `formula` 模式过于理想化

```ts
type MatchMode = "strict" | "keyword" | "semantic" | "formula";
```

`formula`（公式等价）在当前技术栈（Gemini/Zhipu）中几乎不可实现——LLM 不擅长严格的数学公式等价判定。同样，`synonymDict`、`formulaEquivalence`、`unitCheck` 等字段目前没有对应引擎实现，属于**过度设计**。

> 建议：Phase 1 移除 `formula`，后续作为扩展点保留。

---

### 5. 缺少 `createdAt / updatedAt` 字段

v3 有 `createdAt` 和 `updatedAt` 作为顶层字段，新 Schema **完全移除**了它们。导致：

- 细则排序和版本管理丢失信号
- 前端列表展示缺少时间信息

> **必须加回来。**

---

### 6. `Aggregation` 在两层出现，语义冲突

- 顶层 `aggregation: Aggregation`（段间聚合方式）
- 段内 `scoring.type: "all" | "pick_n" | "weighted"`（段内得分点聚合）

两层命名和语义易混淆。建议明确区分：
- 顶层：`segmentAggregation: "sum" | "weighted_sum" | "max"`
- 段内：`pointScoring: { type: ... }`

---

## 🔧 改进建议清单

| # | 建议 | 优先级 |
|---|------|--------|
| 1 | **统一版本号为 `4.0`**，文档标题改为 "Rubric Schema v4" | 🔴 P0 |
| 2 | **保留 `createdAt / updatedAt` 字段** | 🔴 P0 |
| 3 | **`Segment.content` 改为 Union 类型**而非三可选字段并列 | 🔴 P0 |
| 4 | **编写 v3 → v4 迁移函数**（在 `rubric-convert.ts` 中扩展） | 🔴 P0 |
| 5 | **移除 `formula` MatchMode**，Phase 1 不支持 | 🟡 P1 |
| 6 | **精简 `matching` 对象**，移除 `synonymDict / formulaEquivalence / unitCheck` | 🟡 P1 |
| 7 | **重命名顶层 `aggregation` 为 `segmentAggregation`** | 🟡 P1 |
| 8 | `globalPolicy.conflictPolicy` 加文档说明 | 🟢 P2 |
| 9 | 策略矩阵中加入"默认 matching.mode" | 🟢 P2 |

---

## 💡 后续值得探究的 3 个问题

1. **v3 → v4 迁移策略**：已保存的 v3 细则是在读取时懒转换（lazy migration），还是跑批量迁移脚本？各自的 trade-off？

2. **`globalPolicy.minConfidence` 闭环**：AI 返回 confidence < 0.8 时，前端如何处理？标记"低置信度待复核" vs 直接拒绝？

3. **Segment-level vs Global constraints 优先级**：两层约束的执行顺序是什么？例如 Segment 允许错别字但全局不允许时，以谁为准？
