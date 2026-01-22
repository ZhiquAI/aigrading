/**
 * rubric.ts - 评分细则类型定义
 * 
 * RubricJSON v2 标准格式（仅支持 v2）
 */

// ==================== 核心类型 ====================

/**
 * 评分策略类型
 * - pick_n: 任选 N 个得分点（如"任答3点得满分"）
 * - all: 必须答全所有得分点
 * - weighted: 加权评分（不同得分点分值不同）
 */
export type ScoringStrategyType = 'pick_n' | 'all' | 'weighted';

/**
 * 评分策略配置
 */
export interface ScoringStrategy {
    /** 策略类型 */
    type: ScoringStrategyType;
    /** pick_n 模式：最多取几个得分点计分 */
    maxPoints?: number;
    /** pick_n 模式：每个得分点的固定分值 */
    pointValue?: number;
    /** 是否允许替代答案（半开放题：言之成理亦可给分，但最多50%分数） */
    allowAlternative: boolean;
    /** 严格模式：填空题必须精确匹配关键词 */
    strictMode?: boolean;
    /** 开放题模式：言之有理即得满分 */
    openEnded?: boolean;
}

/**
 * 单个得分点
 */
export interface AnswerPoint {
    /** 唯一标识，如 "1-1", "2-3" */
    id: string;
    /** 标准答案内容 */
    content: string;
    /** 关键词列表（支持组合，如 "体育+赛事" 表示需同时包含） */
    keywords: string[];
    /** 必须包含的关键词（缺少则扣分） */
    requiredKeywords?: string[];
    /** 该得分点的分值 */
    score: number;
    /** 扣分规则说明 */
    deductionRules?: string;
    /** 开放题：此得分点言之有理即得满分 */
    openEnded?: boolean;
}

/**
 * 评分细则 JSON 格式 v2
 */
export interface RubricJSON {
    /** 格式版本（可选，默认 1.0） */
    version?: '1.0' | '2.0';
    /** 题目唯一标识，如 "18-2", "19-1" */
    questionId: string;
    /** 题目标题/类型，如 "影响分析", "举措分析" */
    title: string;
    /** 总分 */
    totalScore: number;
    /** 创建时间 (ISO 8601, 可选) */
    createdAt?: string;
    /** 最后更新时间 (ISO 8601, 可选) */
    updatedAt?: string;
    /** 评分策略 */
    scoringStrategy: ScoringStrategy;
    /** 得分点列表 */
    answerPoints: AnswerPoint[];
    /** 阅卷提示/注意事项 */
    gradingNotes: string[];
    /** 替代答案规则说明 */
    alternativeRules?: string;
}

// ==================== 工具类型 ====================

/**
 * 创建新评分细则时的输入（不需要时间戳，会自动生成）
 */
export type RubricJSONInput = Omit<RubricJSON, 'version' | 'createdAt' | 'updatedAt'>;

/**
 * 评分细则更新时的输入（部分字段可选）
 */
export type RubricJSONUpdate = Partial<Omit<RubricJSON, 'version' | 'questionId' | 'createdAt'>>;

/**
 * 评分细则列表项（用于列表展示，不含详细内容）
 */
export interface RubricListItem {
    questionId: string;
    title: string;
    totalScore: number;
    pointCount: number;
    updatedAt: string;
}

// ==================== 工厂函数 ====================

/**
 * 创建空白评分细则
 */
export function createEmptyRubric(questionId: string): RubricJSON {
    const now = new Date().toISOString();
    return {
        version: '2.0',
        questionId,
        title: '',
        totalScore: 6,
        createdAt: now,
        updatedAt: now,
        scoringStrategy: {
            type: 'pick_n',
            maxPoints: 3,
            pointValue: 2,
            allowAlternative: false,
            strictMode: true,
        },
        answerPoints: [],
        gradingNotes: ['严格按照参考答案评分'],
    };
}

/**
 * 创建空白得分点
 */
export function createEmptyAnswerPoint(id: string): AnswerPoint {
    return {
        id,
        content: '',
        keywords: [],
        score: 2,
    };
}

/**
 * 解析评分细则 JSON（仅支持 v2 格式）
 */
export function parseRubricJSON(json: unknown): RubricJSON {
    if (!json || typeof json !== 'object') {
        throw new Error('无效的评分细则 JSON');
    }

    const obj = json as Record<string, unknown>;

    if (obj.version && obj.version !== '1.0' && obj.version !== '2.0') {
        throw new Error('不支持的评分细则版本，请使用 v1.0 或 v2.0 格式');
    }

    return obj as unknown as RubricJSON;
}
