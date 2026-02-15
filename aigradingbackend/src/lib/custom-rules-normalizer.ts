import { RubricConstraint } from './rubric-v3';

interface NumericMatch {
    value: number;
    raw: string;
}

function parseFirstNumber(input: string, pattern: RegExp): NumericMatch | null {
    const matched = input.match(pattern);
    if (!matched?.[1]) return null;
    const value = Number(matched[1]);
    if (!Number.isFinite(value)) return null;
    return { value, raw: matched[1] };
}

function parseWordCountThreshold(rule: string): number | null {
    const match = parseFirstNumber(rule, /(?:字数\s*(?:不足|少于|低于|小于|<|<=)\s*)(\d+(?:\.\d+)?)/i);
    return match ? Math.max(0, Math.round(match.value)) : null;
}

function parseDeductionPoints(rule: string): number | null {
    const match = parseFirstNumber(rule, /扣\s*(\d+(?:\.\d+)?)\s*分?/i);
    return match ? Math.max(0, match.value) : null;
}

function parseScoreCap(rule: string): number | null {
    const match = parseFirstNumber(rule, /(?:最高|封顶|上限|不超过|≤|<=)\s*(\d+(?:\.\d+)?)\s*分?/i);
    if (match) return Math.max(0, match.value);
    if (/不及格/i.test(rule)) return 0;
    return null;
}

function normalizeWhitespace(input: string): string {
    return input.replace(/\s+/g, ' ').trim();
}

export function normalizeCustomRulesToConstraints(customRules: string[]): RubricConstraint[] {
    const normalizedRules = customRules
        .map((rule) => normalizeWhitespace(rule))
        .filter(Boolean);

    const constraints: RubricConstraint[] = [];

    normalizedRules.forEach((rule, index) => {
        const id = `cr_${index + 1}`;

        // 每 N 个错别字扣 X 分
        const typoPattern = /每\s*(\d+)\s*个?(?:错别字|错字)\s*扣\s*(\d+(?:\.\d+)?)\s*分?/i;
        const typoMatched = rule.match(typoPattern);
        if (typoMatched) {
            const perCount = Math.max(1, Number(typoMatched[1]));
            const points = Math.max(0, Number(typoMatched[2]));
            constraints.push({
                id,
                type: 'deduction_per_count',
                description: rule,
                config: {
                    points,
                    perCount,
                    metric: 'typo_count'
                }
            });
            return;
        }

        // 无标题扣分
        if (/无标题/i.test(rule)) {
            const points = parseDeductionPoints(rule) ?? 2;
            constraints.push({
                id,
                type: 'deduction_fixed',
                description: rule,
                config: {
                    points,
                    condition: 'missing_title'
                }
            });
            return;
        }

        // 字数不足 -> 扣分/封顶
        if (/(字数\s*(不足|少于|低于|小于|<|<=))|字数不足/i.test(rule)) {
            const threshold = parseWordCountThreshold(rule) ?? undefined;
            const cap = parseScoreCap(rule);
            if (cap !== null) {
                constraints.push({
                    id,
                    type: 'score_cap',
                    description: rule,
                    config: {
                        maxScore: cap,
                        condition: 'min_word_count',
                        threshold
                    }
                });
                return;
            }

            const points = parseDeductionPoints(rule) ?? 1;
            constraints.push({
                id,
                type: 'deduction_fixed',
                description: rule,
                config: {
                    points,
                    condition: 'min_word_count',
                    threshold
                }
            });
            return;
        }

        // 通用扣分规则
        if (/扣\s*\d+(?:\.\d+)?\s*分?/i.test(rule)) {
            const points = parseDeductionPoints(rule) ?? 1;
            constraints.push({
                id,
                type: 'deduction_fixed',
                description: rule,
                config: {
                    points,
                    condition: 'custom_rule'
                }
            });
            return;
        }

        // 兜底：逻辑校验
        constraints.push({
            id,
            type: 'logic_check',
            description: rule,
            config: {
                rule
            }
        });
    });

    return constraints;
}

export function mergeConstraintList(
    baseConstraints: RubricConstraint[] | undefined,
    extraConstraints: RubricConstraint[]
): RubricConstraint[] {
    const current = Array.isArray(baseConstraints) ? [...baseConstraints] : [];
    const keySet = new Set(
        current.map((item) => `${item.type}:${(item.description || '').trim()}`)
    );
    const idSet = new Set(current.map((item) => item.id));

    for (const item of extraConstraints) {
        const key = `${item.type}:${(item.description || '').trim()}`;
        if (keySet.has(key)) continue;

        let nextId = item.id;
        let counter = 1;
        while (idSet.has(nextId)) {
            nextId = `${item.id}_${counter}`;
            counter += 1;
        }

        current.push({ ...item, id: nextId });
        keySet.add(key);
        idSet.add(nextId);
    }

    return current;
}
