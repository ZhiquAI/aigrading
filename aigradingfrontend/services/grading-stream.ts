/**
 * grading-stream.ts - 流式批改服务
 * 提供实时流式输出的批改功能
 */

import { callOpenAIStream, createOpenAIConfig } from './openaiService';
import { getAppConfig } from './geminiService';
import type { StudentResult } from '../types';

/**
 * 流式批改学生答案
 * @param studentImageBase64 学生答题卡图片
 * @param rubricText 评分细则
 * @param onChunk 实时接收文本块的回调函数
 * @returns 完整的批改结果
 */
export async function gradeStudentAnswerStream(
    studentImageBase64: string,
    rubricText: string,
    onChunk: (chunk: string) => void
): Promise<StudentResult> {
    const config = getAppConfig();

    if (!config.apiKey) {
        throw new Error('请先在设置中配置 API Key');
    }

    // 检测是否为 JSON 格式的评分细则
    const isJSONRubric = rubricText.trim().startsWith('{') || rubricText.includes('"answerPoints"');

    let userPrompt: string;
    if (isJSONRubric) {
        // JSON 结构化评分模式 (简化版)
        userPrompt = `你是一位资深阅卷专家。请根据【评分细则JSON】对【学生答案图片】进行精准评分。

【评分细则JSON】
${rubricText}

【评分要求】
1. 逐一检查 answerPoints 中的每个得分点
2. 根据 keywords 关键词匹配学生答案
3. 填空题必须精确匹配，半开放题意思相符即可，开放题言之有理即可

【输出格式】
返回 JSON：
{
  "score": <总得分>,
  "maxScore": <总满分>,
  "comment": "| 编号 | 得分 | 理由 |\\n|---|---|---|\\n| 2-1 | 2/2 | ✓ 符合答案要求 |",
  "breakdown": [
    {
      "label": "2-1 破坏了中国的领土主权",
      "score": 2,
      "max": 2,
      "comment": "✓ 答对"
    }
  ]
}`;
    } else {
        // Markdown 格式评分细则
        userPrompt = `你是一位高效的阅卷专家。请根据【评分细则】对【学生答案】进行快速评分。

【评分细则】
${rubricText}

【评分要求】
1. 快速判断得分，评语简洁明了
2. comment 使用 Markdown 表格格式
3. breakdown 包含每个得分点的详细评分

返回 JSON 格式：
{
  "score": <总得分>,
  "maxScore": <总满分>,
  "comment": "| 题号 | 得分 | 理由 |\\n|---|---|---|\\n| (1) | 4/4 | ✓ 回答正确 |",
  "breakdown": [
    {"label": "(1) 得分点内容", "score": 4, "max": 4, "comment": "✓ 回答正确"}
  ]
}`;
    }

    const systemPrompt = '你是一位高效的阅卷专家。请根据评分细则对学生答案进行评分，返回 JSON 格式结果。';

    // 根据 provider 选择调用方式
    let fullText = '';

    try {
        // 动态导入阿里云服务
        const { callAlibaba, createAlibabaConfig } = await import('./alibabaService');

        if (config.provider === 'alibaba') {
            // 阿里云 Qwen-VL 使用非流式调用（更稳定的 JSON 输出）
            const alibabaConfig = createAlibabaConfig(config);

            // 模拟流式效果：先显示提示，然后一次性显示结果
            onChunk('正在分析答题卡...\n');

            fullText = await callAlibaba(
                alibabaConfig,
                systemPrompt,
                userPrompt,
                studentImageBase64,
                {
                    jsonMode: true,  // 启用 JSON 模式
                    maxTokens: 4096
                }
            );

            onChunk(fullText);  // 显示完整结果
        } else {
            // OpenAI 兼容格式流式调用（OpenAI、智谱等）
            const openaiConfig = createOpenAIConfig(config);
            const streamGenerator = callOpenAIStream(
                openaiConfig,
                systemPrompt,
                userPrompt,
                studentImageBase64
            );

            for await (const chunk of streamGenerator) {
                fullText += chunk;
                onChunk(chunk);  // 实时回调，更新UI
            }
        }

        // 调试信息
        console.log('[grading-stream] 完整响应长度:', fullText.length);
        console.log('[grading-stream] 前100字符:', fullText.substring(0, 100));
        console.log('[grading-stream] 后100字符:', fullText.substring(fullText.length - 100));

        // 清理 JSON 响应（移除可能的 markdown 代码块）
        let cleanedText = fullText.trim();
        if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/, '');
            cleanedText = cleanedText.replace(/\n?```\s*$/, '');
        }
        cleanedText = cleanedText.trim();

        console.log('[grading-stream] 清理后文本长度:', cleanedText.length);

        // 检查是否为空
        if (!cleanedText) {
            throw new Error('AI返回内容为空，请重试');
        }

        // 检查是否是有效的JSON开头
        if (!cleanedText.startsWith('{')) {
            console.error('[grading-stream] 返回内容不是JSON:', cleanedText.substring(0, 200));
            throw new Error('AI返回格式错误，请重试');
        }

        // JSON 修复函数
        const repairJSON = (text: string): string => {
            let repaired = text;

            // 1. 找到最后一个完整的 } 并截断后面的内容
            const lastBrace = repaired.lastIndexOf('}');
            if (lastBrace > 0) {
                repaired = repaired.substring(0, lastBrace + 1);
            }

            // 2. 移除 JSON 字符串值中的未转义换行符
            // 在 "..." 内的换行替换为 \\n
            repaired = repaired.replace(/"([^"]*?)"/g, (match) => {
                return match
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t');
            });

            // 3. 移除对象末尾的逗号
            repaired = repaired.replace(/,(\s*[}\]])/g, '$1');

            return repaired;
        };

        // 解析结果（带修复重试）
        let result;
        try {
            result = JSON.parse(cleanedText);
        } catch (parseError) {
            console.warn('[grading-stream] 首次JSON解析失败，尝试修复...');
            console.log('[grading-stream] 原始文本:', cleanedText.substring(0, 500));

            try {
                const repairedText = repairJSON(cleanedText);
                console.log('[grading-stream] 修复后文本:', repairedText.substring(0, 500));
                result = JSON.parse(repairedText);
                console.log('[grading-stream] JSON修复成功!');
            } catch (repairError) {
                console.error('[grading-stream] JSON修复也失败了');
                console.error('[grading-stream] 修复错误:', repairError);
                console.error('[grading-stream] 完整原始文本:', cleanedText);
                throw new Error(`批改结果解析失败: ${parseError instanceof Error ? parseError.message : '未知错误'}`);
            }
        }

        const studentResult: StudentResult = {
            id: Date.now().toString(),
            name: '自动识别',
            className: '自动识别',
            score: result.score || 0,
            maxScore: result.maxScore || 10,
            comment: result.comment || '',
            breakdown: result.breakdown || []
        };

        // 异步消费额度（不阻塞）
        consumeQuotaAsync();

        return studentResult;
    } catch (error) {
        console.error('[gradeStudentAnswerStream] Error:', error);
        console.error('[gradeStudentAnswerStream] 完整响应:', fullText);
        throw error;
    }
}

/**
 * 异步消费额度并更新UI
 */
async function consumeQuotaAsync() {
    try {
        const { consumeQuota } = await import('./cloudbaseService');
        const { getDeviceId } = await import('../utils/device');
        const deviceId = getDeviceId();

        await consumeQuota(deviceId);

        // 触发额度更新事件
        window.dispatchEvent(new Event('quota_updated'));
        console.log('[gradeStudentAnswerStream] Quota consumed and UI updated');
    } catch (error) {
        console.error('[gradeStudentAnswerStream] Failed to consume quota:', error);
    }
}
