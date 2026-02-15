import { RubricJSONV3, ScoringStrategy } from './rubric-v3';

type SupportedStrategy = 'point_accumulation' | 'sequential_logic';
type FlatItem = Record<string, unknown>;

interface NormalizeOptions {
    taskScope?: 'question' | 'subquestion';
    mainQuestionNo?: string;
    expectedTotalScore?: number;
}

interface SegmentDecision {
    index: number;
    items: FlatItem[];
    scoringStrategy: ScoringStrategy;
    totalScore: number;
}

const CIRCLED_DIGIT_MAP: Record<string, string> = {
    '\u2460': '1',
    '\u2461': '2',
    '\u2462': '3',
    '\u2463': '4',
    '\u2464': '5',
    '\u2465': '6',
    '\u2466': '7',
    '\u2467': '8',
    '\u2468': '9',
    '\u2469': '10'
};

const CHINESE_NUM_MAP: Record<string, number> = {
    '零': 0,
    '〇': 0,
    '一': 1,
    '二': 2,
    '两': 2,
    '三': 3,
    '四': 4,
    '五': 5,
    '六': 6,
    '七': 7,
    '八': 8,
    '九': 9
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
}

function asNumber(value: unknown, fallback = 0): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function toTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
}

function normalizeNumericText(text: string): string {
    return text
        .split('')
        .map((ch) => CIRCLED_DIGIT_MAP[ch] || ch)
        .join('');
}

function parseFlexibleInt(token: string): number | null {
    const normalized = normalizeNumericText(token.trim());
    if (!normalized) return null;

    const byDigits = Number(normalized);
    if (Number.isInteger(byDigits) && byDigits > 0) return byDigits;

    if (normalized === '十') return 10;

    const chars = [...normalized];
    if (chars.every((ch) => ch in CHINESE_NUM_MAP || ch === '十')) {
        if (chars.length === 1 && chars[0] in CHINESE_NUM_MAP) {
            const value = CHINESE_NUM_MAP[chars[0]];
            return value > 0 ? value : null;
        }
        if (chars.length === 2 && chars[0] === '十' && chars[1] in CHINESE_NUM_MAP) {
            return 10 + CHINESE_NUM_MAP[chars[1]];
        }
        if (chars.length === 2 && chars[1] === '十' && chars[0] in CHINESE_NUM_MAP) {
            return CHINESE_NUM_MAP[chars[0]] * 10;
        }
        if (chars.length === 3 && chars[1] === '十' && chars[0] in CHINESE_NUM_MAP && chars[2] in CHINESE_NUM_MAP) {
            return CHINESE_NUM_MAP[chars[0]] * 10 + CHINESE_NUM_MAP[chars[2]];
        }
    }

    return null;
}

function collectItemSemanticText(item: FlatItem): string {
    const segmentText = typeof item.questionSegment === 'string' ? item.questionSegment : '';
    const contentText = typeof item.content === 'string' ? item.content : '';
    return `${segmentText} ${contentText}`.trim();
}

function extractSubQuestionIndexFromId(id: string, maxCount = 20, mainQuestionNo?: string): number | null {
    if (!id) return null;
    const normalized = normalizeNumericText(id.trim());
    const escapedMain = mainQuestionNo ? normalizeNumericText(mainQuestionNo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';

    if (escapedMain) {
        const serialPattern = new RegExp(`^${escapedMain}[-_]\\d{1,3}$`);
        if (serialPattern.test(normalized)) {
            return null;
        }

        const nestedPattern = new RegExp(`^${escapedMain}[-_](\\d{1,2})[-_]`);
        const nestedMatch = normalized.match(nestedPattern);
        if (nestedMatch) {
            const nestedValue = Number(nestedMatch[1]);
            if (Number.isInteger(nestedValue) && nestedValue >= 1 && nestedValue <= maxCount) {
                return nestedValue;
            }
        }
    }

    const rootMatch = normalized.match(/^(\d{1,2})[-_]/);
    if (!rootMatch) return null;
    const value = Number(rootMatch[1]);
    if (!Number.isInteger(value) || value < 1 || value > maxCount) return null;
    return value;
}

function extractSubQuestionIndexFromText(text: string, maxCount = 20, mainQuestionNo?: string): number | null {
    if (!text) return null;
    const normalized = normalizeNumericText(text);
    const escapedMain = mainQuestionNo ? mainQuestionNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';

    const patterns: RegExp[] = [];
    if (escapedMain) {
        patterns.push(new RegExp(`${escapedMain}\\s*[-_]\\s*(\\d{1,2})`));
    }
    patterns.push(/[（(]\s*(\d{1,2})\s*[）)]/);
    patterns.push(/第\s*(\d{1,2})\s*(?:小问|问|题)/);
    patterns.push(/(?:^|[^0-9])(\d{1,2})\s*[-_.、]/);

    for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (!match) continue;
        const value = Number(match[1]);
        if (Number.isInteger(value) && value >= 1 && value <= maxCount) return value;
    }

    return null;
}

function extractIndicesFromText(text: string, mainQuestionNo?: string): number[] {
    if (!text) return [];
    const normalized = normalizeNumericText(text);
    const escapedMain = mainQuestionNo ? mainQuestionNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    const hit = new Set<number>();

    const regexList: RegExp[] = [
        /第\s*(\d{1,2})\s*(?:小问|问|题)/g,
        /[（(]\s*(\d{1,2})\s*[）)]/g
    ];
    if (escapedMain) {
        regexList.push(new RegExp(`${escapedMain}\\s*[-_]\\s*(\\d{1,2})`, 'g'));
    }

    regexList.forEach((pattern) => {
        const matches = normalized.matchAll(pattern);
        for (const match of matches) {
            const value = Number(match[1]);
            if (Number.isInteger(value) && value >= 1 && value <= 20) {
                hit.add(value);
            }
        }
    });

    return [...hit].sort((a, b) => a - b);
}

function decideSubQuestionCount(items: FlatItem[], constraints: RubricJSONV3['constraints'], mainQuestionNo?: string): number {
    const indices = new Set<number>();

    items.forEach((item) => {
        const idx = extractSubQuestionIndexFromText(collectItemSemanticText(item), 20, mainQuestionNo);
        if (idx) indices.add(idx);
    });

    (constraints || []).forEach((constraint) => {
        if (!constraint.description) return;
        extractIndicesFromText(constraint.description, mainQuestionNo).forEach((idx) => indices.add(idx));
    });

    if (indices.size < 2) return 1;
    return Math.max(...indices);
}

function assignByExplicitIndices(explicitIndices: Array<number | null>, subQuestionCount: number): Array<number | null> | null {
    const assigned = [...explicitIndices];
    const explicitPositions = assigned
        .map((value, index) => ({ value, index }))
        .filter((item): item is { value: number; index: number } => Number.isInteger(item.value));

    if (explicitPositions.length < 2) return null;

    let current: number | null = null;
    for (let i = 0; i < assigned.length; i += 1) {
        if (assigned[i]) {
            current = assigned[i];
            continue;
        }
        if (current) assigned[i] = current;
    }

    let backfill: number | null = null;
    for (let i = assigned.length - 1; i >= 0; i -= 1) {
        if (assigned[i]) {
            backfill = assigned[i];
            continue;
        }
        if (backfill) assigned[i] = backfill;
    }

    for (let i = 0; i < assigned.length; i += 1) {
        if (!assigned[i]) assigned[i] = 1;
        assigned[i] = Math.max(1, Math.min(subQuestionCount, assigned[i] || 1));
    }

    const distinct = new Set(assigned);
    return distinct.size >= 2 ? assigned : null;
}

function assignContiguouslyByScore(items: FlatItem[], subQuestionCount: number): number[] {
    const scores = items.map((item) => {
        const score = asNumber(item.score, 0);
        return score > 0 ? score : 1;
    });
    const total = scores.reduce((sum, value) => sum + value, 0);
    const target = Math.max(1, total / subQuestionCount);

    const assigned: number[] = [];
    let bucketIndex = 1;
    let bucketScore = 0;

    for (let i = 0; i < items.length; i += 1) {
        assigned.push(bucketIndex);
        bucketScore += scores[i];

        const remainingPoints = items.length - i - 1;
        const remainingBuckets = subQuestionCount - bucketIndex;
        if (bucketIndex >= subQuestionCount) continue;

        const shouldAdvanceByScore = bucketScore >= target && remainingPoints > remainingBuckets;
        const mustAdvanceForCapacity = remainingPoints === remainingBuckets;
        if (shouldAdvanceByScore || mustAdvanceForCapacity) {
            bucketIndex += 1;
            bucketScore = 0;
        }
    }

    return assigned;
}

function rebalanceAssignments(items: FlatItem[], assignments: number[], subQuestionCount: number): number[] {
    const next = [...assignments];
    const bucketIndexes: number[][] = Array.from({ length: subQuestionCount }, () => []);
    next.forEach((bucket, index) => {
        const normalized = Math.max(1, Math.min(subQuestionCount, bucket));
        next[index] = normalized;
        bucketIndexes[normalized - 1].push(index);
    });

    for (let bucket = 1; bucket <= subQuestionCount; bucket += 1) {
        const target = bucketIndexes[bucket - 1];
        if (target.length > 0) continue;

        let donor = -1;
        for (let i = 0; i < bucketIndexes.length; i += 1) {
            if (bucketIndexes[i].length > 1) {
                donor = i;
                break;
            }
        }
        if (donor < 0) break;

        const movedIndex = bucketIndexes[donor].pop();
        if (typeof movedIndex === 'number') {
            next[movedIndex] = bucket;
            bucketIndexes[bucket - 1].push(movedIndex);
        }
    }

    if (next.length !== items.length) return assignments;
    return next;
}

function extractPickNMaxPoints(text: string): number | null {
    const normalized = normalizeNumericText(text);
    if (/任答一点|任意一点|任选其一/.test(normalized)) return 1;

    const patterns = [
        /任答\s*([0-9一二两三四五六七八九十]+)\s*点/,
        /任意\s*([0-9一二两三四五六七八九十]+)\s*点/,
        /任选\s*([0-9一二两三四五六七八九十]+)\s*(?:点|项|条)?/
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (!match) continue;
        const value = parseFlexibleInt(match[1]);
        if (value && value > 0) return value;
    }

    return null;
}

function inferSegmentStrategy(items: FlatItem[], relatedConstraintText: string): {
    strategy: ScoringStrategy;
    normalizedItems: FlatItem[];
    totalScore: number;
} {
    const itemText = items.map(collectItemSemanticText).join('\n');
    const mergedText = `${relatedConstraintText}\n${itemText}`;

    const hasPickN = /(任答|任意|任选)/.test(mergedText);
    const hasObjectiveHint = /(客观题|精确匹配|严格匹配|必须精确|答案固定|唯一)/.test(mergedText);
    const hasOpenEndedHint = /(言之有理|开放性题目|合理即可|观点论述|阐述观点|论述)/.test(mergedText)
        || items.some((item) => Boolean(item.openEnded));
    const hasAnalysisHint = /(材料分析|关键词|按点给分|意义|作用|影响|原因|评价|分析)/.test(mergedText);

    const pointScoreSum = items.reduce((sum, item) => {
        const score = asNumber(item.score, 0);
        return sum + Math.max(0, score);
    }, 0);

    if (hasPickN) {
        const maxPoints = Math.max(1, extractPickNMaxPoints(mergedText) || 1);

        const totalFromHintMatch = normalizeNumericText(mergedText).match(
            /(?:任答|任意|任选)[^。；;\n]{0,40}?(?:得|计|给)\s*([0-9]+(?:\.[0-9]+)?)\s*分/
        );
        const totalFromHint = totalFromHintMatch ? asNumber(totalFromHintMatch[1], 0) : 0;
        const explicitPointValueMatch = normalizeNumericText(mergedText).match(
            /(?:每点|每答对一点|每项)\s*([0-9]+(?:\.[0-9]+)?)\s*分/
        );
        const explicitPointValue = explicitPointValueMatch ? asNumber(explicitPointValueMatch[1], 0) : 0;

        const totalScore = totalFromHint > 0
            ? totalFromHint
            : (pointScoreSum > 0 ? pointScoreSum : maxPoints);

        const pointValue = explicitPointValue > 0
            ? explicitPointValue
            : toTwoDecimals(Math.max(totalScore, 1) / maxPoints);

        const normalizedItems = items.map((item) => ({
            ...item,
            score: 0
        }));

        return {
            strategy: {
                type: 'pick_n',
                maxPoints,
                pointValue,
                strictMode: false,
                allowAlternative: true,
                openEnded: hasOpenEndedHint
            },
            normalizedItems,
            totalScore: toTwoDecimals(Math.max(totalScore, pointValue))
        };
    }

    if (hasObjectiveHint && hasAnalysisHint) {
        return {
            strategy: {
                type: 'weighted',
                strictMode: false,
                allowAlternative: true,
                openEnded: hasOpenEndedHint
            },
            normalizedItems: items,
            totalScore: toTwoDecimals(Math.max(pointScoreSum, 1))
        };
    }

    if (hasObjectiveHint) {
        return {
            strategy: {
                type: 'all',
                strictMode: true,
                allowAlternative: false,
                openEnded: false
            },
            normalizedItems: items,
            totalScore: toTwoDecimals(Math.max(pointScoreSum, 1))
        };
    }

    return {
        strategy: {
            type: 'weighted',
            strictMode: false,
            allowAlternative: hasAnalysisHint || !hasObjectiveHint,
            openEnded: hasOpenEndedHint
        },
        normalizedItems: items,
        totalScore: toTwoDecimals(Math.max(pointScoreSum, 1))
    };
}

function collectRelatedConstraintText(
    constraints: RubricJSONV3['constraints'],
    subQuestionIndex: number,
    mainQuestionNo?: string
): string {
    const lines: string[] = [];
    (constraints || []).forEach((constraint) => {
        const description = (constraint.description || '').trim();
        if (!description) return;
        const indices = extractIndicesFromText(description, mainQuestionNo);
        if (indices.length === 0 || indices.includes(subQuestionIndex)) {
            lines.push(description);
        }
    });
    return lines.join('\n');
}

function ensureSegmentDecisions(
    items: FlatItem[],
    assignments: number[],
    subQuestionCount: number,
    constraints: RubricJSONV3['constraints'],
    mainQuestionNo?: string
): SegmentDecision[] {
    const buckets: FlatItem[][] = Array.from({ length: subQuestionCount }, () => []);
    items.forEach((item, index) => {
        const bucket = assignments[index] || 1;
        buckets[Math.max(1, Math.min(subQuestionCount, bucket)) - 1].push(item);
    });

    return buckets.map((bucketItems, index) => {
        const itemList = bucketItems.length > 0 ? bucketItems : [items[Math.min(index, items.length - 1)]];
        const relatedConstraintText = collectRelatedConstraintText(constraints, index + 1, mainQuestionNo);
        const inferred = inferSegmentStrategy(itemList, relatedConstraintText);

        return {
            index: index + 1,
            items: inferred.normalizedItems,
            scoringStrategy: inferred.strategy,
            totalScore: inferred.totalScore
        };
    });
}

function buildSegmentTitle(index: number, items: FlatItem[]): string {
    const first = items[0] || {};
    const rawSegment = typeof first.questionSegment === 'string' ? first.questionSegment.trim() : '';
    if (rawSegment) {
        const cleaned = rawSegment.replace(/^第\s*[0-9一二三四五六七八九十]+(?:小问|问|题)\s*[:：]?\s*/u, '').trim();
        if (cleaned) return cleaned;
    }
    return `第${index}小题`;
}

function hasExistingSegments(content: Record<string, unknown>): boolean {
    const segments = asRecordArray(content.segments);
    return segments.length > 0;
}

function asSupportedStrategy(type: RubricJSONV3['strategyType']): SupportedStrategy | null {
    if (type === 'point_accumulation' || type === 'sequential_logic') return type;
    return null;
}

export function normalizeRubricSubQuestionSegments(
    rubric: RubricJSONV3,
    options: NormalizeOptions = {}
): RubricJSONV3 {
    if (options.taskScope === 'subquestion') return rubric;

    const supportedStrategy = asSupportedStrategy(rubric.strategyType);
    if (!supportedStrategy) return rubric;

    const rootContent = asRecord(rubric.content);
    if (!rootContent || hasExistingSegments(rootContent)) return rubric;

    const itemKey = supportedStrategy === 'sequential_logic' ? 'steps' : 'points';
    const rootItems = asRecordArray(rootContent[itemKey]);
    if (rootItems.length < 2) return rubric;

    const mainQuestionNo = options.mainQuestionNo || rubric.metadata.questionId || '';
    const subQuestionCount = decideSubQuestionCount(rootItems, rubric.constraints, mainQuestionNo);
    if (subQuestionCount < 2) return rubric;

    const explicitIndices = rootItems.map((item) => {
        const semanticMatch = extractSubQuestionIndexFromText(collectItemSemanticText(item), subQuestionCount, mainQuestionNo);
        if (semanticMatch) return semanticMatch;
        const rawId = typeof item.id === 'string' ? item.id : '';
        return extractSubQuestionIndexFromId(rawId, subQuestionCount, mainQuestionNo);
    });
    const byExplicit = assignByExplicitIndices(explicitIndices, subQuestionCount);
    const rawAssignments = byExplicit || assignContiguouslyByScore(rootItems, subQuestionCount);
    const assignments = rebalanceAssignments(rootItems, rawAssignments.map((value) => value || 1), subQuestionCount);

    const decisions = ensureSegmentDecisions(
        rootItems,
        assignments,
        subQuestionCount,
        rubric.constraints,
        mainQuestionNo
    );

    if (decisions.length < 2) return rubric;

    const expectedTotal = Number.isFinite(options.expectedTotalScore) && (options.expectedTotalScore || 0) > 0
        ? Number(options.expectedTotalScore)
        : undefined;
    const decisionTotal = decisions.reduce((sum, decision) => sum + Math.max(0, decision.totalScore), 0);

    let scale = 1;
    if (expectedTotal && decisionTotal > 0) {
        scale = expectedTotal / decisionTotal;
    }

    const segments = decisions.map((decision) => {
        const scaledScore = toTwoDecimals(Math.max(0, decision.totalScore * scale));
        const segmentContent: Record<string, unknown> = {
            scoringStrategy: decision.scoringStrategy,
            [itemKey]: decision.items,
            totalScore: scaledScore
        };

        if (supportedStrategy === 'sequential_logic' && typeof rootContent.requireOrder === 'boolean') {
            segmentContent.requireOrder = rootContent.requireOrder;
        }

        return {
            id: `${rubric.metadata.questionId || 'q'}-segment-${decision.index}`,
            title: buildSegmentTitle(decision.index, decision.items),
            strategyType: supportedStrategy,
            content: segmentContent,
            maxScore: scaledScore,
            order: decision.index
        };
    });

    const rootTotal = segments.reduce((sum, segment) => sum + asNumber(segment.maxScore, 0), 0);
    const normalizedContent: Record<string, unknown> = {
        aggregation: 'sum',
        segments,
        totalScore: expectedTotal && expectedTotal > 0 ? expectedTotal : toTwoDecimals(rootTotal)
    };
    if (supportedStrategy === 'sequential_logic' && typeof rootContent.requireOrder === 'boolean') {
        normalizedContent.requireOrder = rootContent.requireOrder;
    }

    return {
        ...rubric,
        content: normalizedContent as RubricJSONV3['content'],
        updatedAt: new Date().toISOString()
    };
}
