/**
 * API 平台对比测试工具
 * 用于测试和对比不同平台的性能、成本和准确性
 */

import {
    PlatformName,
    getAllPlatforms,
    toAppConfig,
    recordUsage,
    PLATFORM_CONFIGS,
    StoredPlatformConfig
} from './api-platform-manager';
import { testConnection } from './geminiService';
import { StudentResult } from '../types';

export interface BenchmarkResult {
    platform: PlatformName;
    success: boolean;
    latency: number;        // 延迟(毫秒)
    error?: string;
    result?: StudentResult;
    cost?: number;          // 预估成本(元)
    timestamp: number;
}

export interface ComparisonReport {
    benchmarks: BenchmarkResult[];
    summary: {
        fastest: PlatformName;
        cheapest: PlatformName;
        mostReliable: PlatformName;
        recommended: PlatformName;
    };
    costComparison: {
        platform: PlatformName;
        estimatedCost: number;
        savings: number;       // 相比最贵的节省金额
    }[];
}

/**
 * 测试单个平台的连接性能
 */
export const benchmarkPlatform = async (
    platform: PlatformName
): Promise<BenchmarkResult> => {
    const startTime = Date.now();
    const config = getAllPlatforms()[platform];

    if (!config.enabled || !config.apiKey) {
        return {
            platform,
            success: false,
            latency: 0,
            error: 'Platform not configured',
            timestamp: Date.now(),
        };
    }

    try {
        const appConfig = toAppConfig(config);
        const success = await testConnection(appConfig);
        const latency = Date.now() - startTime;

        return {
            platform,
            success,
            latency,
            timestamp: Date.now(),
        };
    } catch (error) {
        return {
            platform,
            success: false,
            latency: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
        };
    }
};

/**
 * 测试所有已配置平台的评分功能
 */
export const benchmarkGrading = async (
    imageBase64: string,
    rubricText: string,
    strategy: 'flash' | 'pro' | 'reasoning' = 'pro'
): Promise<BenchmarkResult[]> => {
    const platforms = getAllPlatforms();
    const results: BenchmarkResult[] = [];

    // 只测试已启用且有API Key的平台
    const enabledPlatforms = Object.entries(platforms)
        .filter(([_, config]) => config.enabled && config.apiKey)
        .map(([name]) => name as PlatformName);

    console.log(`[benchmarkGrading] Testing ${enabledPlatforms.length} platforms`);

    // 动态导入评分函数
    const { assessStudentAnswer } = await import('./geminiService');
    const { setActivePlatform, getActivePlatform } = await import('./api-platform-manager');

    // 保存当前平台,测试后恢复
    const originalPlatform = getActivePlatform();

    for (const platformName of enabledPlatforms) {
        const startTime = Date.now();

        try {
            console.log(`[benchmarkGrading] Testing platform: ${platformName}`);

            // 临时切换到测试平台
            setActivePlatform(platformName);

            // 执行评分
            const result = await assessStudentAnswer(imageBase64, rubricText, strategy);
            const latency = Date.now() - startTime;

            // 估算成本
            const config = platforms[platformName];
            const model = strategy === 'flash' ? 'gemini-2.5-flash' :
                strategy === 'reasoning' ? 'gemini-3-pro-preview' :
                    'gemini-3-flash-preview';

            const avgTokens = 2500; // 平均tokens估算
            const pricePerMillion = (config.pricing as any)[model] || 0;
            const cost = (avgTokens / 1_000_000) * pricePerMillion;

            // 记录使用
            recordUsage({
                platform: platformName,
                model,
                timestamp: Date.now(),
                tokens: avgTokens,
                cost,
                latency,
                success: true,
            });

            results.push({
                platform: platformName,
                success: true,
                latency,
                result,
                cost,
                timestamp: Date.now(),
            });

            console.log(`[benchmarkGrading] ${platformName} completed in ${latency}ms, cost: ¥${cost.toFixed(4)}`);

        } catch (error) {
            const latency = Date.now() - startTime;

            results.push({
                platform: platformName,
                success: false,
                latency,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now(),
            });

            console.error(`[benchmarkGrading] ${platformName} failed:`, error);
        }
    }

    // 恢复原平台
    setActivePlatform(originalPlatform);

    return results;
};

/**
 * 生成对比报告
 */
export const generateComparisonReport = (
    benchmarks: BenchmarkResult[]
): ComparisonReport => {
    const successful = benchmarks.filter(b => b.success);

    if (successful.length === 0) {
        throw new Error('No successful benchmarks to compare');
    }

    // 找出最快的
    const fastest = successful.reduce((prev, curr) =>
        curr.latency < prev.latency ? curr : prev
    ).platform;

    // 找出最便宜的
    const cheapest = successful.reduce((prev, curr) =>
        (curr.cost || Infinity) < (prev.cost || Infinity) ? curr : prev
    ).platform;

    // 找出可靠性最高的(基于预设配置)
    const mostReliable = successful.reduce((prev, curr) => {
        const prevReliability = PLATFORM_CONFIGS[prev.platform].performance.reliability;
        const currReliability = PLATFORM_CONFIGS[curr.platform].performance.reliability;
        return currReliability > prevReliability ? curr : prev;
    }).platform;

    // 综合推荐(成本+速度+可靠性)
    const scored = successful.map(b => {
        const costScore = (b.cost || 0) * 100;  // 成本越低越好
        const latencyScore = b.latency / 10;    // 延迟越低越好
        const reliabilityScore = (1 - PLATFORM_CONFIGS[b.platform].performance.reliability) * 1000; // 可靠性越高越好

        return {
            platform: b.platform,
            totalScore: costScore + latencyScore + reliabilityScore,
        };
    });

    const recommended = scored.reduce((prev, curr) =>
        curr.totalScore < prev.totalScore ? curr : prev
    ).platform;

    // 成本对比
    const maxCost = Math.max(...successful.map(b => b.cost || 0));
    const costComparison = successful.map(b => ({
        platform: b.platform,
        estimatedCost: b.cost || 0,
        savings: maxCost - (b.cost || 0),
    })).sort((a, b) => a.estimatedCost - b.estimatedCost);

    return {
        benchmarks,
        summary: {
            fastest,
            cheapest,
            mostReliable,
            recommended,
        },
        costComparison,
    };
};

/**
 * 快速对比测试(仅连接性能)
 */
export const quickCompare = async (): Promise<{
    results: BenchmarkResult[];
    fastest: PlatformName;
    avgLatency: Record<PlatformName, number>;
}> => {
    const platforms = getAllPlatforms();
    const enabledPlatforms = Object.entries(platforms)
        .filter(([_, config]) => config.enabled && config.apiKey)
        .map(([name]) => name as PlatformName);

    const results = await Promise.all(
        enabledPlatforms.map(p => benchmarkPlatform(p))
    );

    const successful = results.filter(r => r.success);
    const fastest = successful.reduce((prev, curr) =>
        curr.latency < prev.latency ? curr : prev
    ).platform;

    const avgLatency: Record<PlatformName, number> = {} as any;
    results.forEach(r => {
        avgLatency[r.platform] = r.latency;
    });

    return { results, fastest, avgLatency };
};

/**
 * 导出对比报告为 Markdown
 */
export const exportReportAsMarkdown = (report: ComparisonReport): string => {
    const { benchmarks, summary, costComparison } = report;

    let md = '# API 平台对比报告\n\n';
    md += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

    md += '## 📊 综合评估\n\n';
    md += `- **最快平台**: ${PLATFORM_CONFIGS[summary.fastest].displayName}\n`;
    md += `- **最便宜平台**: ${PLATFORM_CONFIGS[summary.cheapest].displayName}\n`;
    md += `- **最可靠平台**: ${PLATFORM_CONFIGS[summary.mostReliable].displayName}\n`;
    md += `- **🏆 综合推荐**: ${PLATFORM_CONFIGS[summary.recommended].displayName}\n\n`;

    md += '## 🚀 性能测试结果\n\n';
    md += '| 平台 | 状态 | 延迟(ms) | 预估成本(¥) | 得分 |\n';
    md += '|------|------|----------|-------------|------|\n';

    benchmarks.forEach(b => {
        const status = b.success ? '✅' : '❌';
        const latency = b.success ? b.latency.toString() : '-';
        const cost = b.cost ? b.cost.toFixed(4) : '-';
        const score = b.result ? `${b.result.score}/${b.result.maxScore}` : '-';

        md += `| ${PLATFORM_CONFIGS[b.platform].displayName} | ${status} | ${latency} | ${cost} | ${score} |\n`;
    });

    md += '\n## 💰 成本对比\n\n';
    md += '| 排名 | 平台 | 单次成本(¥) | 月度成本(¥) | 节省 |\n';
    md += '|------|------|-------------|-------------|------|\n';

    costComparison.forEach((c, i) => {
        const monthlyCost = (c.estimatedCost * 6000).toFixed(2); // 假设月评6000份
        const savings = c.savings > 0 ? `省¥${(c.savings * 6000).toFixed(2)}` : '-';
        md += `| ${i + 1} | ${PLATFORM_CONFIGS[c.platform].displayName} | ${c.estimatedCost.toFixed(4)} | ${monthlyCost} | ${savings} |\n`;
    });

    md += '\n## 📝 详细数据\n\n';

    benchmarks.filter(b => b.success && b.result).forEach(b => {
        md += `### ${PLATFORM_CONFIGS[b.platform].displayName}\n\n`;
        md += `- 延迟: ${b.latency}ms\n`;
        md += `- 成本: ¥${b.cost?.toFixed(4)}\n`;
        if (b.result) {
            md += `- 评分: ${b.result.score}/${b.result.maxScore}\n`;
            md += `- 评语: ${b.result.comment.substring(0, 100)}...\n`;
        }
        md += '\n';
    });

    return md;
};
