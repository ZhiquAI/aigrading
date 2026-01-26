// background.js

// 点击图标打开侧边栏
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// 监听 Tab 更新，仅在特定阅卷网站启用
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  const url = new URL(tab.url);
  // 示例：仅在智学网或好分数启用
  if (url.origin.includes('zhixue.com') || url.origin.includes('haofenshu.com')) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'v2.html',
      enabled: true
    });
  }
});

// ==========================================
// AI Grading in Service Worker (Multi-Tab Auto)
// ==========================================

const STORAGE_KEY_CONFIG = 'app_model_config';
const HISTORY_KEY = 'grading_history';

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, value: null };
  }
}

function extractJsonObject(text) {
  if (!text) return null;
  const raw = String(text);
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const slice = raw.slice(start, end + 1);
    const parsed = safeJsonParse(slice);
    // 确保返回的是有效对象，而不是 null
    if (parsed.ok && parsed.value !== null && typeof parsed.value === 'object') return parsed.value;
  }
  const parsed = safeJsonParse(raw);
  if (parsed.ok && parsed.value !== null && typeof parsed.value === 'object') return parsed.value;
  return null;
}

function getModelName(strategy, config) {
  // Only Google REST implemented here (provider must be google)
  if (strategy === 'pro' || strategy === 'reasoning') return 'gemini-3-pro-preview';
  return 'gemini-2.0-flash-exp';
}

function normalizeProviderResult(obj) {
  if (!obj || typeof obj !== 'object') return null;

  // 标准结构：{ score, maxScore, breakdown[] }
  if (typeof obj.score !== 'undefined' && typeof obj.maxScore !== 'undefined' && Array.isArray(obj.breakdown)) {
    return obj;
  }

  // 备选结构 1: { total_score, details[] } (部分模型返回格式)
  if (typeof obj.total_score !== 'undefined' && Array.isArray(obj.details)) {
    const details = obj.details || [];
    const maxPer = 1;
    const breakdown = details.map((d, i) => ({
      label: d?.sub_question || d?.label || `得分点${i + 1}`,
      score: Number(d?.score ?? 0) || 0,
      max: maxPer,
      comment: d?.reason || d?.comment || '',
      isNegative: (Number(d?.score ?? 0) || 0) <= 0
    }));
    const score = Number(obj.total_score ?? breakdown.reduce((s, b) => s + (Number(b.score) || 0), 0)) || 0;
    const maxScore = breakdown.length > 0 ? breakdown.length * maxPer : (Number(obj.maxScore) || 0);
    return { score, maxScore, comment: obj.comment || '', breakdown };
  }

  // 备选结构 2: 只有 score 字段（简化返回）
  if (typeof obj.score !== 'undefined') {
    const breakdown = Array.isArray(obj.breakdown) ? obj.breakdown : [];
    return {
      score: Number(obj.score) || 0,
      maxScore: Number(obj.maxScore ?? obj.max_score ?? obj.totalScore ?? obj.total_score ?? obj.满分 ?? 0) || 0,
      comment: obj.comment || obj.评语 || obj.reason || '',
      breakdown
    };
  }

  // 备选结构 3: 驼峰命名变体 { totalScore }
  if (typeof obj.totalScore !== 'undefined') {
    return {
      score: Number(obj.score ?? obj.studentScore ?? 0) || 0,
      maxScore: Number(obj.totalScore) || 0,
      comment: obj.comment || obj.feedback || '',
      breakdown: Array.isArray(obj.breakdown) ? obj.breakdown : []
    };
  }

  // 备选结构 4: 中文字段名 { 得分, 满分, 评语 }
  if (typeof obj.得分 !== 'undefined' || typeof obj.分数 !== 'undefined') {
    return {
      score: Number(obj.得分 ?? obj.分数 ?? 0) || 0,
      maxScore: Number(obj.满分 ?? obj.总分 ?? 0) || 0,
      comment: obj.评语 || obj.评价 || obj.点评 || '',
      breakdown: []
    };
  }

  // 备选结构 5: 尝试从任意数值字段猜测 score
  const numericKeys = Object.keys(obj).filter(k => typeof obj[k] === 'number');
  if (numericKeys.length > 0) {
    // 优先找包含 score/分 的 key
    const scoreKey = numericKeys.find(k => /score|分数|得分/i.test(k)) || numericKeys[0];
    const maxKey = numericKeys.find(k => /max|满分|总分/i.test(k));
    return {
      score: Number(obj[scoreKey]) || 0,
      maxScore: maxKey ? Number(obj[maxKey]) || 0 : 0,
      comment: obj.comment || obj.reason || obj.feedback || obj.评语 || '',
      breakdown: []
    };
  }

  return null;
}

async function geminiGenerateJson({ apiKey, model, prompt, imageBase64 }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${t}`);
  }

  const data = await res.json();

  // 检查是否有内容生成失败的情况
  const candidate = data?.candidates?.[0];
  if (!candidate) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Gemini 内容被阻止: ${blockReason}`);
    }
    throw new Error('Gemini 未返回有效候选内容');
  }

  // 检查候选内容的完成原因
  const finishReason = candidate.finishReason;
  if (finishReason && finishReason !== 'STOP') {
    console.warn(`[AI阅卷] Gemini 完成原因: ${finishReason}`);
  }

  const text = candidate.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
  console.log('[AI阅卷] Gemini 原始文本:', text.slice(0, 500));

  if (!text.trim()) {
    throw new Error('Gemini 返回内容为空，请检查图片格式或重试');
  }

  const json = extractJsonObject(text);
  if (!json || typeof json !== 'object') {
    throw new Error(`Gemini 返回无法解析为 JSON: ${text.slice(0, 200)}`);
  }
  return json;
}

async function callOpenAICompatibleFromBackground(config, prompt, imageBase64) {
  const endpoint = config.endpoint;
  if (!endpoint) throw new Error('未配置 API 端点');
  if (!config.apiKey) throw new Error('未配置 API Key');

  // 智谱AI 的系统提示词需要更强调 JSON 格式输出
  const systemPrompt = `你是一位专业的阅卷老师。你必须严格按照JSON格式输出评分结果，不要输出任何其他内容。
输出格式：{"score": 数字, "maxScore": 数字, "comment": "字符串", "breakdown": [{"label": "字符串", "score": 数字, "max": 数字, "comment": "字符串", "isNegative": 布尔值}]}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ]
    }
  ];

  // 构建请求体 - 注意：智谱AI 不支持 response_format 参数
  const body = {
    model: config.modelName,
    messages,
    temperature: 0.2,
    max_tokens: 2048  // 增加 token 限制避免推理模型被截断
  };

  // 仅对支持 response_format 的 provider 添加该参数（OpenAI 兼容）
  if (config.provider === 'openai') {
    body.response_format = { type: 'json_object' };
  }

  console.log('[AI阅卷] 调用API:', { provider: config.provider, model: config.modelName, endpoint });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  console.log('[AI阅卷] API HTTP状态:', res.status, '响应长度:', text.length);

  if (!res.ok) {
    throw new Error(`Provider HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Provider 返回非 JSON: ${text.slice(0, 300)}`);
  }

  // 检查 API 错误响应
  if (data.error) {
    throw new Error(`API 错误: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const choice = data?.choices?.[0];
  if (!choice) {
    console.error('[AI阅卷] API 完整响应:', JSON.stringify(data).slice(0, 500));
    throw new Error('API 未返回有效的 choices 内容');
  }

  // 检查是否因为长度限制被截断
  const finishReason = choice.finish_reason;
  if (finishReason === 'length') {
    console.warn('[AI阅卷] 响应被截断 (finish_reason=length)');
  }

  const content = choice.message?.content;
  const reasoningContent = choice.message?.reasoning_content;  // 智谱AI 推理模型特有字段

  console.log('[AI阅卷] content:', typeof content, String(content || '').slice(0, 300));
  if (reasoningContent) {
    console.log('[AI阅卷] reasoning_content 长度:', reasoningContent.length);
  }

  // 兼容：有些实现（含部分厂商/代理）在 response_format=json_object 时会直接返回 object
  if (content && typeof content === 'object') {
    return content;
  }

  let contentText = typeof content === 'string' ? content : (content == null ? '' : String(content));

  // 如果 content 为空但有 reasoning_content，尝试从推理内容中提取 JSON
  if (!contentText.trim() && reasoningContent) {
    console.log('[AI阅卷] content 为空，尝试从 reasoning_content 提取结果');
    const extractedFromReasoning = extractJsonObject(reasoningContent);
    if (extractedFromReasoning) {
      console.log('[AI阅卷] 从 reasoning_content 提取成功');
      return extractedFromReasoning;
    }

    // 如果是因为截断导致的，给出明确提示
    if (finishReason === 'length') {
      throw new Error('模型响应被截断，请尝试使用更快的模型（如 glm-4v-flash）或简化评分标准');
    }

    console.error('[AI阅卷] API 完整响应:', JSON.stringify(data).slice(0, 800));
    throw new Error('API 返回内容为空，请检查模型配置或重试');
  }

  if (!contentText.trim()) {
    console.error('[AI阅卷] API 完整响应:', JSON.stringify(data).slice(0, 500));
    throw new Error('API 返回内容为空，请检查模型是否支持图片或重试');
  }

  // content 本身可能是 JSON 字符串，也可能夹带多余文本/markdown
  let parsed;
  try {
    parsed = JSON.parse(contentText);
  } catch (e) {
    parsed = extractJsonObject(contentText);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`API 返回无法解析为 JSON: ${contentText.slice(0, 200)}`);
  }

  return parsed;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type !== 'GRADE_ANSWER') return;

  (async () => {
    try {
      const { questionKey, answerImageBase64, strategy, studentName, platform, markingPaperId, questionNo } = request || {};
      if (!questionKey) throw new Error('缺少 questionKey');
      if (!answerImageBase64 || String(answerImageBase64).length < 1000) throw new Error('缺少有效的答题卡图片');

      const configWrap = await chrome.storage.local.get([STORAGE_KEY_CONFIG]);
      const config = configWrap?.[STORAGE_KEY_CONFIG] || null;

      const rubricKey = `app_rubric_content:${questionKey}`;
      console.log('[Background] 尝试精确匹配，rubricKey:', rubricKey);
      const rubricWrap = await chrome.storage.local.get([rubricKey]);
      let rubricText = rubricWrap?.[rubricKey] || '';
      console.log('[Background] 精确匹配结果:', rubricText ? '找到' : '未找到');

      // 如果精确匹配失败，尝试按题号模糊匹配
      if (!rubricText || !String(rubricText).trim()) {
        console.log('[Background] 精确匹配失败，尝试模糊匹配');
        console.log('[Background] request.questionNo=', questionNo, 'questionKey=', questionKey);

        // 优先使用请求中的 questionNo，否则从 questionKey 解析
        let currentQuestionNo = questionNo;
        if (!currentQuestionNo || currentQuestionNo === 'unknown') {
          const parts = questionKey.split(':');
          currentQuestionNo = parts[parts.length - 1];
        }

        console.log('[Background] 使用的题号:', currentQuestionNo);

        if (currentQuestionNo && currentQuestionNo !== 'unknown') {
          console.log('[Background] Trying fuzzy match with questionNo:', currentQuestionNo);
          // 获取所有存储的数据，搜索匹配的评分细则
          const allItems = await chrome.storage.local.get(null);
          const rubricKeys = Object.keys(allItems).filter(k => k.startsWith('app_rubric_content:'));
          console.log('[Background] 存储中的评分细则 keys:', rubricKeys);

          // 提取当前题号的数字部分（用于模糊匹配）
          const currentNoMatch = String(currentQuestionNo).match(/(\d+)/);
          const currentNoDigits = currentNoMatch ? currentNoMatch[1] : currentQuestionNo;
          // 尝试提取后2-3位作为简短题号
          const currentNoShort = currentNoDigits.length > 2 ? currentNoDigits.slice(-2) : currentNoDigits;
          console.log('[Background] 数字部分:', currentNoDigits, '后2位:', currentNoShort);

          for (const key of rubricKeys) {
            const value = allItems[key];
            if (!value || typeof value !== 'string' || !value.trim()) continue;

            // 解析这个 key 的题号
            const keyParts = key.replace('app_rubric_content:', '').split(':');
            const keyQuestionNo = keyParts[keyParts.length - 1];

            // 提取 key 中题号的数字部分
            const keyNoMatch = String(keyQuestionNo).match(/(\d+)/);
            const keyNoDigits = keyNoMatch ? keyNoMatch[1] : keyQuestionNo;

            console.log('[Background] 比较:', keyQuestionNo, '(数字:', keyNoDigits, ') vs', currentQuestionNo, '(数字:', currentNoDigits, ')');

            // 多策略匹配
            const isMatch =
              keyQuestionNo === currentQuestionNo ||  // 精确匹配
              keyNoDigits === currentNoDigits ||      // 数字部分匹配
              keyNoDigits === currentNoShort ||       // 存储的题号匹配当前的后缀
              (currentNoDigits.endsWith(keyNoDigits) && keyNoDigits.length >= 2);  // 当前是长ID，存储是短题号

            if (isMatch) {
              console.log('[Background] Matched rubric by questionNo:', currentQuestionNo, 'from key:', key);
              rubricText = value;
              break;
            }
          }

          if (!rubricText) {
            console.log('[Background] 未找到匹配的评分细则');

            // 兜底：如果只有一个评分细则，直接使用它
            if (rubricKeys.length === 1) {
              const onlyKey = rubricKeys[0];
              const onlyValue = allItems[onlyKey];
              if (onlyValue && typeof onlyValue === 'string' && onlyValue.trim()) {
                console.log('[Background] 兜底匹配：使用唯一的评分细则:', onlyKey);
                rubricText = onlyValue;
              }
            }
          }
        }
      }

      if (!rubricText || !String(rubricText).trim()) {
        throw new Error('该题未配置评分标准（请先在侧边栏为当前题保存评分标准）');
      }

      const prompt = `你是一位阅卷老师。请严格按照评分标准进行评分，并以 JSON 输出。

【评分标准（Markdown）】
${rubricText}

【输出要求】
1. 必须严格按照以下 JSON 格式输出，不要添加任何多余文字、代码块标记或解释
2. 字段名必须使用英文，不要使用中文字段名
3. 所有数值必须是数字类型，不要加引号

【JSON 结构】
{
  "score": number,        // 学生总得分（必填）
  "maxScore": number,     // 本题满分（必填）
  "comment": string,      // 简短总体评语（必填）
  "breakdown": [          // 得分点明细（必填，至少一项）
    { "label": string, "score": number, "max": number, "comment": string, "isNegative": boolean }
  ]
}

【示例输出】
{"score": 8, "maxScore": 10, "comment": "解答基本正确，部分细节需完善", "breakdown": [{"label": "填空1", "score": 2, "max": 2, "comment": "正确", "isNegative": false}, {"label": "填空2", "score": 1, "max": 2, "comment": "答案不完整", "isNegative": false}]}
`;

      if (!config) throw new Error('未配置模型（请在设置中保存配置）');

      let raw = null;
      if (config.provider === 'google') {
        const apiKey = config.apiKey;
        if (!apiKey) throw new Error('未配置 Google API Key（请在设置中保存）');
        const model = getModelName(strategy || 'flash', config);
        raw = await geminiGenerateJson({
          apiKey,
          model,
          prompt,
          imageBase64: answerImageBase64
        });
      } else if (config.provider === 'zhipu' || config.provider === 'openai') {
        raw = await callOpenAICompatibleFromBackground(config, prompt, answerImageBase64);
      } else {
        throw new Error(`不支持的 provider: ${config.provider}`);
      }

      const rawText = typeof raw === 'string' ? raw : JSON.stringify(raw);
      console.log('[AI阅卷] 原始返回:', rawText?.slice(0, 300));

      const json = normalizeProviderResult(raw) || normalizeProviderResult(extractJsonObject(rawText)) || raw;
      const normalized = normalizeProviderResult(json) || json;

      if (!normalized || typeof normalized !== 'object') {
        console.error('[AI阅卷] 解析失败，完整原始返回:', rawText);
        console.error('[AI阅卷] 尝试解析的对象:', JSON.stringify(raw));
        throw new Error(`评分结果结构无效: ${(rawText || '').slice(0, 180)}`);
      }

      console.log('[AI阅卷] 解析成功:', { score: normalized.score, maxScore: normalized.maxScore });

      // Write history for analysis (keep last 500)
      try {
        const wrap = await chrome.storage.local.get([HISTORY_KEY]);
        const list = Array.isArray(wrap?.[HISTORY_KEY]) ? wrap[HISTORY_KEY] : [];
        list.unshift({
          id: Date.now().toString(),
          name: studentName || '未知学生',
          score: Number(normalized.score ?? 0),
          maxScore: Number(normalized.maxScore ?? 0),
          comment: normalized.comment || '',
          breakdown: Array.isArray(normalized.breakdown) ? normalized.breakdown : [],
          platform: platform || null,
          markingPaperId: markingPaperId || null,
          questionNo: questionNo || null,
          questionKey: questionKey,
          provider: config.provider,
          modelName: config.modelName,
          endpoint: config.provider === 'google' ? 'generativelanguage.googleapis.com' : (config.endpoint || ''),
          timestamp: Date.now()
        });
        if (list.length > 500) list.length = 500;
        await chrome.storage.local.set({ [HISTORY_KEY]: list });
      } catch (e) {
        // ignore history errors
      }

      sendResponse({ success: true, result: normalized });
    } catch (e) {
      sendResponse({ success: false, error: e?.message || String(e) });
    }
  })();

  return true; // async
});