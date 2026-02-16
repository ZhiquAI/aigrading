# **智能阅卷系统模块一：评分细则设置重构方案 (v2.0)**

> [!WARNING]
> **状态说明（2026-02-10）**：该文档已归档为历史方案。当前实施以 `智能阅卷系统_评分细则重构方案_v4.md`（v4.1）为准，统一采用 RubricJSON v3 单协议。

## **0\. 项目背景与模块概览**

本项目旨在构建一个全流程的智能阅卷系统，共包含以下四个核心模块：

1. **评分细则设置 (Rubric Settings)**：本方案重点。负责多学科、多题型的评分标准生成与配置。  
2. **智能阅卷 (Intelligent Grading)**：基于细则对学生答卷进行批量识别与打分。  
3. **得分详情 (Score Details)**：展示阅卷结果、数据分析与学情报告。  
4. **系统设置 (System Settings)**：用户管理、权限配置与全局参数。

**本文档仅针对“模块一：评分细则设置”进行全学科适配与个性化规则的重构设计。**

## **1\. 核心架构理念 (模块一)**

本模块旨在构建一个“双脑”阅卷规则生成器：

* **左脑 (通用逻辑)**：基于学科和题型的标准评分策略（如物理找公式、历史找观点）。  
* **右脑 (个性化逻辑)**：基于教师输入的自然语言规则（如“字数不够扣分”、“必须引用名言”），通过 AI 语义转译执行。

## **2\. 通用数据协议 (Universal Data Schema)**

### **2.1 API 请求结构 (Frontend \-\> Backend)**

新增 custom\_rules 字段，允许前端透传老师的个性化要求。

// shared/requests.ts

export interface GradingRequest {  
  // \--- 基础元数据 \---  
  subject: string;       // e.g. '语文', '物理'  
  questionType: string;  // e.g. 'composition', 'calculation'  
  totalScore: number;    // e.g. 50  
    
  // \--- 核心数据 \---  
  images: string\[\];      // Base64 图片数组  
    
  // \--- 🌟 新增：教师个性化规则 \---  
  // e.g. \["字数\<300字不及格", "错别字每3个扣1分"\]  
  custom\_rules?: string\[\];   
}

### **2.2 评分细则响应结构 (Backend \-\> Frontend)**

AI 返回的标准 JSON，用于驱动前端渲染。

// shared/responses.ts

export interface RubricItem {  
  id: string;  
  group?: string;         // 分组 (用于综合题)  
  content: string;        // 描述 (支持 LaTeX)  
  score: number;          // 分值 (负数代表扣分)  
    
  // UI 渲染模式  
  ui\_type: 'badge' | 'formula' | 'checklist' | 'deduction' | 'logic\_check';   
    
  // 匹配模式  
  match\_mode: 'exact' | 'semantic' | 'manual';   
    
  // 辅助字段  
  keywords?: string\[\];  
  check\_points?: string\[\];  
  score\_cap?: number;     // 分数上限 (用于字数不足等情况)  
}

## **3\. 后端核心：增强型提示词工厂 (Enhanced Prompt Factory)**

这是重构的重中之重。我们在原有的学科逻辑之上，增加了 **"Teacher Override Injection" (教师指令注入)** 模块。

// backend/lib/PromptFactory.ts

import { GradingRequest } from '../../shared/requests';

export class PromptFactory {  
  static build(req: GradingRequest): string {  
    const { subject, questionType, totalScore, customRules } \= req;

    // 1\. 基础角色设定  
    let prompt \= \`  
\# Role  
你是一位资深的${subject}阅卷组长。  
任务：根据【试题图片】、【参考答案】以及【教师个性化要求】，生成结构化的评分细则。  
总分：${totalScore}分。

\# Global Constraints  
\- Format: 必须严格输出 JSON。  
\- Atomization: 将答案拆解为独立的得分点。  
\`;

    // \==========================================  
    // 🌟 MODULE A: 教师个性化规则注入 (最高优先级)  
    // \==========================================  
    if (customRules && customRules.length \> 0\) {  
      prompt \+= \`  
\# ⚠️ TEACHER OVERRIDES (Highest Priority)  
教师指定了以下特殊阅卷标准，请将其转化为逻辑检查点 (Logic Checks) 或 扣分项 (Deductions)。  
这些规则的优先级高于通用学科规则。

${customRules.map((rule, i) \=\> \`${i+1}. ${rule}\`).join('\\n')}

Translation Guide for AI:  
\- 遇到 "字数 \< N，分值 \< M"：生成 type="logic\_check"，并标注 score\_cap=M。  
\- 遇到 "无内容给 X 分"：生成 type="exact"，content="仅写题目无正文"。  
\- 遇到 "扣分" 规则：生成 type="deduction"，score 为负数。  
\- 遇到 "均分" 建议：请在 question\_summary 中备注基准分范围。  
\`;  
    }

    // \==========================================  
    // MODULE B: 学科特化规则 (Subject Rules)  
    // \==========================================  
      
    // \>\>\> 理科 (STEM)  
    if (\['数学', '物理', '化学', '生物'\].includes(subject)) {  
      prompt \+= \`  
\# STEM Rules  
1\. LaTeX: 公式变量用 "$" 包裹 (e.g., $x^2$).  
2\. Step-by-Step: 计算题拆解为 \[公式\] \-\> \[过程\] \-\> \[结果\].  
3\. Units: 检查单位。  
\`;  
    }

    // \>\>\> 语言 (Languages)  
    if (\['语文', '英语'\].includes(subject)) {  
      prompt \+= \`  
\# Language Rules  
1\. Exact Match: 客观题、古诗文严抓错别字。  
2\. Composition: 作文采用"分档评分 \+ 扣分项"策略。  
\`;  
    }

    // \>\>\> 人文社科 (Humanities)  
    if (\['历史', '地理', '道法', '政治'\].includes(subject)) {  
      prompt \+= \`  
\# Humanities Rules  
1\. Proper Nouns: 专有名词精确匹配。  
2\. Logic: 综合题自动识别子问题并分组。  
\`;  
    }

    // \==========================================  
    // MODULE C: 题型逻辑 (Type Logic)  
    // \==========================================  
    switch (questionType) {  
      case 'composition':   
      case 'essay':  
        prompt \+= \`  
\# Task: Essay Grading  
\- 生成主要维度的基准分。  
\- 必须 包含上述 Teacher Overrides 中的扣分规则。  
\`;  
        break;

      case 'composite':  
        prompt \+= \`  
\# Task: Auto-Decomposition  
\- 自动识别子问题 (1)(2)... 并通过 "group" 字段分组。  
\`;  
        break;  
          
      default:  
        prompt \+= \`\# Task: General Analysis\\n提取核心得分点。\\n\`;  
    }

    // 4\. 输出格式定义  
    prompt \+= \`  
\# Output Format (Strict JSON)  
{  
  "question\_summary": "题目概括及基准分建议",  
  "rubrics": \[  
    {  
      "group": "可选：分组标题",  
      "content": "描述",  
      "score": number,  
      "ui\_type": "badge" | "formula" | "checklist" | "deduction" | "logic\_check",  
      "match\_mode": "exact" | "semantic",  
      "score\_cap": number // 仅用于分数封顶规则  
    }  
  \]  
}  
\`;  
    return prompt;  
  }  
}

## **4\. 前端交互升级：个性化配置入口**

在 EnhancedGradingConfig.tsx 中，我们需要增加一个折叠区域，让老师输入这些“魔法规则”。

### **4.1 UI 交互设计**

1. **位置：** 在“开始生成”按钮上方，增加一个折叠面板 **"高级设置：个性化评分规则"**。  
2. **输入方式：** 提供多行文本框 (Textarea)，支持换行输入多条规则。  
3. **快捷指令 (Quick Chips)：** 文本框下方提供常用规则 Tag，点击即可填入。  
   * \[严抓字数\] \-\> 自动填入 "字数每少50字扣1分"  
   * \[严抓卷面\] \-\> 自动填入 "卷面潦草扣1-3分"  
   * \[鼓励创新\] \-\> 自动填入 "观点新颖额外加1-2分"

### **4.2 核心代码片段 (React)**

// frontend/components/ConfigPanel.tsx

const \[customRules, setCustomRules\] \= useState('');

// ...

{/\* 高级设置区域 \*/}  
\<div className="mb-6"\>  
  \<button   
    onClick={() \=\> setShowAdvanced(\!showAdvanced)}  
    className="flex items-center text-xs text-indigo-600 font-bold mb-2 hover:underline"  
  \>  
    {showAdvanced ? \<ChevronUp size={12}/\> : \<ChevronDown size={12}/\>}  
    \<span className="ml-1"\>高级设置：个性化评分规则\</span\>  
  \</button\>  
    
  {showAdvanced && (  
    \<div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100"\>  
      \<textarea  
        value={customRules}  
        onChange={(e) \=\> setCustomRules(e.target.value)}  
        placeholder="在此输入您的特殊要求，例如： 1\. 字数不足300字不及格 2\. 错别字每3个扣1分"  
        className="w-full text-sm bg-white border border-indigo-200 rounded-lg p-2 h-24 focus:ring-2 focus:ring-indigo-200 outline-none resize-none"  
      /\>  
      \<div className="flex gap-2 mt-2"\>  
        \<Chip onClick={() \=\> addRule("无标题扣2分")}\>无标题扣2分\</Chip\>  
        \<Chip onClick={() \=\> addRule("字数不足600扣分")}\>严抓字数\</Chip\>  
      \</div\>  
    \</div\>  
  )}  
\</div\>

// ... 发送请求时包含 customRules.split('\\n')

## **5\. 实施路线图 (Implementation Roadmap)**

1. **Day 1: 基础框架搭建**  
   * 搭建前后端项目结构。  
   * 实现 PromptFactory 的通用部分。  
   * 集成 Google Gemini SDK。  
2. **Day 2: 核心学科适配**  
   * 实现 **历史/物理/英语** 三大学科的特化逻辑 (Prompt 分支)。  
   * 开发前端 AdaptiveRubricCard 组件 (支持 LaTeX 和 Checklist)。  
3. **Day 3: 个性化规则引擎**  
   * 升级 PromptFactory 支持 custom\_rules 注入。  
   * 前端增加“高级设置”面板。  
   * **测试用例：** 输入语文作文个性化规则，验证 AI 是否生成了对应的 logic\_check 条目。  
4. **Day 4: 综合联调**  
   * 上传一套包含“数学公式”、“历史综合题”、“英语作文”的混合试卷进行压力测试。  
   * 微调 UI 细节（Loading 状态、错误提示）。
