# **智能阅卷系统：全学科适配重构方案 (v1.0)**

## **1\. 项目愿景与核心架构**

**目标**：构建一套通用的 AI 阅卷配置框架，通过“配置驱动”的方式，支持 K12 全学科、全题型的评分细则生成。

**核心理念**：

* **后端 (Brain)**：通过 PromptFactory 动态组装指令，让通用大模型（Gemini）扮演不同学科的专家。  
* **前端 (Face)**：通过 AdaptiveUI 多态组件，根据数据类型自动切换渲染模式（公式、列表、标签、扣分项）。

## **2\. 通用数据协议 (Universal Data Schema)**

这是前后端交互的契约，定义了系统如何理解“题型”和“评分细则”。

### **2.1 全局配置映射 (Frontend/Backend Shared)**

定义学科与题型的对应关系，以及触发的 AI 策略。

// shared/config.ts

export const SUBJECT\_CONFIG \= {  
  // \--- 语言类 \---  
  '语文': {  
    icon: 'BookOpen',  
    types: \[  
      { id: 'reading', label: '阅读理解', strategy: 'semantic' },  
      { id: 'composition', label: '作文 (分档评分)', strategy: 'categorized\_deduction' },  
      { id: 'classical', label: '古诗文/基础', strategy: 'exact\_match' }  
    \]  
  },  
  '英语': {  
    icon: 'Globe',  
    types: \[  
      { id: 'objective', label: '客观题 (听力/选择)', strategy: 'exact\_match' },  
      { id: 'completion', label: '填空/词汇', strategy: 'exact\_grammar' },  
      { id: 'essay', label: '书面表达 (作文)', strategy: 'dimension\_deduction' }  
    \]  
  },  
    
  // \--- 理科类 (STEM) \---  
  '数学': {  
    icon: 'Sigma',  
    types: \[  
      { id: 'calculation', label: '计算/代数', strategy: 'step\_formula' },  
      { id: 'geometry', label: '几何证明', strategy: 'step\_logic' },  
      { id: 'function', label: '函数/综合', strategy: 'step\_logic' }  
    \]  
  },  
  '物理': {  
    icon: 'Zap',  
    types: \[  
      { id: 'calculation', label: '计算题', strategy: 'step\_formula' },  
      { id: 'experiment', label: '实验探究', strategy: 'keyword\_logic' },  
      { id: 'drawing', label: '作图题', strategy: 'visual\_check' }  
    \]  
  },  
  '化学': {  
    icon: 'FlaskConical',  
    types: \[  
      { id: 'experiment', label: '实验/推断', strategy: 'formula\_logic' }  
    \]  
  },  
  '生物': {  
    icon: 'Dna',  
    types: \[  
      { id: 'diagram', label: '识图填空', strategy: 'exact\_match' },  
      { id: 'experiment', label: '实验探究', strategy: 'keyword\_logic' }  
    \]  
  },

  // \--- 文综类 \---  
  '历史': { icon: 'Scroll', types: getHumanitiesTypes() },  
  '地理': { icon: 'Map', types: getHumanitiesTypes() },  
  '道法': { icon: 'Scale', types: getHumanitiesTypes() }  
};

function getHumanitiesTypes() {  
  return \[  
    { id: 'fact', label: '填空/基础史实', strategy: 'exact\_match' },  
    { id: 'argument', label: '简答/论述', strategy: 'semantic' },  
    { id: 'composite', label: '综合材料题 (自动拆解)', strategy: 'auto\_decompose' }  
  \];  
}

### **2.2 评分细则数据结构 (Rubric Model)**

AI 返回给前端的 JSON 结构。

// shared/types.ts

export interface GradingResponse {  
  question\_summary?: string; // 题目一句话概括  
  rubrics: RubricItem\[\];  
}

export interface RubricItem {  
  id: string;  
  group?: string;         // 分组标题 (用于综合题，如 "第一问：民族觉醒")  
  content: string;        // 核心描述 (支持 LaTeX: $E=mc^2$)  
  score: number;          // 分值 (可以是负数，用于扣分项)  
    
  // 决定前端如何渲染  
  ui\_type: 'badge' | 'formula' | 'checklist' | 'deduction';   
    
  // 决定 AI 如何匹配  
  match\_mode: 'exact' | 'semantic' | 'manual';   
    
  // 辅助字段  
  keywords?: string\[\];    // 关键词  
  synonyms?: string\[\];    // 同义词 (模糊匹配用)  
  negative\_keywords?: string\[\]; // 错敏词 (用于扣分或预警)  
  check\_points?: string\[\];// 检查项 (用于作图题)  
  logic\_operator?: 'AND' | 'OR'; // 逻辑关系  
}

## **3\. 后端核心：全能提示词工厂 (Prompt Factory)**

**核心职责**：将简单的 type 参数翻译成复杂的 Prompt，指导 Gemini 进行思维链推理。

// backend/lib/PromptFactory.ts

interface PromptContext {  
  subject: string;  
  questionType: string;  
  totalScore: number;  
}

export class PromptFactory {  
  static build(ctx: PromptContext): string {  
    const { subject, questionType, totalScore } \= ctx;

    // 1\. 基础角色设定  
    let prompt \= \`  
\# Role & Task  
你是一位拥有20年经验的${subject}阅卷组长。  
请根据【试题图片】和【参考答案】，生成结构化的评分细则 JSON。  
题目总分：${totalScore}分。

\# Global Constraints  
\- Format: 必须严格输出 JSON。  
\- Atomization: 将答案拆解为独立的得分点。  
\`;

    // 2\. 学科特化规则 (Subject Rules)  
      
    // \>\>\> 理科 (STEM)  
    if (\['数学', '物理', '化学', '生物'\].includes(subject)) {  
      prompt \+= \`  
\# STEM Rules  
1\. LaTeX Required: 所有数学公式、变量、数字必须用 LaTeX 格式，包裹在 "$" 中 (e.g., $x^2$, $CO\_2$)。  
2\. Step-by-Step: 计算题拆解为 \[公式\] \-\> \[代入\] \-\> \[结果\]。  
3\. Units: 检查物理/化学单位。  
4\. Formulas: 允许公式变形 (如 I=U/R 等同于 U=IR)。  
\`;  
    }

    // \>\>\> 语言 (Languages)  
    if (\['语文', '英语'\].includes(subject)) {  
      prompt \+= \`  
\# Language Rules  
1\. Exact Match: 客观题、古诗文、单词拼写必须精确匹配。  
2\. Composition: 作文采用"维度基准分 \+ 扣分项"策略。  
\`;  
    }

    // \>\>\> 人文社科 (Humanities)  
    if (\['历史', '地理', '道法', '政治'\].includes(subject)) {  
      prompt \+= \`  
\# Humanities Rules  
1\. Proper Nouns: 专有名词 (人名/地名/术语) 必须精确匹配。  
2\. Semantic Expansion: 对于"意义/影响"类问题，生成 synonyms (同义词)。  
3\. Logic: 综合题自动识别子问题序号并分组。  
\`;  
    }

    // 3\. 题型特化逻辑 (Type Logic)  
    switch (questionType) {  
      // \--- 综合/自动拆解 \---  
      case 'composite':   
        prompt \+= \`  
\# Task: Auto-Decomposition  
\- 识别图片中的子问题 (1), (2)...  
\- 在 JSON 中使用 "group" 字段标记子问题。  
\- 自动判断子题型：填空用 Exact，简答用 Semantic。  
\`;  
        break;

      // \--- 作文/论述 \---  
      case 'composition':   
      case 'essay':  
        prompt \+= \`  
\# Task: Essay Grading  
\- 生成主要维度的基准分 (Base Score)。  
\- 必须生成常见扣分项 (Deductions)，设置 score 为负数，ui\_type="deduction"。  
\`;  
        break;

      // \--- 作图 \---  
      case 'drawing':  
        prompt \+= \`  
\# Task: Visual Inspection  
\- 不要生成关键词。  
\- 生成 type="checklist"，列出关键视觉特征 (e.g. "虚线", "箭头方向")。  
\`;  
        break;  
          
      // \--- 计算 \---  
      case 'calculation':  
        prompt \+= \`  
\# Task: Calculation  
\- 拆解为：公式(30%)、过程(30%)、结果(40%)。  
\- ui\_type="formula"。  
\`;  
        break;

      default:  
        prompt \+= \`\# Task: General Analysis\\n提取核心得分点。\\n\`;  
    }

    // 4\. 输出格式定义  
    prompt \+= \`  
\# Output Format (Strict JSON)  
{  
  "rubrics": \[  
    {  
      "group": "可选：分组标题",  
      "content": "得分点描述",  
      "score": number,  
      "ui\_type": "badge" | "formula" | "checklist" | "deduction",  
      "match\_mode": "exact" | "semantic",  
      "keywords": \["key1"\],  
      "synonyms": \["syn1"\],  
      "check\_points": \["check1"\]  
    }  
  \]  
}  
\`;  
    return prompt;  
  }  
}

## **4\. 前端核心：自适应结果组件 (Adaptive UI)**

**核心职责**：根据后端返回的 ui\_type 和 group，渲染不同的 UI 形态。

**依赖库**：react-latex-next (渲染公式), lucide-react (图标)。

// frontend/components/AdaptiveRubricList.tsx

import React from 'react';  
import 'katex/dist/katex.min.css';  
import Latex from 'react-latex-next';   
import { CheckCircle2, AlertCircle, Calculator, PencilRuler, MinusCircle } from 'lucide-react';

export default function AdaptiveRubricList({ rubrics, totalScore }: any) {  
  // 1\. 数据分组  
  const grouped \= rubrics.reduce((acc: any, item: any) \=\> {  
    const key \= item.group || '通用细则';  
    if (\!acc\[key\]) acc\[key\] \= \[\];  
    acc\[key\].push(item);  
    return acc;  
  }, {});

  return (  
    \<div className="bg-white rounded-xl shadow-sm border border-gray-100"\>  
      {/\* Header \*/}  
      \<div className="p-4 border-b bg-gray-50 flex justify-between"\>  
        \<h3 className="font-bold text-gray-700"\>评分细则预览\</h3\>  
        \<span className="font-mono font-bold text-indigo-600"\>Total: {totalScore}\</span\>  
      \</div\>

      \<div className="p-6 space-y-8"\>  
        {Object.entries(grouped).map((\[group, items\]: any, idx) \=\> (  
          \<div key={group}\>  
            {/\* 分组标题 (综合题显示) \*/}  
            {Object.keys(grouped).length \> 1 && (  
              \<div className="flex items-center gap-2 mb-3"\>  
                \<span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded font-bold"\>Q{idx+1}\</span\>  
                \<span className="font-bold text-sm text-gray-800"\>{group}\</span\>  
              \</div\>  
            )}  
              
            \<div className="space-y-3"\>  
              {items.map((item: any) \=\> \<RubricItemRenderer key={item.id} item={item} /\>)}  
            \</div\>  
          \</div\>  
        ))}  
      \</div\>  
    \</div\>  
  );  
}

// 多态渲染子组件  
function RubricItemRenderer({ item }: any) {  
  // Mode A: 扣分项 (作文/卷面)  
  if (item.ui\_type \=== 'deduction' || item.score \< 0\) {  
    return (  
      \<div className="border border-red-200 bg-red-50/50 rounded-lg p-3 flex gap-3 items-center"\>  
        \<MinusCircle className="text-red-500 shrink-0" size={18} /\>  
        \<div className="flex-grow"\>  
          \<span className="text-sm font-bold text-red-700"\>{item.content}\</span\>  
          \<p className="text-xs text-red-400"\>此项为扣分项\</p\>  
        \</div\>  
        \<div className="font-mono font-bold text-red-600 text-lg"\>{item.score}\</div\>  
      \</div\>  
    );  
  }

  // Mode B: 检查清单 (作图)  
  if (item.ui\_type \=== 'checklist') {  
    return (  
      \<div className="border border-blue-200 bg-blue-50/30 rounded-lg p-3"\>  
        \<div className="flex justify-between mb-2"\>  
          \<div className="flex items-center gap-2"\>  
            \<PencilRuler className="text-blue-500" size={16} /\>  
            \<span className="font-bold text-sm text-gray-700"\>{item.content}\</span\>  
          \</div\>  
          \<span className="font-mono font-bold text-blue-600"\>{item.score}分\</span\>  
        \</div\>  
        \<div className="pl-6 space-y-1"\>  
          {item.check\_points?.map((pt: string, i: number) \=\> (  
            \<div key={i} className="flex items-center gap-2 text-xs text-slate-600"\>  
              \<div className="w-1.5 h-1.5 bg-blue-400 rounded-full"\>\</div\>  
              {pt}  
            \</div\>  
          ))}  
        \</div\>  
      \</div\>  
    );  
  }

  // Mode C: 通用/公式 (支持 LaTeX)  
  const isExact \= item.match\_mode \=== 'exact';  
  return (  
    \<div className={\`border rounded-lg p-3 flex gap-3 ${isExact ? 'border-orange-200 bg-orange-50/20' : 'border-gray-200'}\`}\>  
      \<div className="mt-1"\>  
        {isExact ? \<AlertCircle size={16} className="text-orange-500"/\> : \<CheckCircle2 size={16} className="text-green-500"/\>}  
      \</div\>  
        
      \<div className="flex-grow"\>  
        \<div className="flex justify-between"\>  
          \<div className="text-sm font-bold text-gray-800"\>  
            \<Latex\>{item.content}\</Latex\>  
          \</div\>  
          \<span className="font-mono font-bold text-gray-600"\>{item.score}分\</span\>  
        \</div\>

        \<div className="mt-2 flex flex-wrap gap-2"\>  
          {item.keywords?.map((kw: string, i: number) \=\> (  
            \<span key={i} className="text-xs px-2 py-0.5 rounded border bg-white text-gray-600 font-mono"\>  
              \<Latex\>{kw}\</Latex\>  
            \</span\>  
          ))}  
          {item.synonyms?.map((syn: string, i: number) \=\> (  
            \<span key={i} className="text-xs px-2 py-0.5 rounded border border-dashed border-gray-300 text-gray-400"\>  
              \~ {syn}  
            \</span\>  
          ))}  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

