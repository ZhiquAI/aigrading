

export enum Tab {
  Rubric = 'rubric',    // 细则配置（阅卷前）
  Grading = 'grading',  // 阅卷（阅卷中）
  History = 'history',  // 批改记录（阅卷后）
  Settings = 'settings' // 设置（移至 Header）
}

export enum GradingMode {
  Manual = 'manual', // 手动模式：自动打分填充，手动提交
  Auto = 'auto'      // 自动模式：全程自动
}

export enum ModelProvider {
  OpenAI = 'openai',
  Google = 'google',
  Zhipu = 'zhipu',
  Alibaba = 'alibaba'
}

export type ModelProviderType = 'openai' | 'google' | 'zhipu' | 'alibaba';

export interface AppConfig {
  provider: ModelProviderType;
  endpoint: string;
  modelName: string;
  apiKey: string;
  currentSubject?: string;  // 当前学科
}

// 题型类型
export type QuestionType = 'fillBlank' | 'shortAnswer' | 'openEnded';

// 单个题型的规则
export interface QuestionRule {
  enabled: boolean;
  rule: string;
}

// 学科规则配置
export interface SubjectRules {
  subject: string;
  rules: Record<QuestionType, QuestionRule>;
}

export interface StudentResult {
  id: string;
  name: string;
  className?: string;
  studentNo?: string;
  examNo?: string; // 准考证号（从智学网 API 拦截获取）
  score: number;
  maxScore: number;
  comment: string;
  confidence?: number;
  needsReview?: boolean;
  breakdown: {
    label: string;
    score: number;
    max: number;
    comment?: string;
    isNegative?: boolean;
    relevantArea?: number[]; // [ymin, xmin, ymax, xmax] (0-1)
  }[];
}

// 从页面抓取的数据上下文
export interface PageContext {
  platform: string;
  markingPaperId?: string | null;
  questionNo?: string | null;
  questionKey?: string | null; // platform:markingPaperId:questionNo
  studentName: string;
  examNo?: string; // 准考证号（从智学网 API 拦截获取，字段名 userCode）
  answerImageBase64: string; // 纯答题卡图片（合并后）
  answerChunksBase64?: string[]; // 每个小题的单独图片
  timestamp?: number;
}


export interface GradingStats {
  avgScore: number;
  passRate: number; // Percentage 0-100
  difficulty: number; // 0-1
  distribution: number[]; // Array of counts for score ranges
}

// ==================== 评分细则 JSON 结构 ====================

/**
 * 评分策略类型
 * - pick_n: 任选N点得分（如"答对任意3点得满分"）
 * - all: 全部答对才得分
 * - weighted: 加权计分
 */
export type ScoringStrategyType = ScoringStrategyTypeV3;

/**
 * 单个得分点
 */
export type AnswerPoint = RubricPointV3;

/**
 * 评分策略配置
 */
export type ScoringStrategy = ScoringStrategyV3;

/**
 * 评分细则 JSON 结构
 */
export type RubricJSON = RubricJSONV3;

/**
 * 评分细则生成结果（包含 JSON 和 Markdown 两种格式）
 */
export interface RubricResult {
  rubric: string;           // Markdown 格式（用于展示）
  rubricJSON?: RubricJSONV3;  // JSON 格式（用于评分逻辑）
  version?: string;
}
import type {
  RubricJSONV3,
  RubricPoint as RubricPointV3,
  ScoringStrategy as ScoringStrategyV3,
  ScoringStrategyType as ScoringStrategyTypeV3
} from './types/rubric-v3';
