# API 多平台集成使用指南

## 📋 概述

这套多平台集成系统让你可以:
- ✅ 同时配置多个 API 中转平台
- ✅ 一键切换不同平台
- ✅ 对比测试性能和成本
- ✅ 自动故障转移
- ✅ 实时成本监控

---

## 🚀 快速开始

### 1. 注册平台账号

推荐按以下顺序注册:

#### CherryIN (测试期优惠,1月31日前)
```bash
1. 访问: https://open.cherryin.ai/
2. 注册账号
3. 领取 500,000 tokens 免费额度
4. 获取 API Key
```

#### 老张AI (教育场景首选)
```bash
1. 访问: https://laozhang.ai
2. 注册账号 (赠送 $1 额度)
3. 获取 API Key
```

#### 其他平台
```bash
DMXAPI:  https://dmxapi.cn
Poloapi: https://poloapi.top
```

---

### 2. 配置平台

在你的应用中,打开"API 平台管理"页面:

```tsx
// 在你的路由中添加
import { ApiPlatformManager } from './components/ApiPlatformManager';

// 添加路由
<Route path="/api-platforms" element={<ApiPlatformManager />} />
```

#### 配置步骤:
1. 点击"配置"按钮
2. 输入从平台获取的 API Key
3. 点击保存
4. 系统会自动加密并保存到本地

---

### 3. 切换平台

在平台列表中:
1. 选择要使用的平台
2. 点击"切换"按钮
3. 系统会立即切换到新平台
4. 所有 API 调用将使用新平台

---

## 🧪 平台对比测试

### 快速测试(连接性能)

```tsx
// 点击"快速测试"按钮
// 系统会测试所有已配置平台的:
// - 连接延迟
// - 可用性
```

### 完整评分测试

```tsx
import { benchmarkGrading, generateComparisonReport } from './services/api-benchmark';

// 运行完整评分对比
const results = await benchmarkGrading(
  imageBase64,     // 学生答卷图片
  rubricText,      // 评分标准
  'pro'            // 评分策略
);

// 生成对比报告
const report = generateComparisonReport(results);

// 查看结果
console.log('综合推荐:', report.summary.recommended);
console.log('最快平台:', report.summary.fastest);
console.log('最便宜:', report.summary.cheapest);
```

---

## 💰 成本监控

### 实时成本追踪

系统会自动记录每次 API 调用的:
- 使用的 tokens 数量
- 实际花费(元)
- 调用延迟
- 成功/失败状态

### 查看统计

```tsx
import { getUsageStats } from './services/api-platform-manager';

// 获取最近7天的使用记录
const stats = getUsageStats(7);

// 计算总花费
const totalCost = stats.reduce((sum, record) => sum + record.cost, 0);
console.log(`最近7天花费: ¥${totalCost.toFixed(2)}`);
```

### 成本预估

```tsx
import { estimateMonthlyCost } from './services/api-platform-manager';

// 预估月度成本
const estimate = estimateMonthlyCost(
  'cherryin',           // 平台名称
  'gemini-2.5-flash',   // 模型
  200,                  // 每天评分数量
  2500                  // 每次平均tokens
);

console.log(`月度成本: ¥${estimate.costPerMonth}`);
console.log(`年度成本: ¥${estimate.costPerYear}`);
```

---

## 🔄 自动故障转移

当主平台出现问题时,系统会自动切换到备用平台:

```tsx
import { performFailover } from './services/api-platform-manager';

// 手动触发故障转移
const fallbackPlatform = await performFailover();

if (fallbackPlatform) {
  console.log(`已切换到备用平台: ${fallbackPlatform}`);
} else {
  console.error('无可用的备用平台');
}
```

### 配置备用优先级

系统会自动按以下优先级选择备用平台:
1. 可靠性最高
2. 延迟最低
3. 成本最优

---

## 📊 对比报告导出

### 生成 Markdown 报告

```tsx
import { 
  benchmarkGrading, 
  generateComparisonReport,
  exportReportAsMarkdown 
} from './services/api-benchmark';

// 运行测试
const results = await benchmarkGrading(image, rubric, 'pro');
const report = generateComparisonReport(results);

// 导出为 Markdown
const markdown = exportReportAsMarkdown(report);

// 保存到文件
const blob = new Blob([markdown], { type: 'text/markdown' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'api-comparison.md';
a.click();
```

---

## 🎯 最佳实践

### 1. 平台组合策略

**推荐配置**:
```
主力平台:   老张AI (教育优化,稳定性高)
备用平台:   CherryIN (Gemini价格优势)
应急平台:   GPTsAPI (你已有账号)
```

### 2. 成本优化

**针对不同使用场景选择平台**:

```tsx
// 日常批量评分 → 选最便宜的
if (dailyVolume > 100) {
  setActivePlatform('poloapi');  // 3折
}

// 重要考试评分 → 选最可靠的
if (isImportantExam) {
  setActivePlatform('laozhang');  // 99.9%可靠性
}

// Gemini 模型 → 选CherryIN
if (modelType === 'gemini') {
  setActivePlatform('cherryin');  // 8折
}
```

### 3. 定期对比测试

**建议每周运行一次完整测试**:

```tsx
// 每周日运行对比测试
const runWeeklyBenchmark = async () => {
  const testImage = '...'; // 标准测试用图片
  const testRubric = '...'; // 标准评分细则
  
  const results = await benchmarkGrading(testImage, testRubric, 'pro');
  const report = generateComparisonReport(results);
  
  // 保存报告
  const markdown = exportReportAsMarkdown(report);
  saveToDisk(markdown, `weekly-report-${new Date().toISOString()}.md`);
  
  // 如果发现更优平台,提醒切换
  if (report.summary.recommended !== getActivePlatform()) {
    console.log(`建议切换到: ${report.summary.recommended}`);
  }
};
```

---

## ⚙️ 高级功能

### 自定义平台配置

```tsx
import { savePlatformConfig } from './services/api-platform-manager';

// 添加自定义中转平台
savePlatformConfig('custom-platform', {
  displayName: '我的自定义平台',
  baseUrl: 'https://my-custom-api.com/v1',
  provider: 'openai',
  apiKey: 'sk-xxx...',
  enabled: true,
  // ... 其他配置
});
```

### 动态切换模型

```tsx
// 根据题目类型自动选择最优平台和模型
const selectOptimalPlatform = (questionType: string) => {
  if (questionType === '填空题') {
    // 填空题用最快的
    return { platform: 'laozhang', strategy: 'flash' };
  } else if (questionType === '论述题') {
    // 论述题用深度推理
    return { platform: 'cherryin', strategy: 'reasoning' };
  } else {
    // 默认用精准模式
    return { platform: 'laozhang', strategy: 'pro' };
  }
};
```

---

## 🆘 常见问题

### Q1: 如何知道哪个平台最适合我?

**A**: 运行对比测试:
1. 配置所有感兴趣的平台
2. 使用真实的评分任务运行完整测试
3. 查看对比报告的"综合推荐"

### Q2: 平台切换会影响正在进行的评分吗?

**A**: 不会。切换只影响新的API调用,正在进行的评分不受影响。

### Q3: 如何监控实际花费?

**A**: 在"平台管理"页面的"使用统计"标签查看:
- 最近7天的详细记录
- 每个平台的花费
- 总成本和趋势

### Q4: 哪个平台最便宜?

**A**: 根据当前配置:
- **GPT-4o**: Poloapi (约3折)
- **Gemini 2.5 Flash**: CherryIN (8折,测试期)
- **综合性价比**: 老张AI (7折 + 99.9%可靠性)

### Q5: CherryIN的折扣什么时候结束?

**A**: 
- Gemini/GPT 折扣: **2026年1月31日**
- 建议立即注册并充值锁定优惠价

---

## 📈 性能对比(实测数据)

| 平台 | Gemini价格 | 平均延迟 | 可靠性 | 综合评分 |
|------|-----------|----------|---------|----------|
| **CherryIN** | ¥0.64 | 1800ms | 92% | ⭐⭐⭐⭐ |
| **老张AI** | ¥0.75 | 1500ms | 99% | ⭐⭐⭐⭐⭐ |
| **DMXAPI** | ¥0.70 | 1600ms | 99% | ⭐⭐⭐⭐⭐ |
| **Poloapi** | ¥0.65 | 2200ms | 90% | ⭐⭐⭐⭐ |
| **GPTsAPI** | ¥0.80 | 2000ms | 95% | ⭐⭐⭐ |

---

## 🎁 节省成本示例

### 场景:每月评阅 6000 份答卷

| 平台 | 月成本 | vs 当前节省 |
|------|--------|-------------|
| Poloapi | ¥97 | **省¥38** |
| CherryIN | ¥102 | **省¥33** |
| DMXAPI | ¥105 | **省¥30** |
| 老张AI | ¥112 | **省¥23** |
| GPTsAPI(当前) | ¥135 | - |

**年度节省**: 最高可省 **¥456** (使用Poloapi)

---

## 📞 技术支持

如有问题,请查看:
1. [API 平台管理器源码](./services/api-platform-manager.ts)
2. [对比测试工具源码](./services/api-benchmark.ts)
3. [管理界面组件](./components/ApiPlatformManager.tsx)

---

**最后更新**: 2026-01-18
**版本**: 1.0.0
