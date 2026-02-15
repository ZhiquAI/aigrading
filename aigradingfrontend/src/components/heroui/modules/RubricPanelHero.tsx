import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Image,
  Progress,
} from '@heroui/react';
import {
  ArrowLeft,
  BookTemplate,
  FileUp,
  ImagePlus,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from '@/components/Toast';
import type { RubricConstraint, RubricJSONV3, ScoringStrategyType, StrategyType } from '@/types/rubric-v3';
import { coerceRubricToV3 } from '@/utils/rubric-convert';
import { generateRubricFromImages } from '@/services/rubric-service';
import RubricListView, { type RubricTemplateSeed } from '@/src/components/v2/views/RubricListView';
import RubricResultView from '@/src/components/v2/views/RubricResultView';
import {
  RUBRIC_STRATEGY_OPTIONS,
  getQuestionTypeOptions,
  getSubjectOptions,
  inferStrategyTypeByQuestionType,
  normalizeQuestionTypeValue,
  normalizeSubjectValue,
} from '@/src/components/v2/views/rubric-config';

type ViewState = 'welcome' | 'list' | 'input' | 'generating' | 'result';
type TaskScope = 'question' | 'subquestion';
type SegmentMode = 'single' | 'multi';
type SpecialRuleType = 'deduction_fixed' | 'deduction_per_count' | 'score_cap' | 'logic_check';
type SplitRubricDraft = { questionId: string; json: string; itemCount: number };
type SpecialRuleDraft = {
  id: string;
  type: SpecialRuleType;
  description: string;
  points: string;
  perCount: string;
  threshold: string;
  maxScore: string;
};
type RubricTableRowDraft = {
  id: string;
  questionNo: string;
  subQuestionNo: string;
  score: string;
  point: string;
  strategy: ScoringStrategyType;
  inferredMaxPoints?: number;
  inferredPointValue?: number;
};

const generationMessages = [
  '正在分析图片结构...',
  '正在提取关键采分点...',
  '正在匹配评分策略...',
  '正在生成可编辑评分细则...',
];

const POINT_SCORING_MODE_OPTIONS: Array<{ value: ScoringStrategyType; label: string; hint: string }> = [
  { value: 'weighted', label: '按权重累计', hint: '按命中采分点累计得分' },
  { value: 'all', label: '全点命中', hint: '需覆盖全部采分点后给满分' },
  { value: 'pick_n', label: '任答 N 点', hint: '命中指定点数即可给分' },
];

const SPECIAL_RULE_TYPE_OPTIONS: Array<{ value: SpecialRuleType; label: string; hint: string }> = [
  { value: 'deduction_fixed', label: '固定扣分', hint: '触发后固定扣分' },
  { value: 'deduction_per_count', label: '计次扣分', hint: '按次数累计扣分' },
  { value: 'score_cap', label: '分数封顶', hint: '触发后总分封顶' },
  { value: 'logic_check', label: '逻辑校验', hint: '触发人工复核' },
];

function createRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSpecialRuleDraft(type: SpecialRuleType = 'deduction_fixed'): SpecialRuleDraft {
  if (type === 'deduction_per_count') {
    return {
      id: createRuleId(),
      type,
      description: '错别字',
      points: '1',
      perCount: '3',
      threshold: '',
      maxScore: '',
    };
  }
  if (type === 'score_cap') {
    return {
      id: createRuleId(),
      type,
      description: '',
      points: '',
      perCount: '',
      threshold: '200',
      maxScore: '8',
    };
  }
  if (type === 'logic_check') {
    return {
      id: createRuleId(),
      type,
      description: '',
      points: '',
      perCount: '',
      threshold: '',
      maxScore: '',
    };
  }
  return {
    id: createRuleId(),
    type,
    description: '',
    points: '1',
    perCount: '',
    threshold: '',
    maxScore: '',
  };
}

function inferPickNConfig(pointText: string, scoreText: string): { maxPoints: number; pointValue: number } | null {
  const text = pointText.trim();
  if (!text) return null;
  const patterns = [
    /任答\s*(\d+)\s*点/,
    /任意\s*(\d+)\s*点/,
    /任选\s*(\d+)\s*点/,
    /答出任意\s*(\d+)\s*点/,
  ];
  let maxPoints: number | null = null;
  for (const pattern of patterns) {
    const matched = text.match(pattern);
    if (matched?.[1]) {
      const parsed = Number(matched[1]);
      if (Number.isInteger(parsed) && parsed > 0) {
        maxPoints = parsed;
        break;
      }
    }
  }
  if (!maxPoints) return null;
  const score = parsePositiveNumber(scoreText);
  const pointValue = score ? Number((score / maxPoints).toFixed(2)) : 1;
  return { maxPoints, pointValue: pointValue > 0 ? pointValue : 1 };
}

function createRubricTableRow(questionNo: string = ''): RubricTableRowDraft {
  return {
    id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    questionNo,
    subQuestionNo: '1',
    score: '',
    point: '',
    strategy: 'weighted',
  };
}

function normalizeScoringStrategyType(value: unknown): ScoringStrategyType {
  if (value === 'pick_n' || value === 'all' || value === 'weighted') return value;
  return 'weighted';
}

function parsePositiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function formatNumericValue(value: number): string {
  return Number.isInteger(value) ? String(Math.round(value)) : String(value);
}

function hasSpecialRuleInput(rule: SpecialRuleDraft): boolean {
  if (rule.type === 'deduction_fixed' || rule.type === 'logic_check') {
    return rule.description.trim().length > 0 || rule.points.trim().length > 0;
  }
  if (rule.type === 'deduction_per_count') {
    return (
      rule.description.trim().length > 0
      || rule.points.trim().length > 0
      || rule.perCount.trim().length > 0
    );
  }
  return (
    rule.description.trim().length > 0
    || rule.threshold.trim().length > 0
    || rule.maxScore.trim().length > 0
  );
}

function buildSpecialRuleText(rule: SpecialRuleDraft): string | null {
  if (rule.type === 'deduction_fixed') {
    const desc = rule.description.trim();
    const points = parsePositiveNumber(rule.points);
    if (!desc) return null;
    return points ? `${desc}扣${formatNumericValue(points)}分` : desc;
  }
  if (rule.type === 'deduction_per_count') {
    const perCount = parsePositiveNumber(rule.perCount);
    const points = parsePositiveNumber(rule.points);
    if (!perCount || !points) return null;
    const metric = rule.description.trim() || '错别字';
    return `每${formatNumericValue(perCount)}个${metric}扣${formatNumericValue(points)}分`;
  }
  if (rule.type === 'score_cap') {
    const threshold = parsePositiveNumber(rule.threshold);
    const maxScore = parsePositiveNumber(rule.maxScore);
    if (!threshold || !maxScore) return null;
    const suffix = rule.description.trim();
    const base = `字数不足${formatNumericValue(threshold)}分数封顶${formatNumericValue(maxScore)}分`;
    return suffix ? `${base}（${suffix}）` : base;
  }
  const desc = rule.description.trim();
  return desc || null;
}

function detectStrategyByKeywords(text: string): StrategyType | null {
  const normalized = text.toLowerCase();
  if (/(分档|等级|一类|二类|三类|史论结合|观点论证|作文|论述|评价|主题命名|书面表达|辨析)/.test(normalized)) {
    return 'rubric_matrix';
  }
  if (/(步骤|过程|推导|实验|作图|计算|证明|流程|操作|解答)/.test(normalized)) {
    return 'sequential_logic';
  }
  if (/(任答|任意|列举|概括|说明|影响|简答|选择|填空|阅读|材料分析|要点)/.test(normalized)) {
    return 'point_accumulation';
  }
  return null;
}

function buildConstraintFromRule(rule: SpecialRuleDraft, index: number): RubricConstraint | null {
  const description = buildSpecialRuleText(rule);
  if (!description) return null;
  const id = `manual_rule_${index + 1}`;

  if (rule.type === 'deduction_fixed') {
    const points = parsePositiveNumber(rule.points) || 1;
    return {
      id,
      type: 'deduction_fixed',
      description,
      config: {
        points,
        condition: 'custom_rule',
      },
    };
  }
  if (rule.type === 'deduction_per_count') {
    const points = parsePositiveNumber(rule.points) || 1;
    const perCount = Math.max(1, Math.round(parsePositiveNumber(rule.perCount) || 1));
    return {
      id,
      type: 'deduction_per_count',
      description,
      config: {
        points,
        perCount,
        metric: 'custom_metric',
      },
    };
  }
  if (rule.type === 'score_cap') {
    const maxScore = parsePositiveNumber(rule.maxScore);
    if (!maxScore) return null;
    const threshold = parsePositiveNumber(rule.threshold);
    return {
      id,
      type: 'score_cap',
      description,
      config: {
        maxScore,
        condition: 'min_word_count',
        threshold: threshold || undefined,
      },
    };
  }
  return {
    id,
    type: 'logic_check',
    description,
    config: {
      rule: description,
    },
  };
}

function mergeConstraintList(baseConstraints: RubricConstraint[] | undefined, extraConstraints: RubricConstraint[]): RubricConstraint[] {
  const current = Array.isArray(baseConstraints) ? [...baseConstraints] : [];
  const keySet = new Set(current.map((item) => `${item.type}:${(item.description || '').trim()}`));
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

function applySpecialRuleConstraints(rubric: RubricJSONV3, rules: SpecialRuleDraft[]): RubricJSONV3 {
  const extra = rules
    .map((rule, index) => buildConstraintFromRule(rule, index))
    .filter((item): item is RubricConstraint => Boolean(item));
  if (extra.length === 0) return rubric;

  return {
    ...rubric,
    constraints: mergeConstraintList(rubric.constraints, extra),
    updatedAt: new Date().toISOString(),
  };
}

function buildRubricTableRowRule(row: RubricTableRowDraft, index: number): string | null {
  const questionNo = row.questionNo.trim();
  const subQuestionNo = row.subQuestionNo.trim();
  const score = parsePositiveNumber(row.score);
  const point = row.point.trim();
  if (!questionNo || !subQuestionNo || !score || !point) return null;

  const base = `评分表第${index + 1}行：题号=${questionNo}，子题号=${subQuestionNo}，分值=${formatNumericValue(score)}，评分点=${point}，评分策略=${row.strategy}`;
  if (row.strategy === 'pick_n') {
    const inferredMaxPoints = row.inferredMaxPoints;
    const inferredPointValue = row.inferredPointValue;
    if (inferredMaxPoints && inferredPointValue) {
      return `${base}；系统已自动推断 maxPoints=${formatNumericValue(inferredMaxPoints)}, pointValue=${formatNumericValue(inferredPointValue)}，请输出供教师审核`;
    }
    return `${base}；请结合评分点语义自动推断 maxPoints 与 pointValue 并输出供教师审核`;
  }
  return base;
}

function parseSubQuestionCount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 2 || parsed > 20) return null;
  return parsed;
}

function filterQuestionTypes(
  options: ReturnType<typeof getQuestionTypeOptions>
): ReturnType<typeof getQuestionTypeOptions> {
  const excluded = new Set(['选择题', '非选择题']);
  return options.filter((item) => !excluded.has(item.value) && !excluded.has(item.label));
}

function parseQuestionId(rawQuestionId?: string | null): {
  taskScope: TaskScope;
  questionNo: string;
  subQuestionNo: string;
} {
  const normalized = (rawQuestionId || '').trim().replace(/[—－]/g, '-');
  if (!normalized) {
    return { taskScope: 'question', questionNo: '', subQuestionNo: '' };
  }
  const sep = normalized.indexOf('-');
  if (sep > 0 && sep < normalized.length - 1) {
    return {
      taskScope: 'subquestion',
      questionNo: normalized.slice(0, sep).trim(),
      subQuestionNo: normalized.slice(sep + 1).trim(),
    };
  }
  return { taskScope: 'question', questionNo: normalized, subQuestionNo: '' };
}

function resolveTotalScore(rubric: RubricJSONV3): number | null {
  const content = rubric.content as Record<string, unknown>;
  const total = content.totalScore;
  return typeof total === 'number' ? total : null;
}

function resolvePointCount(rubric: RubricJSONV3): number {
  const content = rubric.content as Record<string, unknown>;
  if (Array.isArray(content.points)) return content.points.length;
  if (Array.isArray(content.steps)) return content.steps.length;
  if (Array.isArray(content.dimensions)) return content.dimensions.length;
  return 0;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectSubQuestionIndex(item: Record<string, unknown>, mainQuestionNo: string, count: number): number | null {
  const segments = [item.id, item.questionSegment, item.content]
    .filter((segment): segment is string => typeof segment === 'string' && segment.trim().length > 0)
    .join(' ');
  if (!segments) return null;

  const patterns: RegExp[] = [];
  if (mainQuestionNo.trim()) {
    patterns.push(new RegExp(`${escapeRegExp(mainQuestionNo.trim())}\\s*[-－]\\s*(\\d{1,2})`));
  }
  patterns.push(/[（(]\s*(\d{1,2})\s*[）)]/);
  patterns.push(/第\s*(\d{1,2})\s*(?:小问|问|题)/);
  patterns.push(/小问\s*(\d{1,2})/);

  for (const pattern of patterns) {
    const match = segments.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isInteger(value) && value >= 1 && value <= count) {
      return value;
    }
  }
  return null;
}

function splitItemsBySubQuestion(
  items: Array<Record<string, unknown>>,
  count: number,
  mainQuestionNo: string
): Array<Array<Record<string, unknown>>> {
  const buckets: Array<Array<Record<string, unknown>>> = Array.from({ length: count }, () => []);
  const unmatched: Array<Record<string, unknown>> = [];
  let hasExplicitMatch = false;

  for (const item of items) {
    const matched = detectSubQuestionIndex(item, mainQuestionNo, count);
    if (!matched) {
      unmatched.push(item);
      continue;
    }
    hasExplicitMatch = true;
    buckets[matched - 1].push(item);
  }

  if (hasExplicitMatch) {
    const emptyBucketIndexes = buckets
      .map((bucket, index) => (bucket.length === 0 ? index : -1))
      .filter((index) => index >= 0);
    unmatched.forEach((item, idx) => {
      const preferredEmpty = emptyBucketIndexes.shift();
      const target = preferredEmpty ?? idx % count;
      buckets[target].push(item);
    });
    return buckets;
  }

  items.forEach((item, idx) => {
    buckets[idx % count].push(item);
  });
  return buckets;
}

function cloneRubric(rubric: RubricJSONV3): RubricJSONV3 {
  return coerceRubricToV3(JSON.parse(JSON.stringify(rubric))).rubric;
}

function buildSplitRubrics(baseRubric: RubricJSONV3, mainQuestionNo: string, count: number): RubricJSONV3[] {
  if (baseRubric.strategyType === 'rubric_matrix') {
    return Array.from({ length: count }, (_, idx) => {
      const cloned = cloneRubric(baseRubric);
      cloned.metadata.questionId = `${mainQuestionNo}-${idx + 1}`;
      if (cloned.metadata.title) {
        cloned.metadata.title = `${cloned.metadata.title}（小问${idx + 1}）`;
      }
      cloned.updatedAt = new Date().toISOString();
      return cloned;
    });
  }

  const content = baseRubric.content as Record<string, unknown>;
  const itemKey = baseRubric.strategyType === 'sequential_logic' ? 'steps' : 'points';
  const rawItems = Array.isArray(content[itemKey]) ? (content[itemKey] as Array<Record<string, unknown>>) : [];
  const buckets = splitItemsBySubQuestion(rawItems, count, mainQuestionNo);
  const baseTotalScore = resolveTotalScore(baseRubric);
  const sourceScoreSum = rawItems.reduce((sum, item) => {
    const score = item.score;
    return typeof score === 'number' ? sum + score : sum;
  }, 0);

  return buckets.map((bucket, bucketIndex) => {
    const cloned = cloneRubric(baseRubric);
    const bucketQuestionNo = `${mainQuestionNo}-${bucketIndex + 1}`;
    cloned.metadata.questionId = bucketQuestionNo;
    if (cloned.metadata.title) {
      cloned.metadata.title = `${cloned.metadata.title}（小问${bucketIndex + 1}）`;
    }

    const clonedContent = cloned.content as Record<string, unknown>;
    const normalizedItems = bucket.map((item, itemIndex) => ({
      ...item,
      id: `${bucketQuestionNo}-${itemIndex + 1}`,
    }));
    clonedContent[itemKey] = normalizedItems;

    if (typeof baseTotalScore === 'number' && baseTotalScore > 0) {
      const bucketScoreSum = normalizedItems.reduce((sum, item) => {
        const score = item.score;
        return typeof score === 'number' ? sum + score : sum;
      }, 0);
      const inferredScore =
        sourceScoreSum > 0 && bucketScoreSum > 0
          ? Number(((bucketScoreSum / sourceScoreSum) * baseTotalScore).toFixed(1))
          : Number((baseTotalScore / count).toFixed(1));
      clonedContent.totalScore = inferredScore;
    }

    cloned.updatedAt = new Date().toISOString();
    return cloned;
  });
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('图片读取失败'));
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

const RubricPanelHero: React.FC = () => {
  const {
    exams,
    activeExamId,
    quota,
    rubricLibrary,
    rubricData,
    setActiveExamId,
    setRubricConfig,
    saveRubric,
    loadConfiguredQuestions,
    loadExams,
    createExamAction,
    selectQuestion,
  } = useAppStore();

  const subjectOptions = getSubjectOptions();
  const defaultSubject = subjectOptions[0]?.value || '历史';
  const defaultQuestionType = filterQuestionTypes(getQuestionTypeOptions(defaultSubject))[0]?.value || '材料题';

  const [viewState, setViewState] = useState<ViewState>('welcome');
  const [inputBackTarget, setInputBackTarget] = useState<'welcome' | 'list'>('welcome');
  const [selectedQuestionKey, setSelectedQuestionKey] = useState<string | null>(null);
  const [generatedRubric, setGeneratedRubric] = useState<RubricJSONV3 | null>(null);

  const [examName, setExamName] = useState('');
  const [taskScope, setTaskScope] = useState<TaskScope>('question');
  const [segmentMode, setSegmentMode] = useState<SegmentMode>('single');
  const [persistSplitSubRubrics, setPersistSplitSubRubrics] = useState(true);
  const [questionNo, setQuestionNo] = useState('');
  const [subQuestionNo, setSubQuestionNo] = useState('');
  const [subQuestionCount, setSubQuestionCount] = useState('');
  const [rubricTableRows, setRubricTableRows] = useState<RubricTableRowDraft[]>([createRubricTableRow()]);
  const [subject, setSubject] = useState(defaultSubject);
  const [questionType, setQuestionType] = useState(defaultQuestionType);
  const [strategyType, setStrategyType] = useState<StrategyType>(
    inferStrategyTypeByQuestionType(defaultSubject, defaultQuestionType)
  );
  const [manualStrategyOverride, setManualStrategyOverride] = useState(false);
  const [pointScoringType, setPointScoringType] = useState<ScoringStrategyType>('weighted');
  const [pointScoringMaxPoints, setPointScoringMaxPoints] = useState('1');
  const [pointScoringPointValue, setPointScoringPointValue] = useState('');
  const [totalScore, setTotalScore] = useState('');
  const [specialRules, setSpecialRules] = useState<SpecialRuleDraft[]>([createSpecialRuleDraft('logic_check')]);
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [answerImage, setAnswerImage] = useState<string | null>(null);
  const [draftRubricJson, setDraftRubricJson] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationStep, setGenerationStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [, setIsSaving] = useState(false);
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [splitRubricDrafts, setSplitRubricDrafts] = useState<SplitRubricDraft[]>([]);

  const importInputRef = useRef<HTMLInputElement>(null);
  const questionImageInputRef = useRef<HTMLInputElement>(null);
  const answerImageInputRef = useRef<HTMLInputElement>(null);

  const questionTypeOptions = useMemo(() => filterQuestionTypes(getQuestionTypeOptions(subject)), [subject]);
  const resolvedQuestionId = useMemo(() => {
    const main = questionNo.trim();
    const sub = subQuestionNo.trim();
    if (!main) return '';
    if (taskScope === 'subquestion' && sub) return `${main}-${sub}`;
    return main;
  }, [questionNo, subQuestionNo, taskScope]);

  const generationProgress = ((generationStep + 1) / generationMessages.length) * 100;
  const rubricTableRules = useMemo(
    () => rubricTableRows
      .map((row, index) => buildRubricTableRowRule(row, index))
      .filter((item): item is string => Boolean(item)),
    [rubricTableRows]
  );
  const invalidRubricTableRowCount = useMemo(
    () => rubricTableRows.filter((row) => {
      const hasInput = [row.questionNo, row.subQuestionNo, row.score, row.point].some((value) => value.trim().length > 0);
      if (!hasInput) return false;
      if (!row.questionNo.trim() || !row.subQuestionNo.trim()) return true;
      if (!parsePositiveNumber(row.score)) return true;
      return !row.point.trim();
    }).length,
    [rubricTableRows]
  );
  const customRules = useMemo(() => {
    return specialRules.map((rule) => buildSpecialRuleText(rule)).filter((item): item is string => Boolean(item));
  }, [specialRules]);
  const invalidSpecialRuleCount = useMemo(
    () => specialRules.filter((rule) => hasSpecialRuleInput(rule) && !buildSpecialRuleText(rule)).length,
    [specialRules]
  );
  const parsedSplitCount = useMemo(() => {
    if (taskScope !== 'question' || segmentMode !== 'multi') return null;
    return parseSubQuestionCount(subQuestionCount);
  }, [segmentMode, subQuestionCount, taskScope]);
  const configuredRubricCountLabel = useMemo(
    () => (rubricLibrary.length > 99 ? '99+' : String(rubricLibrary.length)),
    [rubricLibrary.length]
  );
  const recentRubrics = useMemo(() => rubricLibrary.slice(0, 2), [rubricLibrary]);
  const microLabelClass = 'pl-1 text-[10px] font-bold tracking-[0.08em] text-zinc-500';
  const inputFilledClass =
    'w-full rounded-xl border border-transparent bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-800 placeholder-zinc-400 transition focus:border-primary-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20';
  const pointScoringHint = useMemo(
    () => POINT_SCORING_MODE_OPTIONS.find((item) => item.value === pointScoringType)?.hint || '',
    [pointScoringType]
  );
  const historicalStrategyPreference = useMemo(() => {
    const normalizedSubject = normalizeSubjectValue(subject);
    const targetType = normalizeQuestionTypeValue(normalizedSubject, questionType);
    const pool = Object.values(rubricData || {}).map((item) => {
      try {
        return coerceRubricToV3(item).rubric;
      } catch {
        return null;
      }
    }).filter((item): item is RubricJSONV3 => Boolean(item));

    const matched = pool.filter((item) => {
      const itemSubject = normalizeSubjectValue(item.metadata.subject || '');
      const itemType = normalizeQuestionTypeValue(itemSubject, item.metadata.questionType || '');
      return itemSubject === normalizedSubject && itemType === targetType;
    });
    if (matched.length < 3) return null;

    const countMap = new Map<StrategyType, number>();
    matched.forEach((item) => {
      const key = item.strategyType;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    });
    const sorted = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    if (!top) return null;
    const ratio = top[1] / matched.length;
    if (ratio < 0.6) return null;
    return top[0];
  }, [questionType, rubricData, subject]);
  const strategyRecommendation = useMemo(() => {
    const reasons: string[] = [];
    const typedInference = inferStrategyTypeByQuestionType(subject, questionType);
    let recommended = historicalStrategyPreference || typedInference;
    reasons.push(`题型映射：${questionType}`);
    if (historicalStrategyPreference) {
      reasons.push('历史模板偏好已加权');
    }

    const keywordSource = [questionType, ...customRules].join('\n');
    const keywordInference = detectStrategyByKeywords(keywordSource);
    if (keywordInference && keywordInference !== typedInference) {
      recommended = keywordInference;
      reasons.push('规则关键词触发纠偏');
    }

    reasons.push(taskScope === 'subquestion' ? '任务粒度：小问' : '任务粒度：整题');
    return { strategyType: recommended, reasons };
  }, [customRules, historicalStrategyPreference, questionType, subject, taskScope]);
  const strategyLabelMap = useMemo(
    () => Object.fromEntries(RUBRIC_STRATEGY_OPTIONS.map((item) => [item.value, item.label])) as Record<string, string>,
    []
  );
  const recommendedStrategyLabel = strategyLabelMap[strategyRecommendation.strategyType] || strategyRecommendation.strategyType;
  const strategyReasonText = strategyRecommendation.reasons.join('；');

  const activeExamName = useMemo(
    () => exams.find((item) => item.id === activeExamId)?.name || '',
    [activeExamId, exams]
  );

  useEffect(() => {
    void loadConfiguredQuestions();
    void loadExams();
  }, [loadConfiguredQuestions, loadExams]);

  useEffect(() => {
    if (activeExamName && !examName.trim()) {
      setExamName(activeExamName);
    }
  }, [activeExamName, examName]);

  useEffect(() => {
    const mainQuestionNo = questionNo.trim();
    if (!mainQuestionNo) return;
    setRubricTableRows((prev) =>
      prev.map((row) => {
        if (row.questionNo.trim()) return row;
        return { ...row, questionNo: mainQuestionNo };
      })
    );
  }, [questionNo]);

  useEffect(() => {
    if (!questionTypeOptions.some((item) => item.value === questionType)) {
      const fallback = questionTypeOptions[0];
      if (fallback) {
        setQuestionType(fallback.value);
        setManualStrategyOverride(false);
      }
    }
  }, [questionType, questionTypeOptions]);

  useEffect(() => {
    if (!manualStrategyOverride) {
      setStrategyType(strategyRecommendation.strategyType);
    }
  }, [manualStrategyOverride, strategyRecommendation.strategyType]);

  useEffect(() => {
    if (viewState !== 'generating') return;
    const timer = setInterval(() => {
      setGenerationStep((prev) => (prev + 1) % generationMessages.length);
    }, 1200);
    return () => clearInterval(timer);
  }, [viewState]);

  useEffect(() => {
    let title = '设置评分细则';
    if (viewState === 'list') title = '评分模板库';
    if (viewState === 'input') title = '生成评分细则';
    if (viewState === 'generating') title = '正在生成细则';
    if (viewState === 'result') title = '细则生成结果';
    window.dispatchEvent(new CustomEvent('heroui:rubric-title', { detail: { title } }));
  }, [viewState]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('heroui:rubric-title', { detail: { title: '设置评分细则' } }));
    };
  }, []);

  const resetInputState = useCallback(() => {
    setQuestionNo('');
    setSubQuestionNo('');
    setSubQuestionCount('');
    setRubricTableRows([createRubricTableRow()]);
    setTaskScope('question');
    setSegmentMode('single');
    setPersistSplitSubRubrics(true);
    setManualStrategyOverride(false);
    setPointScoringType('weighted');
    setPointScoringMaxPoints('1');
    setPointScoringPointValue('');
    setTotalScore('');
    setSpecialRules([createSpecialRuleDraft('logic_check')]);
    setQuestionImage(null);
    setAnswerImage(null);
    setGenerationError(null);
    setSplitRubricDrafts([]);
  }, []);

  const updateSpecialRule = useCallback((ruleId: string, patch: Partial<SpecialRuleDraft>) => {
    setSpecialRules((prev) => prev.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule)));
  }, []);

  const addSpecialRule = useCallback((type: SpecialRuleType) => {
    setSpecialRules((prev) => [...prev, createSpecialRuleDraft(type)]);
  }, []);

  const removeSpecialRule = useCallback((ruleId: string) => {
    setSpecialRules((prev) => {
      const next = prev.filter((rule) => rule.id !== ruleId);
      return next.length > 0 ? next : [createSpecialRuleDraft('logic_check')];
    });
  }, []);

  const updateRubricTableRow = useCallback(
    (rowId: string, patch: Partial<RubricTableRowDraft>) => {
      setRubricTableRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const next = { ...row, ...patch };
          const shouldInfer = (patch.point !== undefined || patch.score !== undefined || patch.strategy !== undefined);
          if (shouldInfer) {
            const inferred = inferPickNConfig(next.point, next.score);
            if (inferred) {
              next.inferredMaxPoints = inferred.maxPoints;
              next.inferredPointValue = inferred.pointValue;
              if (patch.strategy === undefined || row.strategy === 'weighted') {
                next.strategy = 'pick_n';
              }
            } else {
              delete next.inferredMaxPoints;
              delete next.inferredPointValue;
            }
          }
          return next;
        })
      );
    },
    []
  );

  const addRubricTableRow = useCallback(() => {
    setRubricTableRows((prev) => [...prev, createRubricTableRow(questionNo.trim())]);
  }, [questionNo]);

  const removeRubricTableRow = useCallback((rowId: string) => {
    setRubricTableRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      return next.length > 0 ? next : [createRubricTableRow(questionNo.trim())];
    });
  }, [questionNo]);

  const autofillRubricRowsBySplitCount = useCallback(() => {
    if (!parsedSplitCount) return;
    const mainQuestionNo = questionNo.trim();
    setRubricTableRows(
      Array.from({ length: parsedSplitCount }, (_, idx) => {
        const row = createRubricTableRow(mainQuestionNo);
        row.subQuestionNo = String(idx + 1);
        return row;
      })
    );
  }, [parsedSplitCount, questionNo]);

  const hydrateSplitDrafts = useCallback((baseRubric: RubricJSONV3, targetQuestionNo: string, splitCount: number) => {
    const splitRubrics = buildSplitRubrics(baseRubric, targetQuestionNo, splitCount);
    setSplitRubricDrafts(
      splitRubrics.map((item) => ({
        questionId: item.metadata.questionId,
        json: JSON.stringify(item, null, 2),
        itemCount: resolvePointCount(item),
      }))
    );
  }, []);

  const applyRubricToEditor = useCallback(
    (rubric: RubricJSONV3, questionKey: string | null, options?: { preserveSubQuestionCount?: boolean }) => {
      const normalizedSubject = normalizeSubjectValue(rubric.metadata.subject || defaultSubject);
      const normalizedQuestionType =
        normalizeQuestionTypeValue(normalizedSubject, rubric.metadata.questionType) ||
        filterQuestionTypes(getQuestionTypeOptions(normalizedSubject))[0]?.value ||
        defaultQuestionType;
      const parsedId = parseQuestionId(rubric.metadata.questionId || '');

      setGeneratedRubric(rubric);
      setDraftRubricJson(JSON.stringify(rubric, null, 2));
      setSelectedQuestionKey(questionKey);
      setSubject(normalizedSubject);
      setQuestionType(normalizedQuestionType);
      setStrategyType(rubric.strategyType || inferStrategyTypeByQuestionType(normalizedSubject, normalizedQuestionType));
      setManualStrategyOverride(true);
      if (rubric.strategyType === 'point_accumulation') {
        const pointContent = rubric.content as Record<string, unknown>;
        const scoringStrategy =
          pointContent.scoringStrategy && typeof pointContent.scoringStrategy === 'object'
            ? (pointContent.scoringStrategy as Record<string, unknown>)
            : {};
        setPointScoringType(normalizeScoringStrategyType(scoringStrategy.type));
        setPointScoringMaxPoints(
          typeof scoringStrategy.maxPoints === 'number' && scoringStrategy.maxPoints > 0
            ? String(scoringStrategy.maxPoints)
            : '1'
        );
        setPointScoringPointValue(
          typeof scoringStrategy.pointValue === 'number' && scoringStrategy.pointValue > 0
            ? String(scoringStrategy.pointValue)
            : ''
        );
      } else {
        setPointScoringType('weighted');
        setPointScoringMaxPoints('1');
        setPointScoringPointValue('');
      }
      setTaskScope(parsedId.taskScope);
      setQuestionNo(parsedId.questionNo);
      setSubQuestionNo(parsedId.subQuestionNo);
      const preservedSplitCount = options?.preserveSubQuestionCount ? subQuestionCount : '';
      setSubQuestionCount(preservedSplitCount);
      if (!options?.preserveSubQuestionCount) {
        setRubricTableRows([createRubricTableRow(parsedId.questionNo)]);
      }
      setSegmentMode(preservedSplitCount.trim() ? 'multi' : 'single');
      setPersistSplitSubRubrics(true);
      setTotalScore(resolveTotalScore(rubric)?.toString() || '');
      setExamName(rubric.metadata.examName || activeExamName || '');
      setActiveExamId(rubric.metadata.examId || activeExamId || null);
      setGenerationError(null);
      if (!options?.preserveSubQuestionCount) {
        setSplitRubricDrafts([]);
      }
      setViewState('result');
    },
    [activeExamId, activeExamName, defaultQuestionType, defaultSubject, setActiveExamId, subQuestionCount]
  );

  const openInput = useCallback(
    (backTarget: 'welcome' | 'list') => {
      setInputBackTarget(backTarget);
      setViewState('input');
      setSelectedQuestionKey(null);
      setGeneratedRubric(null);
      setDraftRubricJson('');
      resetInputState();
    },
    [resetInputState]
  );

  const handleCreateExam = useCallback(async () => {
    const name = examName.trim();
    if (!name) {
      toast.warning('请输入考试名称');
      return;
    }
    const matchedExam = exams.find((item) => item.name.trim() === name);
    if (matchedExam) {
      setActiveExamId(matchedExam.id);
      toast.info('已关联到现有考试');
      return;
    }
    setIsCreatingExam(true);
    try {
      const created = await createExamAction({ name, date: new Date().toISOString() });
      if (created) {
        setActiveExamId(created.id);
        setExamName(created.name || name);
        toast.success('考试已创建');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建考试失败');
    } finally {
      setIsCreatingExam(false);
    }
  }, [createExamAction, examName, exams, setActiveExamId]);

  const handleExamNameChange = useCallback(
    (value: string) => {
      setExamName(value);
      const matchedExam = exams.find((item) => item.name.trim() === value.trim());
      setActiveExamId(matchedExam?.id || null);
    },
    [exams, setActiveExamId]
  );

  const handleImportRubric = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const normalized = coerceRubricToV3(parsed).rubric;
        setSubQuestionCount('');
        applyRubricToEditor(normalized, null);
        toast.success('已导入评分细则');
      } catch (error) {
        toast.error('导入失败：仅支持 Rubric v3 JSON');
      } finally {
        event.target.value = '';
      }
    },
    [applyRubricToEditor]
  );

  const handleUseSavedRubric = useCallback(
    (questionKey: string) => {
      const raw = rubricData?.[questionKey];
      if (!raw) {
        toast.error('未找到该细则内容');
        return;
      }
      try {
        const normalized = coerceRubricToV3(raw).rubric;
        setSubQuestionCount('');
        applyRubricToEditor(normalized, questionKey);
      } catch (error) {
        toast.error('细则格式异常，无法打开');
      }
    },
    [applyRubricToEditor, rubricData]
  );

  const handleUseTemplate = useCallback(
    (template: RubricTemplateSeed) => {
      const normalizedSubject = normalizeSubjectValue(template.subject || defaultSubject);
      const normalizedQuestionType =
        normalizeQuestionTypeValue(normalizedSubject, template.questionType) ||
        filterQuestionTypes(getQuestionTypeOptions(normalizedSubject))[0]?.value ||
        defaultQuestionType;
      openInput('list');
      setSubject(normalizedSubject);
      setQuestionType(normalizedQuestionType);
      if (template.strategyType) {
        setStrategyType(template.strategyType);
        setManualStrategyOverride(true);
      } else {
        setManualStrategyOverride(false);
      }
      if (template.examId) {
        setActiveExamId(template.examId);
      }
      if (template.examName?.trim()) {
        setExamName(template.examName.trim());
      }
      toast.success(`已应用模板：${normalizedSubject} · ${normalizedQuestionType}`);
    },
    [defaultQuestionType, defaultSubject, openInput, setActiveExamId]
  );

  const applyPointScoringPreset = useCallback(
    (rubric: RubricJSONV3): RubricJSONV3 => {
      if (rubric.strategyType !== 'point_accumulation') return rubric;
      const normalized = cloneRubric(rubric);
      const content = normalized.content as Record<string, unknown>;
      const currentStrategy =
        content.scoringStrategy && typeof content.scoringStrategy === 'object'
          ? (content.scoringStrategy as Record<string, unknown>)
          : {};
      const nextStrategy: Record<string, unknown> = {
        ...currentStrategy,
        type: pointScoringType,
      };

      if (pointScoringType === 'pick_n') {
        const parsedMaxPoints = Math.max(1, Math.round(parsePositiveNumber(pointScoringMaxPoints) || 1));
        const parsedPointValue = parsePositiveNumber(pointScoringPointValue);
        nextStrategy.maxPoints = parsedMaxPoints;
        if (parsedPointValue) {
          nextStrategy.pointValue = parsedPointValue;
        } else if (typeof currentStrategy.pointValue !== 'number') {
          const fallbackValue = parsePositiveNumber(totalScore) || 1;
          nextStrategy.pointValue = fallbackValue;
        }
      } else {
        delete nextStrategy.maxPoints;
        delete nextStrategy.pointValue;
      }

      content.scoringStrategy = nextStrategy;
      return normalized;
    },
    [pointScoringMaxPoints, pointScoringPointValue, pointScoringType, totalScore]
  );

  const handleUploadImage = useCallback(
    (target: 'question' | 'answer') => async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await fileToDataUrl(file);
        if (target === 'question') {
          setQuestionImage(dataUrl);
        } else {
          setAnswerImage(dataUrl);
        }
      } catch (error) {
        toast.error('图片读取失败，请重试');
      } finally {
        event.target.value = '';
      }
    },
    []
  );

  const handleGenerateRubric = useCallback(async () => {
    if (!examName.trim()) {
      toast.warning('请填写考试名称');
      return;
    }
    if (!questionNo.trim()) {
      toast.warning(taskScope === 'subquestion' ? '请填写大题号' : '请填写题号');
      return;
    }
    if (taskScope === 'subquestion' && !subQuestionNo.trim()) {
      toast.warning('请填写小问号');
      return;
    }
    if (taskScope === 'question' && segmentMode === 'multi' && !parsedSplitCount) {
      toast.warning('一键拆分多段时，请填写 2-20 的小问数');
      return;
    }
    if (invalidSpecialRuleCount > 0) {
      toast.warning('存在未填写完整的特殊规则，请先补全');
      return;
    }
    if (taskScope === 'question' && segmentMode === 'multi' && invalidRubricTableRowCount > 0) {
      toast.warning('评分表存在未填写完整的行，请补全题号/子题号/分值/评分点');
      return;
    }
    if (taskScope === 'question' && segmentMode === 'multi' && rubricTableRules.length === 0) {
      toast.warning('一键拆分多段时，请至少填写一行评分表');
      return;
    }
    if (!questionImage && !answerImage) {
      toast.warning('请至少上传一张图片');
      return;
    }

    const score = Number(totalScore);
    const parsedTotalScore = Number.isFinite(score) && score > 0 ? Math.round(score) : undefined;
    const parsedPickMaxPoints = Math.max(1, Math.round(parsePositiveNumber(pointScoringMaxPoints) || 1));
    const parsedPickPointValue = parsePositiveNumber(pointScoringPointValue);
    const pointScoringRules =
      strategyType === 'point_accumulation'
        ? [
            `按点给分场景必须使用 scoringStrategy.type = ${pointScoringType}`,
            pointScoringType === 'pick_n'
              ? `当 type=pick_n 时，maxPoints=${parsedPickMaxPoints}，pointValue=${
                  parsedPickPointValue || parsedTotalScore || 1
                }`
              : '',
          ].filter(Boolean)
        : [];
    const generationCustomRules =
      taskScope === 'question' && parsedSplitCount
        ? [
            ...customRules,
            ...rubricTableRules,
            ...pointScoringRules,
            `本题包含${parsedSplitCount}个小问，请先按评分表逐行拆分评分点并输出结构化表格供教师审核，再生成最终细则`,
          ]
        : [...customRules, ...rubricTableRules, ...pointScoringRules];

    setViewState('generating');
    setIsGenerating(true);
    setGenerationError(null);
    setGenerationStep(0);

    try {
      const rubric = await generateRubricFromImages(
        questionImage,
        answerImage,
        resolvedQuestionId || undefined,
        {
          subject,
          questionType,
          strategyType,
          examName: examName.trim(),
          totalScore: parsedTotalScore,
          customRules: generationCustomRules,
          taskScope,
          parentQuestionId: questionNo.trim(),
          subQuestionId: taskScope === 'subquestion' ? subQuestionNo.trim() || undefined : undefined,
        }
      );
      const scoredRubric = applyPointScoringPreset(rubric);
      const normalizedRubric = applySpecialRuleConstraints(scoredRubric, specialRules);
      applyRubricToEditor(normalizedRubric, null, { preserveSubQuestionCount: Boolean(parsedSplitCount) });
      if (taskScope === 'question' && parsedSplitCount && questionNo.trim()) {
        hydrateSplitDrafts(normalizedRubric, questionNo.trim(), parsedSplitCount);
      } else {
        setSplitRubricDrafts([]);
      }
      toast.success('评分细则生成成功');
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      setGenerationError(message);
      setViewState('input');
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  }, [
    answerImage,
    applyPointScoringPreset,
    applyRubricToEditor,
    examName,
    customRules,
    rubricTableRules,
    hydrateSplitDrafts,
    specialRules,
    pointScoringMaxPoints,
    pointScoringPointValue,
    pointScoringType,
    questionImage,
    questionNo,
    questionType,
    resolvedQuestionId,
    segmentMode,
    strategyType,
    subQuestionNo,
    parsedSplitCount,
    subject,
    taskScope,
    totalScore,
    invalidSpecialRuleCount,
    invalidRubricTableRowCount,
  ]);

  const handleSaveRubric = useCallback(async (rubricOverride?: RubricJSONV3) => {
    if (!rubricOverride && !draftRubricJson.trim()) {
      toast.warning('评分细则内容为空');
      return;
    }

    setIsSaving(true);
    try {
      const parsedRubric = rubricOverride
        ? coerceRubricToV3(rubricOverride).rubric
        : coerceRubricToV3(JSON.parse(draftRubricJson)).rubric;
      const normalized = applySpecialRuleConstraints(parsedRubric, specialRules);

      const resolvedId = resolvedQuestionId || normalized.metadata.questionId || questionNo.trim();
      if (!resolvedId) {
        throw new Error('缺少题号，无法保存');
      }
      const parsedCurrentSplitCount =
        taskScope === 'question' && segmentMode === 'multi' ? parseSubQuestionCount(subQuestionCount) : null;
      if (taskScope === 'question' && segmentMode === 'multi' && !parsedCurrentSplitCount) {
        throw new Error('一键拆分多段时，小问数需为 2-20 的整数');
      }

      normalized.metadata.questionId = resolvedId;
      normalized.metadata.subject = normalizeSubjectValue(subject);
      normalized.metadata.questionType = questionType;
      normalized.metadata.examName = examName.trim() || normalized.metadata.examName;
      normalized.metadata.examId = activeExamId || normalized.metadata.examId || null;

      const score = Number(totalScore);
      if (Number.isFinite(score) && score > 0) {
        (normalized.content as Record<string, unknown>).totalScore = Math.round(score);
      }

      const questionKey =
        selectedQuestionKey ||
        `manual:${activeExamId || 'noexam'}:${normalizeSubjectValue(subject)}:${resolvedId}`;

      setRubricConfig(questionKey, normalized);
      await saveRubric(JSON.stringify(normalized, null, 2), questionKey);

      if (taskScope === 'question' && parsedCurrentSplitCount && persistSplitSubRubrics) {
        const mainQuestionNo = questionNo.trim() || parseQuestionId(resolvedId).questionNo.trim();
        if (!mainQuestionNo) {
          throw new Error('缺少题号，无法拆分小问细则');
        }

        const splitRubricsToSave: RubricJSONV3[] =
          splitRubricDrafts.length === parsedCurrentSplitCount
            ? splitRubricDrafts.map((draft, index) => {
                try {
                  const parsedDraft = JSON.parse(draft.json);
                  const normalizedDraft = coerceRubricToV3(parsedDraft).rubric;
                  normalizedDraft.metadata.questionId = `${mainQuestionNo}-${index + 1}`;
                  normalizedDraft.metadata.subject = normalizeSubjectValue(subject);
                  normalizedDraft.metadata.questionType = questionType;
                  normalizedDraft.metadata.examName = examName.trim() || normalizedDraft.metadata.examName;
                  normalizedDraft.metadata.examId = activeExamId || normalizedDraft.metadata.examId || null;
                  return normalizedDraft;
                } catch (error) {
                  throw new Error(`小问 ${index + 1} JSON 格式错误，请先修正`);
                }
              })
            : buildSplitRubrics(normalized, mainQuestionNo, parsedCurrentSplitCount);

        for (let index = 0; index < splitRubricsToSave.length; index += 1) {
          const subRubric = splitRubricsToSave[index];
          const subId = `${mainQuestionNo}-${index + 1}`;
          subRubric.metadata.questionId = subId;
          const subQuestionKey = `manual:${activeExamId || 'noexam'}:${normalizeSubjectValue(subject)}:${subId}`;
          setRubricConfig(subQuestionKey, subRubric);
          await saveRubric(JSON.stringify(subRubric, null, 2), subQuestionKey);
        }

        setSplitRubricDrafts(
          splitRubricsToSave.map((item) => ({
            questionId: item.metadata.questionId,
            json: JSON.stringify(item, null, 2),
            itemCount: resolvePointCount(item),
          }))
        );
      }

      await loadConfiguredQuestions();
      const nextSelectedKey =
        taskScope === 'question' && parsedCurrentSplitCount && persistSplitSubRubrics && questionNo.trim()
          ? `manual:${activeExamId || 'noexam'}:${normalizeSubjectValue(subject)}:${questionNo.trim()}-1`
          : questionKey;
      selectQuestion(nextSelectedKey);
      setSelectedQuestionKey(nextSelectedKey);
      setGeneratedRubric(normalized);
      setDraftRubricJson(JSON.stringify(normalized, null, 2));
      if (taskScope === 'question' && parsedCurrentSplitCount && persistSplitSubRubrics) {
        toast.success(`评分细则已保存，并拆分为 ${parsedCurrentSplitCount} 个小问版本`);
      } else {
        toast.success('评分细则已保存');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [
    activeExamId,
    draftRubricJson,
    examName,
    loadConfiguredQuestions,
    questionNo,
    questionType,
    resolvedQuestionId,
    segmentMode,
    persistSplitSubRubrics,
    saveRubric,
    selectQuestion,
    selectedQuestionKey,
    splitRubricDrafts,
    subQuestionCount,
    taskScope,
    setRubricConfig,
    specialRules,
    subject,
    totalScore,
  ]);

  if (viewState === 'welcome') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        <button
          type="button"
          aria-label="智能创建评分细则"
          onClick={() => openInput('welcome')}
          className="group relative mt-2 overflow-hidden rounded-3xl border border-primary-400/20 bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-500 p-5 text-left text-white shadow-[0_20px_40px_-5px_rgba(0,111,238,0.34),0_0_24px_rgba(120,40,200,0.24)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 active:scale-[0.985]"
        >
          <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-white/20 blur-2xl transition-colors duration-300 group-hover:bg-white/30" />
          <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-secondary-300/30 blur-2xl" />
          <div className="relative z-10">
            <div className="mb-4 flex items-start justify-between gap-2">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/25 bg-white/20 backdrop-blur">
                <WandSparkles size={22} />
              </span>
              <span className="rounded-lg border border-white/25 bg-white/20 px-2 py-0.5 text-[10px] font-bold tracking-wide">
                AI 驱动
              </span>
            </div>
            <h3 className="text-xl font-bold tracking-tight">智能创建细则</h3>
            <p className="mt-2 max-w-[90%] text-xs font-medium leading-5 text-white/85">
              上传试题与答案，让 AI 自动分析并生成可编辑评分标准。
            </p>
            <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-2.5 text-sm font-bold text-primary-600 shadow-sm transition-colors group-hover:bg-default-50">
              立即开始
            </div>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-label="导入细则"
            onClick={() => importInputRef.current?.click()}
            className="group rounded-3xl border border-white/75 bg-white/65 p-3 text-left shadow-[0_14px_30px_-14px_rgba(0,111,238,0.32),0_0_18px_rgba(0,111,238,0.14)] backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1 active:scale-[0.985]"
          >
            <span className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-cyan-100 to-blue-100 text-cyan-600 transition-transform duration-200 group-hover:scale-110">
              <FileUp size={17} />
            </span>
            <p className="text-sm font-bold text-default-800">导入细则</p>
            <p className="mt-1 text-[11px] font-medium text-default-500">支持 JSON 文件继续编辑</p>
          </button>

          <button
            type="button"
            aria-label="进入模板库"
            onClick={() => setViewState('list')}
            className="group rounded-3xl border border-white/75 bg-white/65 p-3 text-left shadow-[0_14px_30px_-14px_rgba(120,40,200,0.32),0_0_18px_rgba(120,40,200,0.16)] backdrop-blur-xl transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1 active:scale-[0.985]"
          >
            <div className="mb-2 flex items-start justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-purple-100 to-pink-100 text-purple-600 transition-transform duration-200 group-hover:scale-110">
                <BookTemplate size={17} />
              </span>
              <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">
                {configuredRubricCountLabel}
              </span>
            </div>
            <p className="text-sm font-bold text-default-800">模板库</p>
            <p className="mt-1 text-[11px] font-medium text-default-500">常用标准合集</p>
          </button>
        </div>

        <Card
          shadow="none"
          className="rounded-3xl border border-white/70 bg-white/62 shadow-[0_12px_28px_-16px_rgba(0,111,238,0.2),0_0_16px_rgba(120,40,200,0.1)] backdrop-blur-xl"
        >
          <CardHeader className="flex items-center justify-between gap-2 py-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-default-400">最近细则</p>
            <Chip size="sm" variant="flat" color="primary">
              {configuredRubricCountLabel}
            </Chip>
          </CardHeader>
          <CardBody className="space-y-2 pt-0">
            {recentRubrics.length === 0 ? (
              <div className="rounded-large border border-default-200 bg-default-50 p-3 text-center">
                <p className="text-sm font-semibold text-default-500">暂无评分细则</p>
                <p className="mt-1 text-[11px] text-default-400">先创建或导入一个细则开始使用</p>
              </div>
            ) : (
              recentRubrics.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`打开细则 ${item.alias || item.id}`}
                  onClick={() => handleUseSavedRubric(item.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-large border border-default-200 bg-white px-3 py-2 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-1"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-default-700">{item.alias || item.id}</p>
                    <p className="mt-0.5 text-[11px] text-default-400">{item.id}</p>
                  </div>
                  <Chip size="sm" variant="flat" color="primary">
                    {item.questionNo || '-'}
                  </Chip>
                </button>
              ))
            )}
          </CardBody>
        </Card>

        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            void handleImportRubric(event);
          }}
        />
      </div>
    );
  }

  if (viewState === 'list') {
    return (
      <RubricListView
        onBack={() => setViewState('welcome')}
        onCreateNew={() => openInput('list')}
        onSelectRubric={handleUseSavedRubric}
        onUseTemplate={handleUseTemplate}
      />
    );
  }

  if (viewState === 'generating') {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <Card className="flex-1">
          <CardBody className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary-100 text-primary">
              <Sparkles size={24} />
            </div>
            <div>
              <p className="text-base font-semibold">正在生成评分细则</p>
              <p className="mt-1 text-sm text-default-500">{generationMessages[generationStep]}</p>
            </div>
            <div className="w-full max-w-xs">
              <Progress value={generationProgress} color="primary" size="sm" />
            </div>
            {isGenerating ? (
              <Chip color="primary" variant="flat">
                AI 处理中
              </Chip>
            ) : null}
          </CardBody>
        </Card>
      </div>
    );
  }

  if (viewState === 'result' && generatedRubric) {
    return (
      <RubricResultView
        rubric={generatedRubric}
        examName={examName || activeExamName || ''}
        subject={subject}
        questionNo={resolvedQuestionId || questionNo || generatedRubric.metadata.questionId || ''}
        onSave={(rubric) => {
          void handleSaveRubric(rubric);
        }}
        onRegenerate={() => openInput(inputBackTarget)}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-white/65 bg-white/56 backdrop-blur-xl">
      <header className="relative flex h-12 shrink-0 items-center justify-center border-b border-white/60 bg-white/74 px-3 backdrop-blur-xl">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          aria-label="返回"
          className="absolute left-2 h-8 min-h-8 w-8 min-w-8 rounded-full text-zinc-600"
          onPress={() => setViewState(inputBackTarget)}
        >
          <ArrowLeft size={16} />
        </Button>
        <h2 className="text-base font-bold tracking-tight text-zinc-800">生成评分细则</h2>
        <div className="absolute right-2">
          <Chip size="sm" color="warning" variant="flat">
            {quota.isPaid ? 'PRO' : '试用版'}
          </Chip>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-4">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-md shadow-primary/30">
              1
            </span>
            <h3 className="text-sm font-bold text-zinc-700">上传试题图片</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => questionImageInputRef.current?.click()}
              className="group h-28 rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/55 transition-colors hover:bg-primary-50"
            >
              {questionImage ? (
                <div className="flex h-full flex-col gap-1.5 p-1.5">
                  <Image src={questionImage} alt="question" className="h-[74px] w-full rounded-xl object-cover" />
                  <span className="text-[10px] font-bold text-primary-700">重新上传试题</span>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-primary-600">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm transition-transform group-hover:scale-110">
                    <ImagePlus size={16} />
                  </span>
                  <span className="text-[10px] font-bold">上传试题</span>
                </div>
              )}
            </button>

            <button
              type="button"
              onClick={() => answerImageInputRef.current?.click()}
              className="group h-28 rounded-2xl border-2 border-dashed border-zinc-200 bg-white/55 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              {answerImage ? (
                <div className="flex h-full flex-col gap-1.5 p-1.5">
                  <Image src={answerImage} alt="answer" className="h-[74px] w-full rounded-xl object-cover" />
                  <span className="text-[10px] font-semibold text-zinc-600">重新上传答案</span>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400 transition-colors group-hover:text-zinc-500">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm transition-transform group-hover:scale-110">
                    <FileUp size={16} />
                  </span>
                  <span className="text-[10px] font-semibold">上传答案</span>
                </div>
              )}
            </button>
          </div>

          <input
            ref={questionImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleUploadImage('question')(event);
            }}
          />
          <input
            ref={answerImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              void handleUploadImage('answer')(event);
            }}
          />
        </section>

        <section className="mt-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-white shadow-md shadow-secondary/30">
              2
            </span>
            <h3 className="text-sm font-bold text-zinc-700">设置基本信息</h3>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/62 p-3 backdrop-blur-xl">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className={microLabelClass}>考试名称</label>
                <div className="flex gap-2">
                  <input
                    value={examName}
                    onChange={(event) => handleExamNameChange(event.target.value)}
                    className={`${inputFilledClass} flex-1`}
                    placeholder="例如：2026 春季期中"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleCreateExam();
                    }}
                    disabled={isCreatingExam}
                    className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-200 disabled:opacity-60"
                  >
                    {isCreatingExam ? '创建中' : '+ 创建'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={microLabelClass}>批改范围</label>
                  <select
                    value={taskScope}
                    onChange={(event) => {
                      const selected = event.target.value as TaskScope;
                      setTaskScope(selected);
                      if (selected === 'subquestion') {
                        setSubQuestionCount('');
                        setSegmentMode('single');
                        setPersistSplitSubRubrics(true);
                      } else {
                        setSubQuestionNo('');
                      }
                    }}
                    className={`${inputFilledClass} appearance-none`}
                  >
                    <option value="question">整题</option>
                    <option value="subquestion">小问</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={microLabelClass}>{taskScope === 'subquestion' ? '大题号' : '题号'}</label>
                  <input
                    value={questionNo}
                    onChange={(event) => setQuestionNo(event.target.value)}
                    className={inputFilledClass}
                    placeholder={taskScope === 'subquestion' ? '例如：18' : '例如：3'}
                  />
                </div>
                {taskScope === 'subquestion' ? (
                  <div className="col-span-2 space-y-1.5">
                    <label className={microLabelClass}>小问号</label>
                    <input
                      value={subQuestionNo}
                      onChange={(event) => setSubQuestionNo(event.target.value)}
                      className={inputFilledClass}
                      placeholder="例如：2"
                    />
                  </div>
                ) : null}
                {taskScope === 'question' ? (
                  <div className="col-span-2 space-y-2">
                    <label className={microLabelClass}>段落模式</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSegmentMode('single');
                          setSubQuestionCount('');
                          setPersistSplitSubRubrics(true);
                        }}
                        className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                          segmentMode === 'single'
                            ? 'border-primary-300 bg-primary-50 text-primary-700'
                            : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                        }`}
                      >
                        默认单段
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSegmentMode('multi');
                          if (!subQuestionCount.trim()) setSubQuestionCount('2');
                        }}
                        className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                          segmentMode === 'multi'
                            ? 'border-primary-300 bg-primary-50 text-primary-700'
                            : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                        }`}
                      >
                        一键拆分多段
                      </button>
                    </div>
                    {segmentMode === 'multi' ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <input
                            value={subQuestionCount}
                            onChange={(event) => setSubQuestionCount(event.target.value)}
                            className={inputFilledClass}
                            placeholder="例如：3（将生成多段并可拆分保存为 题号-1~题号-3）"
                          />
                          <div className="flex items-center gap-1">
                            {['2', '3', '4'].map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setSubQuestionCount(value)}
                                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[10px] font-bold text-zinc-500 hover:border-primary-200 hover:text-primary-600"
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPersistSplitSubRubrics(false)}
                            className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${
                              !persistSplitSubRubrics
                                ? 'border-primary-300 bg-primary-50 text-primary-700'
                                : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                            }`}
                          >
                            仅生成多段
                          </button>
                          <button
                            type="button"
                            onClick={() => setPersistSplitSubRubrics(true)}
                            className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition ${
                              persistSplitSubRubrics
                                ? 'border-primary-300 bg-primary-50 text-primary-700'
                                : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300'
                            }`}
                          >
                            同时拆分保存子题
                          </button>
                        </div>
                        {parsedSplitCount ? (
                          <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-bold text-primary-700">多段拆分设置已启用</p>
                              <p className="text-[10px] text-primary-600">共 {parsedSplitCount} 个小问</p>
                            </div>
                            <p className="mt-1.5 text-[10px] text-primary-600">
                              请在第 3 步填写评分表（题号、子题号、分值、评分点、评分策略），系统会自动推断并供教师审核。
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={microLabelClass}>学科</label>
                  <select
                    value={subject}
                    onChange={(event) => {
                      const normalized = normalizeSubjectValue(event.target.value);
                      const types = filterQuestionTypes(getQuestionTypeOptions(normalized));
                      setSubject(normalized);
                      setManualStrategyOverride(false);
                      if (types.length > 0) {
                        setQuestionType(types[0].value);
                      }
                    }}
                    className={`${inputFilledClass} appearance-none`}
                  >
                    {subjectOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={microLabelClass}>题型</label>
                  <select
                    value={questionType}
                    onChange={(event) => {
                      const selected = event.target.value;
                      setQuestionType(selected);
                      setManualStrategyOverride(false);
                    }}
                    className={`${inputFilledClass} appearance-none`}
                  >
                    {questionTypeOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={microLabelClass}>总分</label>
                  <input
                    value={totalScore}
                    onChange={(event) => setTotalScore(event.target.value)}
                    className={inputFilledClass}
                    placeholder="例如：10"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={microLabelClass}>评分策略</label>
                  <select
                    value={strategyType}
                    onChange={(event) => {
                      setStrategyType(event.target.value as StrategyType);
                      setManualStrategyOverride(true);
                    }}
                    className={`${inputFilledClass} appearance-none`}
                  >
                    {RUBRIC_STRATEGY_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-primary-100 bg-primary-50/45 p-3">
                <p className="text-[11px] font-semibold text-primary-700">
                  自动推荐：{recommendedStrategyLabel}
                </p>
                <p className="mt-1 text-[10px] text-primary-600">{strategyReasonText}</p>
                {(strategyRecommendation.strategyType !== strategyType || manualStrategyOverride) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setManualStrategyOverride(false);
                      setStrategyType(strategyRecommendation.strategyType);
                    }}
                    className="mt-2 rounded-lg border border-primary-200 bg-white px-2 py-1 text-[10px] font-bold text-primary-700 hover:bg-primary-50"
                  >
                    应用自动推荐
                  </button>
                ) : null}
              </div>

              {strategyType === 'point_accumulation' ? (
                <div className="rounded-xl border border-primary-100 bg-primary-50/45 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className={microLabelClass}>按点计分模式</label>
                      <select
                        value={pointScoringType}
                        onChange={(event) => setPointScoringType(normalizeScoringStrategyType(event.target.value))}
                        className={`${inputFilledClass} appearance-none`}
                      >
                        {POINT_SCORING_MODE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {pointScoringType === 'pick_n' ? (
                      <div className="space-y-1.5">
                        <label className={microLabelClass}>命中点数 N</label>
                        <input
                          value={pointScoringMaxPoints}
                          onChange={(event) => setPointScoringMaxPoints(event.target.value)}
                          className={inputFilledClass}
                          placeholder="例如：1"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className={microLabelClass}>模式说明</label>
                        <input readOnly value={pointScoringHint} className={`${inputFilledClass} text-zinc-500`} />
                      </div>
                    )}
                  </div>

                  {pointScoringType === 'pick_n' ? (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className={microLabelClass}>每个命中分值</label>
                        <input
                          value={pointScoringPointValue}
                          onChange={(event) => setPointScoringPointValue(event.target.value)}
                          className={inputFilledClass}
                          placeholder="例如：2"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={microLabelClass}>摘要预览</label>
                        <input
                          readOnly
                          value={`任答 ${pointScoringMaxPoints || '1'} 点得 ${pointScoringPointValue || totalScore || '-'} 分`}
                          className={`${inputFilledClass} text-zinc-500`}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {taskScope === 'question' && segmentMode === 'multi' ? (
          <section className="mt-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white shadow-md shadow-primary/30">
                3
              </span>
              <h3 className="text-sm font-bold text-zinc-700">评分点拆分表（教师审核）</h3>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/55 p-3 backdrop-blur-xl">
              {!parsedSplitCount ? (
                <p className="text-[11px] font-semibold text-zinc-500">请先填写 2-20 的小问数，再配置评分点拆分表。</p>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-2.5">
                    <p className="text-[11px] font-semibold text-primary-700">
                      输入字段：题号、子题号、分值、评分点、评分策略
                    </p>
                    <p className="mt-1 text-[10px] text-primary-600">
                      系统会对 pick_n 自动推断 maxPoints/pointValue，生成时一并提交给 AI，输出结构化内容供教师审核修改。
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={autofillRubricRowsBySplitCount}
                      className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-[10px] font-semibold text-primary-700 hover:bg-primary-100"
                    >
                      按小问自动填充 {parsedSplitCount} 行
                    </button>
                    <button
                      type="button"
                      onClick={addRubricTableRow}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-600 hover:border-primary-200 hover:text-primary-700"
                    >
                      + 新增一行
                    </button>
                  </div>

                  <div className="space-y-2">
                    {rubricTableRows.map((row, index) => (
                      <div key={row.id} className="rounded-xl border border-zinc-200 bg-white/85 p-2.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold text-zinc-700">第 {index + 1} 行</p>
                          <button
                            type="button"
                            onClick={() => removeRubricTableRow(row.id)}
                            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-500 hover:border-danger-200 hover:text-danger-500"
                          >
                            删除
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className={microLabelClass}>题号</label>
                            <input
                              value={row.questionNo}
                              onChange={(event) => updateRubricTableRow(row.id, { questionNo: event.target.value })}
                              className={inputFilledClass}
                              placeholder={questionNo.trim() ? questionNo.trim() : '例如：13'}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className={microLabelClass}>子题号</label>
                            <input
                              value={row.subQuestionNo}
                              onChange={(event) => updateRubricTableRow(row.id, { subQuestionNo: event.target.value })}
                              className={inputFilledClass}
                              placeholder="例如：2"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className={microLabelClass}>分值</label>
                            <input
                              value={row.score}
                              onChange={(event) => updateRubricTableRow(row.id, { score: event.target.value })}
                              className={inputFilledClass}
                              placeholder="例如：2"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className={microLabelClass}>评分策略</label>
                            <select
                              value={row.strategy}
                              onChange={(event) => {
                                updateRubricTableRow(row.id, { strategy: normalizeScoringStrategyType(event.target.value) });
                              }}
                              className={`${inputFilledClass} appearance-none`}
                            >
                              {POINT_SCORING_MODE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="mt-2 space-y-1">
                          <label className={microLabelClass}>评分点</label>
                          <input
                            value={row.point}
                            onChange={(event) => updateRubricTableRow(row.id, { point: event.target.value })}
                            className={inputFilledClass}
                            placeholder="例如：答出任意两点即可得满分"
                          />
                        </div>

                        {row.strategy === 'pick_n' ? (
                          <div className="mt-2 rounded-lg border border-primary-100 bg-primary-50/50 p-2">
                            <p className="text-[10px] font-semibold text-primary-700">
                              自动推断：
                              {row.inferredMaxPoints && row.inferredPointValue
                                ? ` maxPoints=${formatNumericValue(row.inferredMaxPoints)}，pointValue=${formatNumericValue(row.inferredPointValue)}`
                                : ' 待推断（建议在评分点中写明“任答N点”）'}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {invalidRubricTableRowCount > 0 ? (
                    <p className="text-[10px] font-semibold text-danger-500">
                      仍有 {invalidRubricTableRowCount} 行未填写完整，生成前需要补全。
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className="mt-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-white shadow-md">
              {taskScope === 'question' && segmentMode === 'multi' ? '4' : '3'}
            </span>
            <h3 className="text-sm font-bold text-zinc-700">添加特殊规则</h3>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/55 p-3 backdrop-blur-xl">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {SPECIAL_RULE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => addSpecialRule(option.value)}
                    className="rounded-lg border border-primary-200 bg-primary-50 px-2 py-1 text-[10px] font-semibold text-primary-700 hover:bg-primary-100"
                  >
                    + {option.label}
                  </button>
                ))}
              </div>

              {specialRules.map((rule, index) => {
                const currentType = SPECIAL_RULE_TYPE_OPTIONS.find((item) => item.value === rule.type);
                const preview = buildSpecialRuleText(rule) || '';
                return (
                  <div key={rule.id} className="rounded-xl border border-zinc-200 bg-white/80 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={rule.type}
                        onChange={(event) => {
                          const nextType = event.target.value as SpecialRuleType;
                          const draft = createSpecialRuleDraft(nextType);
                          updateSpecialRule(rule.id, { ...draft, id: rule.id });
                        }}
                        className={`${inputFilledClass} h-8 flex-1 py-1`}
                      >
                        {SPECIAL_RULE_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeSpecialRule(rule.id)}
                        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-[10px] font-semibold text-zinc-500 hover:border-danger-200 hover:text-danger-500"
                      >
                        删除
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500">
                      规则 {index + 1} · {currentType?.hint || ''}
                    </p>

                    {rule.type === 'deduction_fixed' ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input
                          value={rule.description}
                          onChange={(event) => updateSpecialRule(rule.id, { description: event.target.value })}
                          className={inputFilledClass}
                          placeholder="触发条件，例如：未提及郑和下西洋"
                        />
                        <input
                          value={rule.points}
                          onChange={(event) => updateSpecialRule(rule.id, { points: event.target.value })}
                          className={inputFilledClass}
                          placeholder="扣分，例如：1"
                        />
                      </div>
                    ) : null}

                    {rule.type === 'deduction_per_count' ? (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <input
                          value={rule.description}
                          onChange={(event) => updateSpecialRule(rule.id, { description: event.target.value })}
                          className={inputFilledClass}
                          placeholder="计数项，例如：错别字"
                        />
                        <input
                          value={rule.perCount}
                          onChange={(event) => updateSpecialRule(rule.id, { perCount: event.target.value })}
                          className={inputFilledClass}
                          placeholder="每 N 个"
                        />
                        <input
                          value={rule.points}
                          onChange={(event) => updateSpecialRule(rule.id, { points: event.target.value })}
                          className={inputFilledClass}
                          placeholder="扣分"
                        />
                      </div>
                    ) : null}

                    {rule.type === 'score_cap' ? (
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <input
                          value={rule.threshold}
                          onChange={(event) => updateSpecialRule(rule.id, { threshold: event.target.value })}
                          className={inputFilledClass}
                          placeholder="字数阈值"
                        />
                        <input
                          value={rule.maxScore}
                          onChange={(event) => updateSpecialRule(rule.id, { maxScore: event.target.value })}
                          className={inputFilledClass}
                          placeholder="封顶分值"
                        />
                        <input
                          value={rule.description}
                          onChange={(event) => updateSpecialRule(rule.id, { description: event.target.value })}
                          className={inputFilledClass}
                          placeholder="补充说明（选填）"
                        />
                      </div>
                    ) : null}

                    {rule.type === 'logic_check' ? (
                      <div className="mt-2">
                        <input
                          value={rule.description}
                          onChange={(event) => updateSpecialRule(rule.id, { description: event.target.value })}
                          className={inputFilledClass}
                          placeholder="逻辑校验，例如：历史价值与举措不得交叉记分"
                        />
                      </div>
                    ) : null}

                    <div className="mt-2 space-y-1">
                      <label className={microLabelClass}>规则预览</label>
                      <input
                        readOnly
                        value={preview}
                        className={`${inputFilledClass} cursor-default text-zinc-500`}
                        placeholder="填写完成后生成标准规则文本"
                      />
                    </div>
                  </div>
                );
              })}

              <p className="text-[10px] font-medium text-zinc-500">
                已生效规则 {customRules.length} 条（支持：固定扣分 / 计次扣分 / 分数封顶 / 逻辑校验）
              </p>
              {invalidSpecialRuleCount > 0 ? (
                <p className="text-[10px] font-semibold text-danger-500">
                  仍有 {invalidSpecialRuleCount} 条规则未填写完整，生成前需要补全
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {generationError ? (
          <div className="mt-3 rounded-xl border border-danger-200 bg-danger-50 p-3 text-xs text-danger-600">
            {generationError}
          </div>
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-white/60 bg-white/80 p-3 backdrop-blur-xl">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={resetInputState}
            className="flex-1 rounded-2xl bg-zinc-100 py-3 text-sm font-bold text-zinc-500 transition-colors hover:bg-zinc-200"
          >
            清空
          </button>
          <button
            type="button"
            onClick={() => void handleGenerateRubric()}
            className="flex-[2] rounded-2xl bg-gradient-to-r from-primary-500 to-primary-600 py-3 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:scale-[1.01] hover:shadow-primary/40 active:scale-95"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Sparkles size={15} />
              生成细则
            </span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default RubricPanelHero;
