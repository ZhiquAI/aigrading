# **智能阅卷系统全学科适配重构方案**

## **1\. 核心目标**

构建一个“以不变应万变”的通用框架。

* **后端**：通过工厂模式动态生成不同学科的 AI 指令 (Prompt)。  
* **前端**：通过配置驱动 UI (Config-Driven UI) 和 多态组件 (Polymorphic Component) 适配不同题型的展示。

## **2\. 数据模型重构 (Data Schema)**

### **2.1 全局配置映射表 (Subject Config Map)**

前端和后端共享同一份配置，确保逻辑对齐。

// 定义每个学科支持的题型及对应的 AI 策略 ID  
const SUBJECT\_CONFIG \= {  
  '语文': {  
    types: \[  
      { label: '阅读理解', id: 'reading', strategy: 'semantic' },  
      { label: '作文', id: 'essay', strategy: 'layered' }  
    \]  
  },  
  '历史': {  
    types: \[  
      { label: '基础史实 (填空)', id: 'fact', strategy: 'exact' },  
      { label: '观点论述 (小论文)', id: 'argument', strategy: 'layered\_logic' },  
      { label: '综合材料题 (自动拆解)', id: 'composite', strategy: 'auto\_decompose' }  
    \]  
  },  
  '物理': {  
    types: \[  
      { label: '计算题 (分步)', id: 'calculation', strategy: 'step\_by\_step' },  
      { label: '作图题', id: 'drawing', strategy: 'visual\_check' },  
      { label: '实验探究', id: 'experiment', strategy: 'keyword\_logic' }  
    \]  
  }  
};

### **2.2 评分细则数据结构 (Rubric JSON Schema)**

AI 返回的标准格式，增加了 group 和 ui\_type 字段以支持复杂题型。

interface RubricItem {  
  id: string;  
  group?: string;         // 分组标题，用于综合题 (如 "第一问：民族觉醒")  
  content: string;        // 核心描述  
  score: number;          // 分值  
    
  // 匹配逻辑控制  
  type: 'exact' | 'semantic' | 'checklist' | 'formula';   
  keywords?: string\[\];    // 关键词  
  synonyms?: string\[\];    // 同义词 (用于语义匹配)  
  negative\_keywords?: string\[\]; // 扣分项  
    
  // 复杂逻辑  
  logic\_operator?: 'AND' | 'OR'; // 是必须全对，还是命中其一  
}

## **3\. 后端重构：动态提示词工厂 (The Prompt Factory)**

后端不再是简单的透传，而是“翻译官”。它将前端的 subject \+ type 翻译成 Gemini 能听懂的 System Instruction。

*(详细代码见 PromptFactory.ts)*

## **4\. 前端重构：自适应组件**

### **4.1 智能配置面板 (Smart Config Panel)**

* **级联选择**：选“物理”后，题型下拉框自动变为“计算/作图/实验”。  
* **粘贴支持**：增加 onPaste 监听，支持剪贴板图片直接上传。

### **4.2 多态结果卡片 (Polymorphic Result Card)**

* **渲染器分发**：  
  * type \=== 'exact' \-\> 渲染红色 Badge \+ 关键词。  
  * type \=== 'semantic' \-\> 渲染绿色 Badge \+ 同义词标签。  
  * type \=== 'checklist' \-\> 渲染复选框列表 (用于作图题)。  
  * type \=== 'formula' \-\> 渲染公式步骤 (用于计算题)。

## **5\. 开发路线图 (Roadmap)**

1. **Step 1 (Backend):** 实现 PromptFactory，跑通历史 Q15 和物理 Q21 的测试用例。  
2. **Step 2 (Frontend):** 改造配置页 EnhancedGradingConfig，接入粘贴功能和级联数据。  
3. **Step 3 (Frontend):** 开发 RubricCard 组件，实现不同 type 的样式区分。  
4. **Step 4 (Integration):** 联调，测试综合题的“自动分组”渲染效果。