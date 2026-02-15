export interface RubricPromptContext {
    subject?: string;
    questionType?: string;
    totalScore?: number;
    customRules?: string[];
}

function buildContextPrompt(ctx: RubricPromptContext): string {
    const lines: string[] = [];

    if (ctx.subject) lines.push(`- 学科：${ctx.subject}`);
    if (ctx.questionType) lines.push(`- 题型：${ctx.questionType}`);
    if (typeof ctx.totalScore === 'number' && Number.isFinite(ctx.totalScore)) {
        lines.push(`- 总分：${ctx.totalScore}`);
    }

    if (lines.length === 0) return '';

    return `\n\n## 任务上下文\n${lines.join('\n')}`;
}

function buildCustomRulesPrompt(customRules: string[]): string {
    if (customRules.length === 0) return '';

    const numberedRules = customRules
        .map((rule) => rule.trim())
        .filter(Boolean)
        .map((rule, index) => `${index + 1}. ${rule}`)
        .join('\n');

    if (!numberedRules) return '';

    return `

## 教师个性化规则（最高优先级）
请优先理解并执行以下教师规则：
${numberedRules}

约束映射建议（优先写入 constraints）：
- 固定扣分：type="deduction_fixed"，config={ points, condition, threshold? }
- 计数扣分：type="deduction_per_count"，config={ points, perCount, metric, maxDeduct? }
- 分数封顶：type="score_cap"，config={ maxScore, condition, threshold? }
- 逻辑校验：type="logic_check"，config={ rule }

注意：保持 Rubric v3 输出结构，不要新增非 v3 顶层字段。`;
}

export function buildRubricSystemPrompt(basePrompt: string, context: RubricPromptContext): string {
    const parts = [
        basePrompt,
        buildContextPrompt(context),
        buildCustomRulesPrompt(context.customRules || [])
    ];

    return parts.join('');
}
