

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
export type ScoringStrategyType = 'pick_n' | 'all' | 'weighted';

/**
 * 单个得分点
 */
export interface AnswerPoint {
  id: string;              // 得分点编号，如 "1-1", "2-1"
  content: string;         // 标准答案内容
  keywords: string[];      // 关键词列表（用于模糊匹配）
  score: number;           // 该点分值
  isNegative?: boolean;    // 是否为扣分项
}

/**
 * 评分策略配置
 */
export interface ScoringStrategy {
  type: ScoringStrategyType;
  maxPoints?: number;       // pick_n 策略：最多计算几个得分点
  pointValue?: number;      // 每个得分点的分值
  allowAlternative: boolean; // 是否接受等效答案
  strictMode?: boolean;     // 严格模式：填空题必须精确匹配
  openEnded?: boolean;      // 开放题模式：言之有理即得满分
}

/**
 * 评分细则 JSON 结构
 */
export interface RubricJSON {
  version: '1.0';           // Schema 版本
  questionId: string;       // 题号
  title: string;            // 题目类型
  totalScore: number;       // 总分
  scoringStrategy: ScoringStrategy;
  answerPoints: AnswerPoint[];
  gradingNotes: string[];   // 阅卷提示
  alternativeRules?: string; // 等效答案说明
  strictMode?: boolean;      // [新增] 严格模式：填空题需完全匹配
}

/**
 * 评分细则生成结果（包含 JSON 和 Markdown 两种格式）
 */
export interface RubricResult {
  rubric: string;           // Markdown 格式（用于展示）
  rubricJSON?: RubricJSON;  // JSON 格式（用于评分逻辑）
  version?: string;
}