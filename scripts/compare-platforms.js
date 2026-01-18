#!/usr/bin/env node

/**
 * API 平台快速对比脚本
 * 用于命令行快速对比不同平台的性能和成本
 */

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║           API 平台对比分析报告                             ║
║           生成时间: ${new Date().toLocaleString('zh-CN').padEnd(20)}                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

// 平台配置数据
const platforms = {
    'GPTsAPI (当前)': {
        geminiPrice: 0.80,
        gptPrice: 4.5,
        reliability: 0.95,
        latency: 2000,
        features: ['✓ Gemini', '✓ Claude', '✓ 流式输出']
    },
    'CherryIN (测试期)': {
        geminiPrice: 0.64,  // 8折 (最优)
        gptPrice: 4.0,      // 9折
        reliability: 0.92,
        latency: 1800,
        features: ['✓ Gemini', '✓ Claude', '✓ 500k免费tokens', '⚠️ 1月31日折扣结束']
    },
    '老张AI (教育优惠)': {
        geminiPrice: 0.75,  // 7折
        gptPrice: 3.2,
        reliability: 0.99,  // 99.9%
        latency: 1500,
        features: ['✓ Gemini', '✓ Claude', '✓ 教育场景优化', '✓ 支持发票']
    },
    'DMXAPI (企业级)': {
        geminiPrice: 0.70,  // 6.8折
        gptPrice: 3.0,
        reliability: 0.99,
        latency: 1600,
        features: ['✓ 300+模型', '✓ 企业SLA', '✓ 全人工客服', '✓ 支持发票']
    },
    'Poloapi (性价比)': {
        geminiPrice: 0.65,  // 约6折
        gptPrice: 2.7,      // 3折
        reliability: 0.90,
        latency: 2200,
        features: ['✓ 极致性价比', '✓ 主流模型']
    }
};

// 计算月度成本
const dailyGradings = 200;
const tokensPerGrading = 2500;
const monthlyTokens = dailyGradings * tokensPerGrading * 30;

console.log(`
📊 性能对比 (Gemini 2.5 Flash)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

const comparisons = Object.entries(platforms).map(([name, config]) => {
    const monthlyCost = (monthlyTokens / 1_000_000) * config.geminiPrice;
    const yearlyCost = monthlyCost * 12;

    return {
        name,
        ...config,
        monthlyCost,
        yearlyCost
    };
}).sort((a, b) => a.monthlyCost - b.monthlyCost);

// 打印性能对比表
console.log('平台名称'.padEnd(25) + '价格(¥/M)'.padEnd(12) + '延迟(ms)'.padEnd(12) + '可靠性'.padEnd(10));
console.log('─'.repeat(60));

comparisons.forEach(p => {
    const name = p.name.padEnd(25);
    const price = `¥${p.geminiPrice.toFixed(2)}`.padEnd(12);
    const latency = `${p.latency}ms`.padEnd(12);
    const reliability = `${(p.reliability * 100).toFixed(1)}%`.padEnd(10);

    console.log(name + price + latency + reliability);
});

console.log(`
💰 成本对比 (每天评200份,每份2500 tokens)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

console.log('排名  平台名称'.padEnd(27) + '月成本'.padEnd(12) + '年成本'.padEnd(12) + 'vs 最贵节省'.padEnd(15));
console.log('─'.repeat(65));

const maxCost = comparisons[comparisons.length - 1].monthlyCost;

comparisons.forEach((p, i) => {
    const rank = `${i + 1}.`.padEnd(6);
    const name = p.name.padEnd(21);
    const monthly = `¥${p.monthlyCost.toFixed(2)}`.padEnd(12);
    const yearly = `¥${p.yearlyCost.toFixed(2)}`.padEnd(12);
    const savings = (maxCost - p.monthlyCost) * 12;
    const savingsText = savings > 0 ? `省¥${savings.toFixed(2)}/年` : '-';

    console.log(rank + name + monthly + yearly + savingsText);
});

console.log(`
🏆 综合评估
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// 找出各项最佳
const fastest = comparisons.reduce((prev, curr) =>
    curr.latency < prev.latency ? curr : prev
);

const cheapest = comparisons[0]; // 已按成本排序

const mostReliable = comparisons.reduce((prev, curr) =>
    curr.reliability > prev.reliability ? curr : prev
);

// 综合评分 (成本40% + 速度30% + 可靠性30%)
const scored = comparisons.map(p => {
    const costScore = (1 - (p.monthlyCost / maxCost)) * 0.4;
    const speedScore = (1 - (p.latency / 2500)) * 0.3;
    const reliabilityScore = p.reliability * 0.3;

    return {
        ...p,
        totalScore: costScore + speedScore + reliabilityScore
    };
}).sort((a, b) => b.totalScore - a.totalScore);

const recommended = scored[0];

console.log(`最快平台:   ${fastest.name} (${fastest.latency}ms)`);
console.log(`最便宜:     ${cheapest.name} (¥${cheapest.geminiPrice}/M)`);
console.log(`最可靠:     ${mostReliable.name} (${(mostReliable.reliability * 100).toFixed(1)}%)`);
console.log(`\n🏅 综合推荐: ${recommended.name}`);
console.log(`   理由: 在成本、速度、可靠性三方面取得最佳平衡`);

console.log(`
📋 平台特性对比
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

Object.entries(platforms).forEach(([name, config]) => {
    console.log(`\n${name}:`);
    config.features.forEach(f => console.log(`  ${f}`));
});

console.log(`
💡 使用建议
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 主力平台推荐: ${recommended.name}
   - 原因: 综合性价比最高
   - 适合: 日常批量评分

2. 备用平台推荐: ${mostReliable.name}
   - 原因: 可靠性最高
   - 适合: 重要考试、应急使用

3. 成本优化建议:
   - Gemini模型 → 使用 CherryIN (8折,但1月31日前)
   - GPT模型 → 使用 Poloapi (3折)
   - 需要发票 → 使用 老张AI 或 DMXAPI

4. 立即行动:
   ⚠️  CherryIN 测试期折扣将于 2026-01-31 结束
   💡 建议立即注册并充值锁定优惠价
   🎁 新用户可获 500,000 tokens 免费额度

5. 多平台策略:
   - 主力: 老张AI (稳定+教育优化)
   - 备用: CherryIN (Gemini性价比)
   - 应急: GPTsAPI (已有账号)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💾 如需导出完整报告,请在前端使用 ApiPlatformManager 组件
📖 详细使用指南请查看: API_PLATFORM_GUIDE.md

`);

// 计算实际节省
const currentCost = comparisons.find(p => p.name.includes('GPTsAPI'))?.monthlyCost || 0;
const bestCost = cheapest.monthlyCost;
const yearlySavings = (currentCost - bestCost) * 12;

console.log(`
💵 节省预估 (切换到最便宜平台)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

当前月成本:    ¥${currentCost.toFixed(2)}
优化后月成本:  ¥${bestCost.toFixed(2)}
每月节省:      ¥${(currentCost - bestCost).toFixed(2)}

年度节省:      ¥${yearlySavings.toFixed(2)} 🎉

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

console.log('报告生成完毕!\n');
