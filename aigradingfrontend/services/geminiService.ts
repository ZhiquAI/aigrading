import { GoogleGenerativeAI } from "@google/generative-ai";
import { StudentResult, AppConfig, ModelProviderType } from "../types";
import { encrypt, decrypt, isEncrypted } from "../utils/crypto";

/**
 * 清理 AI 返回的 JSON 字符串，移除 markdown 代码块标记
 */
function cleanJsonResponse(text: string): string {
  // 移除 ```json ... ``` 或 ``` ... ``` 标记
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    // 移除开头的 ```json 或 ```
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
    // 移除结尾的 ```
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

// Default Configuration
const DEFAULT_CONFIG: AppConfig = {
  provider: 'google',
  endpoint: '', // Google SDK handles this internally usually
  modelName: 'gemini-2.0-flash-exp',
  apiKey: ''
};

// Storage Keys
const STORAGE_KEY_CONFIG = 'app_model_config';

/**
 * Load configuration from localStorage or environment
 */
export const getAppConfig = (): AppConfig => {
  const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
  if (saved) {
    try {
      const config = JSON.parse(saved);
      // 解密 API Key（如果是加密的）
      if (config.apiKey && isEncrypted(config.apiKey)) {
        config.apiKey = decrypt(config.apiKey);
      }
      return config;
    } catch (e) {
      console.error('[getAppConfig] Failed to parse config:', e);
    }
  }
  // Default fallback
  return {
    ...DEFAULT_CONFIG,
    // 开发模式下使用环境变量（生产环境 process.env.API_KEY 为空）
    apiKey: process.env.API_KEY || ''
  };
};

/**
 * Save configuration
 * API Key 会自动加密存储
 */
export const saveAppConfig = (config: AppConfig): void => {
  const configToSave = { ...config };
  // 加密 API Key
  if (configToSave.apiKey && !isEncrypted(configToSave.apiKey)) {
    configToSave.apiKey = encrypt(configToSave.apiKey);
  }
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(configToSave));
};

/**
 * Helper to get Google Client (Legacy/Env support)
 */
const getGoogleClient = (apiKeyOverride?: string) => {
  const apiKey = apiKeyOverride || process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
};

// 检查 API Key 是否配置 (Support both Env and Custom Config)
export const checkApiKeyConfigured = (): boolean => {
  const config = getAppConfig();
  if (config.provider === 'google') {
    return !!(config.apiKey || process.env.API_KEY);
  }
  return !!config.apiKey;
};

// 策略类型定义
export type GradingStrategy = 'flash' | 'pro' | 'reasoning';

/**
 * 策略与模型绑定配置
 * 
 * 阅卷策略与模型说明：
 * - flash (快速模式): gemini-2.0-flash-exp，无思考，最快响应
 * - pro (精准模式): gemini-2.0-flash-exp + 思考预算，平衡速度与准确度
 * - reasoning (深度推理): gemini-3-pro-preview + 深度思考，适合复杂题目
 */
const STRATEGY_CONFIG: Record<GradingStrategy, {
  model: string;
  thinkingBudget?: number;
  description: string
}> = {
  flash: {
    model: 'gemini-2.5-flash',
    thinkingBudget: undefined,  // 无思考过程
    description: '快速模式 - 适合简单填空、选择题'
  },
  pro: {
    model: 'gemini-3-flash-preview',
    thinkingBudget: undefined,  // 使用原生 Pro 模型能力
    description: '精准模式 - 适合常规简答题'
  },
  reasoning: {
    model: 'gemini-3-pro-preview',
    thinkingBudget: 16384,  // 深度思考
    description: '深度模式 - 适合复杂论述、开放题'
  }
};

/**
 * Get Model Name based on strategy
 * 根据策略返回对应的模型名称
 * 所有 provider 都使用策略配置的模型
 */
const getModelName = (strategy: GradingStrategy = 'pro', _config: AppConfig) => {
  // 始终使用策略配置的模型
  return STRATEGY_CONFIG[strategy]?.model || 'gemini-2.5-flash';
};

/**
 * 获取策略对应的 Thinking Budget
 */
const getThinkingBudget = (strategy: GradingStrategy): number | undefined => {
  return STRATEGY_CONFIG[strategy]?.thinkingBudget;
};

/**
 * Test Connection
 */
export const testConnection = async (config: AppConfig): Promise<boolean> => {
  try {
    console.log('[testConnection] Testing with config:', {
      provider: config.provider,
      model: config.modelName,
      hasApiKey: !!config.apiKey
    });

    if (config.provider === 'google') {
      const ai = getGoogleClient(config.apiKey);
      if (!ai) {
        console.error('[testConnection] Failed to create Google client - API key missing');
        return false;
      }

      console.log('[testConnection] Sending test request to model:', config.modelName);
      const model = ai.getGenerativeModel({ model: config.modelName });
      await model.generateContent('ping');
      console.log('[testConnection] Google connection successful');
      return true;
    } else {
      // OpenAI / Zhipu Compatible
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      const body = {
        model: config.modelName,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5
      };

      console.log('[testConnection] Sending request to:', config.endpoint);
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[testConnection] Request failed:', response.status, errorText);
        return false;
      }

      console.log('[testConnection] Connection successful');
      return true;
    }
  } catch (e) {
    console.error('[testConnection] Unexpected error:', e);
    return false;
  }
};

/**
 * OpenAI Compatible Call Helper
 */
const callOpenAICompatible = async (
  config: AppConfig,
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string,
  jsonMode: boolean = true,
  modelOverride?: string  // 策略模型覆盖
): Promise<string> => {

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: "text", text: userPrompt },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`
          }
        }
      ]
    }
  ];

  // 使用策略模型或配置模型
  const actualModel = modelOverride || config.modelName;

  const body: Record<string, unknown> = {
    model: actualModel,
    messages: messages,
    temperature: 0.3
  };

  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");

    throw new Error(`Provider Error: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();

  let data: Record<string, unknown> | null = null;
  try {
    data = JSON.parse(text);
  } catch (e: unknown) {

    throw e;
  }
  return data.choices?.[0]?.message?.content || "";
};


/**
 * 1. Generate Rubric - 从 rubric-service 重新导出（支持后端代理模式）
 */
export { generateRubricFromImages } from './rubric-service';

// 保留下面的 autoGenerateRubric 函数
// 原 generateRubricFromImages 函数已移至 rubric-service.ts
// 以下注释掉的代码保留作为参考

/* 已移至 rubric-service.ts
export const _oldGenerateRubricFromImages = async (
  questionImageBase64?: string | null,
  answerImageBase64?: string | null
): Promise<string> => {
  // 至少需要一张图片
  if (!questionImageBase64 && !answerImageBase64) {
    throw new Error("请至少上传试题图片或参考答案图片");
  }

  const config = getAppConfig();

  // 根据上传的图片类型构建提示词
  const hasQuestion = !!questionImageBase64;
  const hasAnswer = !!answerImageBase64;

  let promptText = '';
  if (hasQuestion && hasAnswer) {
    promptText = `
你是一位资深的教育专家，擅长设计精确的评分细则。
请根据【试题图片】和【标准答案/评分要点图片】，制定一份详细的评分细则。

【输出格式要求】
1. 先输出一行总分说明，如：## 第X题评分细则（共X分）
2. 使用 Markdown 表格，包含以下列：

| 小题号 | 得分点 | 分值 | 满分条件 | 关键词 | 扣分规则 |

【小题号格式说明】
- 同一大题下有多个空时，使用 "1-1", "1-2", "1-3" 格式
- 单独的小题直接用数字，如 "2", "3"
- 例如：第1题有4个空 → 1-1, 1-2, 1-3, 1-4

【评分原则】
1. **填空题**：必须精确匹配标准答案，关键词直接写答案内容，扣分规则写"答错不得分"
2. **简答题**：关键词用逗号分隔多个要点，如果原答案有"其他答案合理即可"，在扣分规则中保留
3. **选择题**：方案选择和理由分开计分

【示例】
| 小题号 | 得分点 | 分值 | 满分条件 | 关键词 | 扣分规则 |
|--------|--------|------|----------|--------|----------|
| 1-1 | 第一空 | 1分 | 填"平行" | 平行 | 答错不得分 |
| 2 | 气候特征 | 2分 | 答出任意2点 | 大气稀薄,气温较低,没有液态水 | 每点1分，其他答案合理即可 |

请直接输出 Markdown 格式，不要包含代码块标记。
    `;
  } else if (hasQuestion) {
    promptText = `
你是一位资深的教育专家。
请仔细分析附图中的【试题】，并根据题目要求制定一份详细的评分细则。

【输出格式要求】
1. 先输出总分说明，如：## 第X题评分细则（共X分）
2. 使用 Markdown 表格：

| 小题号 | 得分点 | 分值 | 满分条件 | 关键词 | 扣分规则 |

【小题号格式】
- 多个空用 "1-1", "1-2" 格式
- 例如：第1题4个空 → 1-1, 1-2, 1-3, 1-4

【评分原则】
1. 分析题目类型（填空/选择/简答/计算等）
2. 根据题目分值合理分配各得分点
3. 填空题扣分规则写"答错不得分"

请直接输出 Markdown 格式，不要包含代码块标记。
    `;
  } else {
    promptText = `
你是一位资深的教育专家。
请仔细分析附图中的【标准答案/评分要点】，并据此制定一份详细的评分细则。

【输出格式要求】
1. 先输出总分说明（从答案中提取），如：## 第X题评分细则（共X分）
2. 使用 Markdown 表格：

| 小题号 | 得分点 | 分值 | 满分条件 | 关键词 | 扣分规则 |

【小题号格式说明】
- 同一大题下有多个空时，使用 "1-1", "1-2", "1-3" 格式
- 单独的小题直接用数字，如 "2", "3"

【评分原则】
1. 严格按照参考答案中的分值分配（如"每空1分"、"第3题3分"等）
2. **填空题**：关键词直接写答案，扣分规则写"答错不得分"
3. **简答题**：关键词用逗号分隔，保留"其他答案合理即可"说明
4. **多选/多答题**：注明"任答X点"

【示例】
| 小题号 | 得分点 | 分值 | 满分条件 | 关键词 | 扣分规则 |
|--------|--------|------|----------|--------|----------|
| 1-1 | 第一空 | 1分 | 填"开封府" | 开封府 | 答错不得分 |
| 3-1 | 方案选择 | 1分 | 选择方案一 | 一 | 答错不得分 |
| 3-2 | 选择理由 | 2分 | 答出合理理由 | 不用转车,用时少 | 其他答案合理即可 |

请直接输出 Markdown 格式，不要包含代码块标记。
    `;
  }

  try {
    if (config.provider === 'google') {
      const ai = getGoogleClient(config.apiKey);
      if (!ai) throw new Error("未配置 Google API Key");

      // 构建图片部分
      const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
      if (questionImageBase64) {
        imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: questionImageBase64 } });
      }
      if (answerImageBase64) {
        imageParts.push({ inlineData: { mimeType: 'image/jpeg', data: answerImageBase64 } });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            { text: promptText },
            ...imageParts
          ]
        },
        config: {
          thinkingConfig: { thinkingBudget: 4096 }
        }
      });
      return response.text || "生成评分标准失败。";

    } else {
      // OpenAI / 智谱 兼容 API
      type ImageContent = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
      const imageContent: ImageContent[] = [{ type: "text", text: promptText }];

      if (questionImageBase64) {
        imageContent.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${questionImageBase64}` }
        });
      }
      if (answerImageBase64) {
        imageContent.push({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${answerImageBase64}` }
        });
      }

      const messages = [{ role: 'user', content: imageContent }];

      const body: Record<string, unknown> = {
        model: config.modelName,
        messages: messages
      };

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "生成失败";
    }
  } catch (error) {
    console.error("Rubric Gen Error:", error);
    throw error;
  }
};
已移至 rubric-service.ts */

/**
 * 1.5 Auto Generate Rubric - 从答题卡图片自动生成评分细则
 * @param answerSheetImageBase64 答题卡/试卷图片 Base64
 * @returns 自动生成的评分细则文本
 */
export const autoGenerateRubric = async (
  answerSheetImageBase64: string
): Promise<string> => {
  if (!answerSheetImageBase64) {
    throw new Error("需要提供答题卡图片");
  }

  const config = getAppConfig();

  const promptText = `
你是一位资深的阅卷专家。请仔细分析附图中的试题内容，并生成一份评分细则。

要求：
1. 识别出题目内容和分值
2. 制定详细的评分标准，包括得分点、满分条件、关键词
3. **输出格式**：请直接输出一个 Markdown 表格，包含以下列：
   - 得分点（加粗，如 **计算过程**）
   - 分值（整数，如 2分）
   - 满分条件
   - 关键词（顿号分隔）
   - 扣分规则

示例格式：
| 得分点 | 分值 | 满分条件 | 关键词 | 扣分规则 |
| :--- | :--- | :--- | :--- | :--- |
| **内容** | 5分 | ... | ... | ... |

4. 语言：中文
5. 如果无法识别题目内容，请说明原因

请直接输出表格，不要包含解释。
`;

  try {
    if (config.provider === 'google') {
      const ai = getGoogleClient(config.apiKey);
      if (!ai) throw new Error("未配置 Google API Key");

      const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const response = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: promptText },
            { inlineData: { mimeType: 'image/jpeg', data: answerSheetImageBase64 } }
          ]
        }]
      });
      return response.response.text() || "生成评分标准失败。";

    } else {
      // OpenAI / 智谱 兼容 API
      const imageContent = [
        { type: "text", text: promptText },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${answerSheetImageBase64}` } }
      ];

      const messages = [{ role: 'user', content: imageContent }];

      const body = {
        model: config.modelName,
        messages: messages
      };

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "生成失败";
    }
  } catch (error) {
    console.error("Auto Rubric Gen Error:", error);
    throw error;
  }
};

/**
 * 2. Assess Student Answer
 * 混合模式: 后端验证额度 + 前端直连 AI (保持速度)
 */
export const assessStudentAnswer = async (
  studentImageBase64: string,
  rubricText: string,
  strategy: GradingStrategy = 'pro'
): Promise<StudentResult> => {
  const { isProxyMode, gradeWithProxy } = await import('./proxyService');

  // 检查是否使用代理模式 (旧方案兼容)
  if (isProxyMode()) {
    console.log(`[assessStudentAnswer] Using backend proxy, strategy: ${strategy}`);
    try {
      return await gradeWithProxy(studentImageBase64, rubricText, undefined, undefined, strategy);
    } catch (error) {
      console.error('[assessStudentAnswer] Backend proxy failed:', error);
      throw new Error(`批改失败:${error instanceof Error ? error.message : '后端服务不可用,请检查服务状态'}`);
    }
  }

  // ========== 新方案: CloudBase 额度验证 ==========
  // 1️⃣ 快速验证额度 (CloudBase, <100ms)
  try {
    const { checkQuota, consumeQuota } = await import('./cloudbaseService');
    const { getDeviceId } = await import('../utils/device');
    const deviceId = getDeviceId();

    // 验证额度
    const quotaResult = await checkQuota(deviceId);

    if (!quotaResult.canUse) {
      // 额度不足，抛出特定错误码以便前端识别
      const error = new Error(quotaResult.message || '额度不足，请激活充值') as any;
      error.code = 'QUOTA_INSUFFICIENT';
      throw error;
    }

    console.log(`[assessStudentAnswer] Quota check passed, remaining: ${quotaResult.remaining}`);
  } catch (error) {
    // 如果是额度验证失败，直接抛出
    if (error instanceof Error && (error.message.includes('额度') || (error as any).code === 'QUOTA_INSUFFICIENT')) {
      throw error;
    }
    // 其他错误（如网络问题）降级处理，继续执行
    console.warn('[assessStudentAnswer] Quota check failed, continuing:', error);
  }

  // 2️⃣ 前端直连 AI (保持速度 10-15s)
  console.log(`[assessStudentAnswer] Using frontend direct mode, strategy: ${strategy}`);
  const config = getAppConfig();

  if (!config.apiKey) {
    throw new Error('请先在设置中配置 API Key');
  }

  const modelName = getModelName(strategy, config);
  const thinkingBudget = getThinkingBudget(strategy);

  // 检测是否为 JSON 格式的评分细则
  const isJSONRubric = rubricText.trim().startsWith('{')
    || rubricText.includes('"strategyType"')
    || rubricText.includes('"version":"3.0"')
    || rubricText.includes('"version": "3.0"');

  let userPrompt: string;
  if (isJSONRubric) {
    // JSON 结构化评分模式
    userPrompt = `你是一位资深阅卷专家。请根据【评分细则JSON】对【学生答案图片】进行精准评分。

【评分细则JSON】
${rubricText}

【评分规则】

0. **原子化判定原则**（必须严格遵守）：
   - 逐一处理每个评分条目（point/step/dimension），禁止整体跳读或合并判定
   - 每个得分点独立评分，互不影响
   - 判定流程：提取关键词 → 核对学生答案 → 给出该点分数

1. 逐一检查评分细则中的每个得分项（points/steps/dimensions）
2. 根据 keywords 关键词匹配学生答案
3. 根据 scoringStrategy 计算最终得分：
   - pick_n: 最多计算 maxPoints 个得分点
   - all: 全部答对才得满分
   - weighted: 按各点分值计分

4. **题型评分策略**（非常重要，必须严格遵守）：

   【填空题】strictMode: true
   - 必须绝对精确匹配参考答案，多字、漏字、错字均不得分
   - 例如：
     * "查士丁尼法典" ≠ "罗马民法大全" → 0分
     * "伯里克利" ≠ "柏里克利" → 0分
     * "蒸汽机" ≠ "蒸气机" → 0分
     * "达·芬奇" ≠ "达芬奇" → 0分
   - 唯一例外：AI 应识别并接受常见的全角/半角标点符号差异（如书名号《》和""）
   - 阶梯赋分：匹配=满分，不匹配=0分（无中间档）

   【半开放题】allowAlternative: true（无 openEnded 标记）
   - 表述一致且要点涉及 → 该题满分
   - 意思相关但表述不精确 → 最多该题 50% 的分数
   - 完全无关或错误 → 0分
   - 阶梯赋分规则（以2分题为例）：
     * 命中全部关键词（如"思想解放"+"资本主义"）→ 2分
     * 仅命中单一关键词或表述模糊 → 1分（50%）
     * 完全未命中或时空错乱 → 0分

   【开放题】openEnded: true
   - 言之有理即得满分
   - 只要答案与题目相关、逻辑合理即可给满分
   - 仅当完全跑题或逻辑混乱时才扣分
   - 阶梯赋分规则（以2分题为例）：
     * 观点明确 + 逻辑完整 → 2分
     * 仅有观点无逻辑，或仅有描述无观点 → 1分
     * 完全跑题或逻辑混乱 → 0分

5. 参考 constraints 中的阅卷提示进行评分

6. **因果逻辑验证**（防止关键词堆砌欺骗）：
   - 人物→成就映射检查：
     * 若答案中出现"瓦特"，必须对应"蒸汽机"或"动力革命"
     * 若答案中出现"伯里克利"，必须对应"雅典民主"或"黄金时代"
     * 若答案中出现"达·芬奇"，必须对应"文艺复兴"或艺术作品
     * 若人物与成就错位（如"瓦特发现新大陆"），该小题判0分
   
   - 时空围栏检查（负面清单）：
     * 若题目涉及"文艺复兴"，答案中出现"马克思主义""互联网""全球变暖"等跨时代词汇，判定为时空错乱，该小题0分
     * 若题目涉及"古代中国"，答案中出现"工业革命""资本主义"等近现代概念，需核对上下文，若明显错乱则判0分
     * 若题目涉及"工业革命"，答案中出现"互联网""人工智能"等信息时代概念，判定为时空错乱，该小题0分
   
   - constraints 中若包含【逻辑验证】或【时空围栏】标记，必须严格执行

7. **技术指令**（AI 判定优先级）：
   - 专有名词（人名、地名、法律文件名）→ 绝对匹配，零容错
   - 描述性语句（意义、影响、措施）→ 语义匹配，允许表述差异
   - 语义相似度判定标准（针对半开放题）：
     * 核心意思完全一致（如"思想解放"="冲破思想束缚"）→ 满分
     * 意思相关但不精确（如"文化发展"代替"思想解放"）→ 50%分数
     * 意思无关或错误 → 0分

8. **deductionRules 优先级**（最高优先级）：
   - 若评分条目包含 deductionRules 字段，必须严格按照其中的判定逻辑执行
   - deductionRules 优先级高于全局题型策略（strictMode/allowAlternative/openEnded）
   - 判定模式示例：
     * "绝对匹配。柏里克利/伯利克利均0分" → 执行字符串完全相等校验
     * "书名号《》可省略" → 接受《神曲》和神曲
     * "维度匹配：命中2个维度=2分，1个=1分" → 精确计数关键词维度
     * "IF 命中'推动/引领' AND 命中'变革/进步' = 2分" → 执行因果逻辑验证
   - 语义相似度阈值：若 deductionRules 中明确 τ 值（如τ=0.85），按该阈值判定

9. **阶梯式评分表**（观点论述题专用）：
   - 适用场景：观点论述、史论结合、材料分析等主观题
   - 判定维度：
     * 观点明确性（是否有清晰主张）
     * 史实准确性（引用的历史事实是否正确）
     * 史论结合度（史实与观点的逻辑关联）
     * 表述规范性（语言组织、逻辑连贯）
   - 若 deductionRules 包含水平等级表（如 3-4分/2-3分/1-2分/0-1分），严格按表判定
   - 等级判定优先级：先看史论结合度，再看观点明确性，最后看表述规范性
   - 示例判定流程：
     * 4分档：观点明确 + 史实丰富准确 + 逻辑严密 + 表述规范
     * 3分档：观点明确 + 史实基本准确 + 逻辑较清晰 + 表述通顺
     * 2分档：有观点 + 有史实但不够充分 + 逻辑一般
     * 1分档：观点模糊 + 史实少或错误 + 逻辑混乱
     * 0分档：完全跑题或仅复制题目

【输出格式】
返回 JSON，breakdown 必须包含每个得分点的评分信息：
{
  "score": <总得分>,
  "maxScore": <总满分>,
  "comment": "| 编号 | 得分 | 理由 |\\n|---|---|---|\\n| 2-1 | 2/2 | ✓ 符合答案要求 |\\n| 2-2 | 0/2 | ✗ 未提及边疆危机 |",
  "breakdown": [
    {
      "label": "2-1 破坏了中国的领土主权",
      "score": 2,
      "max": 2,
      "comment": "✓ 答对"
    },
    {
      "label": "2-2 加剧了中国边疆危机",
      "score": 0,
      "max": 2,
      "comment": "✗ 未提及"
    }
  ]
}

【breakdown 字段要求】
- label: 得分点编号 + 参考答案内容
- score: 该点实得分（半开放题最多50%，开放题可给满分）
- max: 该点满分
- comment: 简洁评分理由（得分用✓，扣分用✗）

注意：评语要简洁，不要引用学生答案原文！`;
  } else {
    // 兼容旧版 Markdown 格式评分细则
    userPrompt = `你是一位高效的阅卷专家。请根据【评分细则】对【学生答案】进行快速评分。

【评分细则】
${rubricText}

【评分要求】
1. 快速判断得分，评语简洁明了。
2. comment 字段使用 Markdown 表格格式，包含小题号、得分和理由。
3. breakdown 必须包含每个得分点的详细评分。

返回 JSON 格式：
{
  "score": <总得分>,
  "maxScore": <总满分>,
  "comment": "| 题号 | 得分 | 理由 |\\n|---|---|---|\\n| (1) | 4/4 | ✓ 回答正确 |\\n| (2) | 2/4 | ✗ 缺少XXX |",
  "breakdown": [
    {"label": "(1) 得分点内容", "score": 4, "max": 4, "comment": "✓ 回答正确"},
    {"label": "(2) 得分点内容", "score": 2, "max": 4, "comment": "✗ 缺少关键词"}
  ]
}

注意：breakdown 必须填写，comment 使用 Markdown 表格格式。`;
  }

  const systemPrompt = '你是一位高效的阅卷专家。请根据评分细则对学生答案进行评分，返回 JSON 格式结果。';

  try {
    if (config.provider === 'google') {
      const ai = getGoogleClient(config.apiKey);
      if (!ai) throw new Error('未配置 Google API Key');

      const generateConfig: Record<string, unknown> = {};
      if (thinkingBudget) {
        generateConfig.thinkingConfig = { thinkingBudget };
      }

      const model = ai.getGenerativeModel({
        model: modelName,
        generationConfig: Object.keys(generateConfig).length > 0 ? generateConfig as any : undefined
      });

      const response = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: systemPrompt + '\n\n' + userPrompt },
            { inlineData: { mimeType: 'image/jpeg', data: studentImageBase64 } }
          ]
        }]
      });

      // 提取响应文本
      // response.response.text() 会自动过滤掉 thought parts
      const text = cleanJsonResponse(response.response.text() || '{}');
      const result = JSON.parse(text);

      const studentResult: StudentResult = {
        id: Date.now().toString(),
        name: '自动识别',
        className: '自动识别',
        score: result.score || 0,
        maxScore: result.maxScore || 10,
        comment: result.comment || '',
        breakdown: result.breakdown || []
      };

      // 3️⃣ 异步上报使用并触发UI更新 (CloudBase, 不阻塞)
      import('./cloudbaseService').then(({ consumeQuota }) => {
        import('../utils/device').then(({ getDeviceId }) => {
          consumeQuota(getDeviceId()).then(() => {
            // 触发额度更新事件，让QuotaDisplay刷新
            window.dispatchEvent(new Event('quota_updated'));
            console.log('[assessStudentAnswer] Quota consumed and UI updated');
          }).catch(console.error);
        });
      }).catch(console.error);

      return studentResult;

    } else {
      // OpenAI / 智谱兼容 API - 传入策略模型
      const responseText = await callOpenAICompatible(config, systemPrompt, userPrompt, studentImageBase64, true, modelName);
      const text = cleanJsonResponse(responseText);
      const result = JSON.parse(text);

      const studentResult: StudentResult = {
        id: Date.now().toString(),
        name: '自动识别',
        className: '自动识别',
        score: result.score || 0,
        maxScore: result.maxScore || 10,
        comment: result.comment || '',
        breakdown: result.breakdown || []
      };

      // 3️⃣ 异步上报使用并触发UI更新 (CloudBase, 不阻塞)
      import('./cloudbaseService').then(({ consumeQuota }) => {
        import('../utils/device').then(({ getDeviceId }) => {
          consumeQuota(getDeviceId()).then(() => {
            // 触发额度更新事件，让QuotaDisplay刷新
            window.dispatchEvent(new Event('quota_updated'));
            console.log('[assessStudentAnswer] Quota consumed and UI updated');
          }).catch(console.error);
        });
      }).catch(console.error);

      return studentResult;
    }
  } catch (error) {
    console.error('[assessStudentAnswer] Frontend direct mode failed:', error);
    throw new Error(`批改失败:${error instanceof Error ? error.message : 'API 调用失败'}`);
  }
};

/**
 * 3. Stats Insight
 */
export const generateGradingInsight = async (avgScore: number, passRate: number): Promise<string> => {
  const config = getAppConfig();
  const prompt = `基于历史数据：平均分${avgScore.toFixed(1)}，及格率${passRate.toFixed(1)}%。写一段简短的中文教学分析总结（100字内）。`;

  try {
    if (config.provider === 'google') {
      const ai = getGoogleClient(config.apiKey);
      if (!ai) return "AI 未连接";
      const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const res = await model.generateContent(prompt);
      return res.response.text() || "";
    } else {
      // Simplified text call
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` };
      const body = { model: config.modelName, messages: [{ role: 'user', content: prompt }] };
      const res = await fetch(config.endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }
  } catch (error) {
    return "无法生成分析。";
  }
};

/**
 * 4. Refine Rubric based on user suggestions
 */
export const refineRubric = async (currentRubric: string, suggestion: string): Promise<string> => {
  const config = getAppConfig();

  const prompt = `你是一位专业的教育评估专家。请根据用户的修改建议，改进以下评分标准。

**当前评分标准：**
${currentRubric}

**用户的修改建议：**
${suggestion}

**输出格式要求：**
1. 先输出总分标题，如：## 第X题评分细则（共X分）
2. 使用 Markdown 表格，包含以下列：

| 小题号 | 得分点 | 分值 | 满分条件 | 关键词 | 扣分规则 |

**小题号格式：**
- 同一大题多个空用 "1-1", "1-2", "1-3" 格式
- 单独小题用数字 "2", "3"

**优化原则：**
1. 根据用户建议进行针对性修改
2. 填空题：关键词直接写答案，扣分规则写"答错不得分"
3. 简答题：关键词用逗号分隔，保留"其他答案合理即可"
4. 确保分值总和正确
5. 去除 \`\`\`markdown 等代码块标记，直接输出

请输出优化后的评分标准：`;

  try {
    if (config.provider === 'google') {
      const ai = getGoogleClient(config.apiKey);
      if (!ai) return "AI 未连接";
      const model = ai.getGenerativeModel({ model: config.modelName });
      const res = await model.generateContent(prompt);
      return res.response.text() || "";
    } else {
      // OpenAI / Zhipu Compatible
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };
      const body = {
        model: config.modelName,
        messages: [{ role: 'user', content: prompt }]
      };
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }
  } catch (error) {
    console.error('[refineRubric] Error:', error);
    throw new Error('评分标准优化失败，请检查 API 连接');
  }
};

/**
 * 5. Standardize Rubric - 将任意格式的评分细则转换为结构化 Markdown 表格
 * 强制使用后端代理模式
 */
export const standardizeRubric = async (rawRubric: string, maxScore?: number): Promise<string> => {
  // 强制使用后端代理模式
  const { standardizeRubricWithProxy } = await import('./proxyService');

  console.log('[standardizeRubric] Using backend proxy');

  try {
    return await standardizeRubricWithProxy(rawRubric, maxScore);
  } catch (error) {
    console.error('[standardizeRubric] Backend proxy failed:', error);
    throw new Error(`评分标准标准化失败：${error instanceof Error ? error.message : '后端服务不可用'}`);
  }
};

/**
 * 额度上报辅助函数 (异步,不阻塞)
 */
async function reportQuotaUsage(userToken: string | null): Promise<void> {
  if (!userToken) return;

  try {
    await fetch('http://localhost:3000/api/quota/consume', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('[reportQuotaUsage] Usage reported successfully');
  } catch (error) {
    console.error('[reportQuotaUsage] Failed to report usage:', error);
    // 失败不影响用户使用
  }
}
