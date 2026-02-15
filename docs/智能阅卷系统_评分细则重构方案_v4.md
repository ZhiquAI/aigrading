# 评分细则全学科适配重构方案 (v4.1)

**版本**: v4.1  
**日期**: 2026-02-10  
**状态**: 实施中（V3兼容闭环）

---

## 1. 项目目标

构建一套通用的 AI 阅卷配置框架，通过"配置驱动"的方式，支持 K12 全学科、全题型的评分细则生成，同时支持教师个性化规则注入。

> [!IMPORTANT]
> **核心策略**：扩展而非替换。保留现有 `rubric-v3.ts` 的 Schema，新增兼容字段。

---

## 2. 核心架构

### 2.1 双脑模型

| 模块 | 职责 | 关键技术 |
|------|------|----------|
| **后端 (Brain)** | 通过 PromptFactory 动态组装 AI 指令 | 学科策略注入 + 教师规则覆盖 |
| **前端 (Face)** | 通过 AdaptiveUI 多态组件渲染 | 根据 `strategyType` 切换编辑器 |

### 2.2 数据流

```
用户选择学科/题型 + 上传图片 + 输入个性化规则
         ↓
    PromptFactory.build()
         ↓
    AI 生成 RubricJSON v3
         ↓
    前端多态渲染 + 教师微调
         ↓
    保存至数据库
```

---

## 3. 后端实现

### 3.1 新增 PromptFactory 模块

**文件**: `aigradingbackend/src/lib/PromptFactory.ts`

```typescript
interface PromptContext {
  subject: string;
  questionType?: string;
  totalScore?: number;
  customRules?: string[];  // 教师个性化规则
}

export class PromptFactory {
  static build(ctx: PromptContext): string {
    let prompt = this.getBasePrompt(ctx);
    
    // 1. 教师规则优先注入 (最高优先级)
    if (ctx.customRules?.length) {
      prompt += this.injectCustomRules(ctx.customRules);
    }
    
    // 2. 学科特化规则
    prompt += this.getSubjectRules(ctx.subject);
    
    // 3. 输出格式约束
    prompt += this.getOutputFormat();
    
    return prompt;
  }
  
  private static getSubjectRules(subject: string): string {
    // STEM 学科
    if (['数学', '物理', '化学', '生物'].includes(subject)) {
      return `
# STEM Rules
1. LaTeX: 公式变量用 "$" 包裹 (e.g., $x^2$)
2. Step-by-Step: 计算题拆解为 [公式] -> [过程] -> [结果]
3. Units: 检查单位
`;
    }
    
    // 语言学科
    if (['语文', '英语'].includes(subject)) {
      return `
# Language Rules
1. Exact Match: 客观题、古诗文严抓错别字
2. Composition: 作文采用"分档评分 + 扣分项"策略
`;
    }
    
    // 人文社科
    return `
# Humanities Rules
1. Proper Nouns: 专有名词精确匹配
2. Logic: 综合题自动识别子问题并分组
`;
  }
  
  private static injectCustomRules(rules: string[]): string {
    return `
# ⚠️ TEACHER OVERRIDES (Highest Priority)
教师指定了以下特殊阅卷标准，请将其转化为约束条件：
${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
  }
}
```

### 3.2 修改 API 端点

**文件**: `aigradingbackend/src/app/api/ai/rubric/route.ts`

新增请求参数：

```typescript
interface GenerateRubricRequest {
  questionImage?: string;
  answerImage?: string;
  answerText?: string;
  questionId?: string;
  subject?: string;
  questionType?: string;
  examName?: string;
  // 新增
  customRules?: string[];  // 教师个性化规则
  totalScore?: number;     // 题目总分
}
```

### 3.3 扩展 V3 Schema

**文件**: `aigradingbackend/src/lib/rubric-v3.ts`

新增可选 `uiHints` 字段：

```typescript
export const UIHintsSchema = z.object({
  renderType: z.enum(['badge', 'formula', 'checklist', 'deduction']).optional(),
  matchMode: z.enum(['exact', 'semantic', 'manual']).optional(),
  color: z.string().optional()
}).strict().optional();

// 在 PointSchema 中新增
uiHints: UIHintsSchema
```

---

## 4. 前端实现

### 4.1 高级设置面板

**文件**: `aigradingfrontend/src/components/v2/rubric/AdvancedRulesPanel.tsx`

```tsx
const QUICK_RULES = [
  { label: '严抓字数', rule: '字数不足600字扣分' },
  { label: '严抓卷面', rule: '卷面潦草扣1-3分' },
  { label: '无标题扣分', rule: '无标题扣2分' }
];

export const AdvancedRulesPanel: React.FC<Props> = ({ 
  customRules, 
  onChange, 
  showAdvanced, 
  onToggle 
}) => (
  <div className="space-y-3">
    <button onClick={onToggle} className="text-xs text-indigo-600 font-bold">
      {showAdvanced ? '收起' : '展开'} 高级设置
    </button>
    
    {showAdvanced && (
      <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
        <textarea
          value={customRules}
          onChange={(e) => onChange(e.target.value)}
          placeholder="输入特殊规则，例如：字数不足300字不及格"
          className="w-full h-24 text-sm bg-white border rounded-lg p-2"
        />
        <div className="flex gap-2 mt-2">
          {QUICK_RULES.map(({ label, rule }) => (
            <Chip key={label} onClick={() => addRule(rule)}>{label}</Chip>
          ))}
        </div>
      </div>
    )}
  </div>
);
```

### 4.2 修改创建向导

**文件**: `aigradingfrontend/src/components/v2/views/CreateRubricWizard.tsx`

1. 新增状态：
```typescript
const [customRules, setCustomRules] = useState<string>('');
const [showAdvanced, setShowAdvanced] = useState(false);
```

2. 调用 API（替换 TODO）：
```typescript
const response = await fetch(`${API_BASE}/api/ai/rubric`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    questionImage,
    answerImage,
    subject,
    questionType,
    questionId: questionNo,
    customRules: customRules.split('\n').filter(Boolean)
  })
});
```

---

## 5. 实施计划

| 阶段 | 时间 | 内容 | 产出 |
|------|------|------|------|
| **Phase 1** | 2-3h | 创建 `PromptFactory.ts`，重构 API | 后端支持学科策略 + 自定义规则 |
| **Phase 2** | 2-3h | 前端高级设置面板 + API 对接 | 完成创建向导功能 |
| **Phase 3** | 待定 | UI 多态渲染优化 | 按需引入 LaTeX |
| **Phase 4** | 1h | 集成测试 | 测试报告 |

---

## 6. 验证清单

- [ ] 历史学科综合题生成
- [ ] 物理计算题（公式识别）
- [ ] 教师个性化规则（如"字数<300不及格"）生效
- [ ] 旧数据兼容性（无 `uiHints` 字段正常工作）

---

## 7. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| AI 输出格式不稳定 | 使用 `response_format: json_object` + Zod 校验 |
| 旧数据不兼容 | `uiHints` 设为可选字段 |
| LaTeX 包体积大 | 暂不引入，后续按需动态加载 |
