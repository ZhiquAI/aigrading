# Rubric Model v2 (Checklist) 评估报告

**评估对象**: `rubric-model-v2-checklist.md`
**评估时间**: 2026-02-17
**评估人**: Antigravity (AI Architect)

---

## 1. 总体评价

这份评分模型设计文档展示了极高的专业度，明显是针对真实复杂的考试场景（特别是历史/文科类主观题）经过深思熟虑的产物。它不仅仅是一个数据结构定义，更是一套完整的**评分治理体系**。

该模型成功地从"单点匹配"进化到了"结构化评分"，能够有效应对多问、混合题型以及复杂的给分逻辑。

---

## 2. 核心价值 (The Good)

### 2.1 引入 `Segments` (分段/分小题) —— 关键突破
- **现状痛点**: 原有的扁平化 `answerPoints` 列表无法处理多问（如 Q15 包含填空+简答）。AI 容易将第二问的答案匹配到第一问的得分点。
- **价值**: `Segments` 结构完美实现了关注点隔离。每个 Segment 拥有独立的 `strategyType` 和 `matching` 规则，这对于混合题型（如"填空+材料分析"）是**必须采纳**的设计。

### 2.2 策略矩阵 (Strategy Matrix) —— 边界清晰
- 文档清晰界定了不同学科、不同题型的算法适配：
  - **踩点给分 (`point_accumulation`)**: 适用于历史/政治的填空与简答。
  - **分层赋分 (`rubric_matrix`)**: 适用于作文与论述题。
- 这种分类符合文科阅卷的底层逻辑，避免了"一把锤子敲所有钉子"。

### 2.3 容错设计 (Global Policy) —— 实战意识
- `ocrTolerance` (OCR容忍度) 和 `minConfidence` (最低置信度) 的显式定义，体现了对 AI 不确定性的防御性设计。

---

## 3. 潜在风险与挑战 (The Risk)

### 3.1 工程复杂度 (Complexity)
- **前端负担**: 引入树状结构 (`Segments`) 后，评分细则编辑器 (Rubric Editor) 的 UI 开发成本将成倍增加。
    - **难点**: 需要在有限的 Side Panel 空间内实现嵌套表单、拖拽排序、多层级验证。
- **过度设计风险**: `constraints`（逻辑约束）和 `sequential_logic`（步骤依赖）对于目前的"历史/政治"学科来说可能属于过度设计，会增加系统熵值。

### 3.2 版本与迁移
- **版本号混淆**: 文件名是 v2，接口定义是 v4.0。需统一语义化版本。
- **Breaking Change**: 现有的数据库数据、前端组件 (`RubricDrawer`) 均基于扁平结构。升级如同"换引擎"，需要周密的迁移计划。

---

## 4. 落地建议 (Recommendations)

### 4.1 裁剪式落地 (Pragmatic Adoption)
建议分阶段实施，不要一次性重构：

**Phase 1: 结构升级 (必选)**
- 引入 simplified `Segments` 结构。
- 即使是通过 API 兼容层（Adapter），也必须让后端开始支持这种嵌套结构。
- **目标**: 支持"一题多问"。

**Phase 2: 策略增强 (可选)**
- 实现 `point_accumulation` vs `weighted` 的区分。
- 在前端 UI 中显式展示这些策略选项。

**Phase 3: 高级逻辑 (暂缓)**
- 暂时砍掉 `constraints` 和 `sequential_logic`。
- 集中精力打通历史科目的核心链路。

### 4.2 数据结构微调
建议采用过渡性 schema (v3)：

```typescript
interface RubricV3 {
  // ... metadata
  children: Segment[]; // 核心变化：将扁平的 answerPoints 移入 Segment
}

interface Segment {
  title?: string; // e.g. "第一问"
  points: AnswerPoint[]; // 原来的 answerPoints
  strategy: 'check_points' | 'overall'; // 简化策略
}
```

---

## 5. 待探究问题 (Deep Dive)

1.  **Data Migration**: 现有的扁平化历史数据（v2.0）如何无损迁移到新的分段结构？是否需要编写自动化迁移脚本？
2.  **UI/UX**: 在 Side Panel 的狭窄空间内，如何优雅地展示嵌套的 `Segments`？是否考虑使用"手风琴"折叠或"面包屑"钻取导航？
3.  **AI Latency**: 引入分段后，AI 是应该一次性批改所有段落（长 Context），还是按段落分多次并发请求（增加 QPS 但降低单次延迟）？需进行成本/速度测试。
