/**
 * rubric-v3.ts - 评分细则 v3 类型定义
 */

export type StrategyType = 'point_accumulation' | 'sequential_logic' | 'rubric_matrix';

export type ScoringStrategyType = 'pick_n' | 'all' | 'weighted';

export interface ScoringStrategy {
    type: ScoringStrategyType;
    maxPoints?: number;
    pointValue?: number;
    allowAlternative?: boolean;
    strictMode?: boolean;
    openEnded?: boolean;
}

export interface RubricPoint {
    id: string;
    questionSegment?: string;
    content: string;
    keywords?: string[];
    requiredKeywords?: string[];
    score: number;
    deductionRules?: string;
    openEnded?: boolean;
    order?: number;
}

export interface PointAccumulationContent {
    scoringStrategy: ScoringStrategy;
    points: RubricPoint[];
    totalScore?: number;
}

export interface SequentialLogicContent {
    scoringStrategy: ScoringStrategy;
    steps: RubricPoint[];
    requireOrder?: boolean;
    totalScore?: number;
}

export interface RubricMatrixContent {
    dimensions: Array<{
        id: string;
        name: string;
        weight?: number;
        levels: Array<{
            label: string;
            score: number;
            description?: string;
        }>;
    }>;
    totalScore?: number;
}

export interface RubricConstraint {
    id: string;
    type: string;
    description?: string;
    penalty?: {
        per?: number;
        max?: number;
    };
    config?: Record<string, any>;
}

export interface RubricMetadata {
    questionId: string;
    title: string;
    subject?: string;
    grade?: string;
    questionType?: string;
    examId?: string | null;
    examName?: string;
    tags?: string[];
}

export interface RubricJSONV3 {
    version: '3.0';
    metadata: RubricMetadata;
    strategyType: StrategyType;
    content: PointAccumulationContent | SequentialLogicContent | RubricMatrixContent;
    constraints?: RubricConstraint[];
    createdAt: string;
    updatedAt: string;
}
