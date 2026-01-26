/**
 * 评分细则 JSON 结构定义 v2
 * 用于精准控制 AI 生成和评分逻辑
 */

// ==================== 核心类型 ====================

/**
 * 评分策略类型
 * - pick_n: 任选N点得分（如"答对任意3点得满分"）
 * - all: 全部答对才得分
 * - weighted: 加权计分
 */
export type ScoringStrategyType = 'pick_n' | 'all' | 'weighted';

/**
 * 评分策略配置
 */
export interface ScoringStrategy {
    type: ScoringStrategyType;
    maxPoints?: number;         // pick_n 策略：最多计算几个得分点
    pointValue?: number;        // 每个得分点的分值
    allowAlternative: boolean;  // 是否接受等效答案
    strictMode: boolean;        // 严格模式：必须精确匹配关键词
}

/**
 * 单个得分点
 */
export interface AnswerPoint {
    id: string;                   // 得分点编号，如 "1-1", "2-1"
    questionSegment?: string;     // 问题词 / 题干片段，如 "根本原因"
    content: string;              // 标准答案内容
    keywords: string[];           // 关键词列表（支持组合，如 "词1+词2"）
    requiredKeywords?: string[];  // 必须包含的关键词（缺少则扣分）
    score: number;                // 该点分值
    deductionRules?: string;      // 扣分规则说明
}

/**
 * 评分细则 JSON 结构 v2
 */
export interface RubricJSON {
    version: '2.0';
    questionId: string;         // 题号
    title: string;              // 题目类型（如"影响分析"、"原因探究"）
    totalScore: number;         // 总分
    createdAt: string;          // 创建时间 (ISO 8601)
    updatedAt: string;          // 更新时间 (ISO 8601)
    scoringStrategy: ScoringStrategy;
    answerPoints: AnswerPoint[];
    gradingNotes: string[];     // 阅卷提示/注意事项
    alternativeRules?: string;  // 等效答案说明
}

/**
 * 评分细则列表项（用于列表展示）
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

// ==================== 验证函数 ====================

/**
 * 验证 RubricJSON 结构的完整性
 */
export function validateRubricJSON(data: unknown): { valid: boolean; errors: string[]; rubric?: RubricJSON } {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
        return { valid: false, errors: ['数据必须是对象'] };
    }

    const obj = data as Record<string, unknown>;

    // 版本检查
    if (obj.version !== '2.0') {
        errors.push('版本号必须是 2.0');
    }

    // 必填字段检查
    if (!obj.questionId || typeof obj.questionId !== 'string') {
        errors.push('缺少有效的 questionId');
    }
    if (!obj.title || typeof obj.title !== 'string') {
        errors.push('缺少有效的 title');
    }
    if (typeof obj.totalScore !== 'number' || obj.totalScore < 0) {
        errors.push('缺少有效的 totalScore');
    }

    // 评分策略检查
    if (!obj.scoringStrategy || typeof obj.scoringStrategy !== 'object') {
        errors.push('缺少 scoringStrategy');
    } else {
        const strategy = obj.scoringStrategy as Record<string, unknown>;
        if (!['pick_n', 'all', 'weighted'].includes(strategy.type as string)) {
            errors.push('scoringStrategy.type 必须是 pick_n, all 或 weighted');
        }
    }

    // 得分点检查
    if (!Array.isArray(obj.answerPoints) || obj.answerPoints.length === 0) {
        errors.push('answerPoints 必须是非空数组');
    } else {
        obj.answerPoints.forEach((point: unknown, index: number) => {
            if (!point || typeof point !== 'object') {
                errors.push(`answerPoints[${index}] 必须是对象`);
                return;
            }
            const p = point as Record<string, unknown>;
            if (!p.id || !p.content || typeof p.score !== 'number') {
                errors.push(`answerPoints[${index}] 缺少必填字段 (id, content, score)`);
            }
        });
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    // 构造验证后的对象
    const now = new Date().toISOString();
    const strategy = obj.scoringStrategy as Record<string, unknown>;

    const rubric: RubricJSON = {
        version: '2.0',
        questionId: obj.questionId as string,
        title: obj.title as string,
        totalScore: obj.totalScore as number,
        createdAt: (obj.createdAt as string) || now,
        updatedAt: (obj.updatedAt as string) || now,
        scoringStrategy: {
            type: strategy.type as ScoringStrategyType,
            maxPoints: strategy.maxPoints as number | undefined,
            pointValue: strategy.pointValue as number | undefined,
            allowAlternative: Boolean(strategy.allowAlternative),
            strictMode: strategy.strictMode !== false, // 默认 true
        },
        answerPoints: (obj.answerPoints as any[]).map((p, i) => ({
            id: p.id || `${obj.questionId}-${i + 1}`,
            questionSegment: p.questionSegment || p.segment || p.questionWord || '', // Support multiple AI aliases
            content: p.content,
            keywords: Array.isArray(p.keywords) ? p.keywords : [],
            requiredKeywords: Array.isArray(p.requiredKeywords) ? p.requiredKeywords : undefined,
            score: p.score,
            deductionRules: p.deductionRules,
        })),
        gradingNotes: Array.isArray(obj.gradingNotes) ? obj.gradingNotes as string[] : [],
        alternativeRules: obj.alternativeRules as string | undefined,
    };

    return { valid: true, errors: [], rubric };
}

// ==================== 转换函数 ====================

/**
 * 将 RubricJSON 渲染为 Markdown 格式（用于展示）
 */
export function rubricToMarkdown(rubric: RubricJSON): string {
    const lines: string[] = [];

    // 标题
    lines.push(`## 第${rubric.questionId}题评分细则（共${rubric.totalScore}分）`);
    lines.push('');

    // 题型
    lines.push(`### ${rubric.title}（${rubric.totalScore}分）`);
    lines.push('');

    // 得分点表格
    lines.push('| 编号 | 答案 | 分值 |');
    lines.push('|------|------|------|');
    for (const point of rubric.answerPoints) {
        lines.push(`| ${point.id} | ${point.content} | ${point.score}分 |`);
    }
    lines.push('');

    // 评分规则
    const strategy = rubric.scoringStrategy;
    if (strategy.type === 'pick_n' && strategy.maxPoints) {
        lines.push(`> 📋 评分规则：每点${strategy.pointValue || '?'}分，答对任意${strategy.maxPoints}点得满分（${rubric.totalScore}分）`);
    } else if (strategy.type === 'all') {
        lines.push(`> 📋 评分规则：全部答对得${rubric.totalScore}分`);
    }

    if (strategy.allowAlternative && rubric.alternativeRules) {
        lines.push(`> ${rubric.alternativeRules}`);
    }
    lines.push('');

    // 阅卷提示
    if (rubric.gradingNotes.length > 0) {
        lines.push('### 阅卷提示');
        for (const note of rubric.gradingNotes) {
            lines.push(`- ${note}`);
        }
    }

    return lines.join('\n');
}

/**
 * 将 RubricJSON 转为列表项
 */
export function rubricToListItem(rubric: RubricJSON): RubricListItem {
    return {
        questionId: rubric.questionId,
        title: rubric.title,
        totalScore: rubric.totalScore,
        pointCount: rubric.answerPoints.length,
        updatedAt: rubric.updatedAt,
    };
}
