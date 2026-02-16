# 评分细则模型设计清单（Rubric Schema v4）

## 1. 可执行清单

1. 落地一版可扩展的 `Rubric Schema v4`，统一支持单题型与混合题型。
2. 建立"学科 × 题型"策略矩阵，明确不同场景的判定与算分策略。
3. 提供混合题型样例，作为生成与批改链路联调基准。

## 2. Rubric Schema v4（统一骨架）

```ts
type StrategyType = "point_accumulation" | "sequential_logic" | "rubric_matrix";
type SegmentAggregation = "sum" | "weighted_sum" | "max";
type MatchMode = "strict" | "keyword" | "semantic";

// ── 段内内容：Union 结构，保持与 v3 一致的严格类型 ──

interface PointAccumulationContent {
  scoringStrategy: ScoringStrategy;
  points: Array<{ id: string; content: string; score: number; keywords?: string[]; questionSegment?: string }>;
  totalScore?: number;
}

interface SequentialLogicContent {
  scoringStrategy: ScoringStrategy;
  steps: Array<{ id: string; content: string; score: number; dependsOn?: string[]; keywords?: string[] }>;
  requireOrder?: boolean;
  totalScore?: number;
}

interface RubricMatrixContent {
  dimensions: Array<{
    id: string;
    name: string;
    weight?: number;
    levels: Array<{ label: string; score: number; description?: string }>;
  }>;
  totalScore?: number;
}

type SegmentContent = PointAccumulationContent | SequentialLogicContent | RubricMatrixContent;

// ── 主结构 ──

interface ScoringStrategy {
  type: "all" | "pick_n" | "weighted";
  maxPoints?: number;
  pointValue?: number;
  allowAlternative?: boolean;
  strictMode?: boolean;
}

interface RubricV4 {
  version: "4.0";
  metadata: {
    subject: string;
    grade?: string;
    examName?: string;
    questionId: string;
    questionType: "single" | "mixed";
    totalScore: number;
  };
  globalPolicy: {
    conflictPolicy: "checkpoints_first" | "segments_first";
    minConfidence: number;
    ocrTolerance: "low" | "medium" | "high";
  };
  segments: Segment[];
  segmentAggregation: SegmentAggregation;
  constraints?: Constraint[];
  createdAt: string;
  updatedAt: string;
}

interface Segment {
  id: string;
  title: string;
  questionType: string;
  strategyType: StrategyType;
  maxScore: number;
  weight?: number;
  matching: {
    mode: MatchMode;
    strictMode?: boolean;
    allowAlternative?: boolean;
  };
  scoring: ScoringStrategy;
  content: SegmentContent;
  constraints?: Constraint[];
}

interface Constraint {
  id: string;
  type: "deduction_fixed" | "deduction_per_count" | "score_cap" | "logic_check";
  config: Record<string, unknown>;
}
```

## 3. 学科 × 题型策略矩阵（模板）

| 学科 | 题型 | strategyType | matching.mode | scoring.type | 关键约束 |
| --- | --- | --- | --- | --- | --- |
| 历史/政治 | 选择/填空 | point_accumulation | strict/keyword | all/weighted | 术语精确匹配 |
| 历史/政治 | 材料分析 | point_accumulation | keyword+semantic | weighted/pick_n | 观点需有史实支撑 |
| 语文/英语 | 阅读/简答 | point_accumulation | semantic | weighted | 关键词覆盖+表达完整 |
| 语文/英语 | 作文/论述 | rubric_matrix | semantic | weighted | 分层评分、错别字扣分 |
| 数学/物理 | 计算/证明 | sequential_logic | strict | weighted | 步骤依赖 |
| 化学/生物 | 实验/机理 | sequential_logic + matrix | keyword+semantic | weighted | 术语准确、因果链完整 |

## 4. 混合题型实例（同题多段）

```json
{
  "version": "4.0",
  "metadata": {
    "subject": "历史",
    "questionId": "Q15",
    "questionType": "mixed",
    "totalScore": 10
  },
  "globalPolicy": {
    "conflictPolicy": "checkpoints_first",
    "minConfidence": 0.8,
    "ocrTolerance": "medium"
  },
  "segmentAggregation": "sum",
  "segments": [
    {
      "id": "s1",
      "title": "基础史实",
      "questionType": "填空题",
      "strategyType": "point_accumulation",
      "maxScore": 4,
      "matching": { "mode": "strict", "strictMode": true },
      "scoring": { "type": "all" },
      "content": {
        "scoringStrategy": { "type": "all", "strictMode": true },
        "points": [
          { "id": "s1p1", "content": "辛亥革命爆发年份", "score": 2, "keywords": ["1911"] },
          { "id": "s1p2", "content": "《中华民国临时约法》", "score": 2, "keywords": ["临时约法"] }
        ]
      }
    },
    {
      "id": "s2",
      "title": "影响分析",
      "questionType": "材料分析题",
      "strategyType": "point_accumulation",
      "maxScore": 6,
      "matching": { "mode": "semantic", "allowAlternative": true },
      "scoring": { "type": "weighted" },
      "content": {
        "scoringStrategy": { "type": "weighted", "allowAlternative": true },
        "points": [
          { "id": "s2p1", "content": "推动民主共和观念传播", "score": 3, "keywords": ["民主", "共和"] },
          { "id": "s2p2", "content": "未改变半殖民地半封建社会性质", "score": 3, "keywords": ["半殖民地半封建"] }
        ]
      }
    }
  ],
  "createdAt": "2026-02-17T00:00:00.000Z",
  "updatedAt": "2026-02-17T00:00:00.000Z"
}
```

## 5. 落地建议

1. 先固定冲突策略为 `checkpoints_first`，减少段级覆盖条目导致的偏差。
2. 给每个学科维护最小术语词典（同义词、禁用词、必含词）。
3. 增加细则质量门槛（最少得分点数、分值闭合、覆盖率）再进入批改。
4. v3 → v4 迁移策略：单段 v3 自动包装为 `segments: [单个Segment]`，多段 v3 补 `matching` 和 `globalPolicy` 默认值。

## 6. v3 → v4 字段变更速查

| v3 字段 | v4 字段 | 变更说明 |
| --- | --- | --- |
| `version: "3.0"` | `version: "4.0"` | 版本升级 |
| 顶层 `strategyType` | 移入 `segments[].strategyType` | 统一至段级 |
| `content.scoringStrategy` | `segments[].scoring` + `segments[].content.scoringStrategy` | 双层保留 |
| 无 | `globalPolicy` | 新增全局策略 |
| 无 | `segments[].matching` | 新增匹配策略 |
| `aggregation` | `segmentAggregation` | 重命名避免歧义 |
| `constraints[].type: string` | `constraints[].type: enum(4)` | 收窄为枚举 |
