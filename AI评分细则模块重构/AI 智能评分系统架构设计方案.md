# **AI 智能评分系统架构设计方案**

## **—— 应对多学科、多题型、复杂规则的混合解决方案**

### **1\. 核心观点：为什么单一方案行不通？**

在面对“不同学科 x 不同题型 x 复杂评分规则”的矩阵式需求时，单一手段均有局限性：

* **纯 Prompt 工程 (All-in-Prompt):**  
  * **缺点:** 当规则极其复杂（如数学证明题的步骤分、语文作文的多个维度）时，Context Window 会过载，模型容易遗忘指令（Lost in the Middle），且大模型不擅长做精确的数学加减分运算（容易算错总分）。  
* **纯结构化 UI (UI-Only):**  
  * **缺点:** UI 只能限制输入格式，无法处理非结构化的学生答案（如简答题的语义理解），失去了 AI 的灵活性。

**最佳解决方案：** 采用 **"UI 定义规则 (Schema) \-\> 动态 Prompt 组装 \-\> AI 语义判断 \-\> 代码逻辑算分"** 的流水线架构。

### **2\. 架构设计：三层模型**

#### **第一层：配置层 (Configuration) \- 解决“规则多样性”**

利用 **结构化 UI** 让教师配置评分标准，但在后台将其保存为标准化的 **JSON Schema**。

* **UI 表现:** 教师看到的是下拉菜单、勾选框、权重滑块。  
* **数据存储 (Rubric Schema):**  
  {  
    "question\_type": "math\_proof",  
    "total\_score": 10,  
    "grading\_steps": \[  
      { "id": 1, "keyword": "辅助线", "score": 2, "rule": "must\_contain\_semantic", "desc": "正确作出了辅助线" },  
      { "id": 2, "keyword": "勾股定理", "score": 3, "rule": "logic\_check", "desc": "正确运用勾股定理计算" },  
      { "id": 3, "keyword": "最终答案", "score": 5, "rule": "exact\_match", "desc": "答案为 5√2" }  
    \],  
    "negative\_rules": \[  
      { "condition": "units\_missing", "penalty": 1, "desc": "缺少单位" }  
    \]  
  }

#### **第二层：执行层 (Execution) \- 解决“AI 理解力”**

根据 JSON Schema 动态生成 System Prompt。**不要让 AI 直接给分，而是让 AI 输出“判断结果”。**

* **错误的做法:** "请根据规则给这道题打分，直接告诉我多少分。"  
* **正确的做法 (CoT \+ Structured Output):** "请检查学生答案是否包含步骤1的要素？是否包含步骤2的逻辑？请输出 JSON 格式的布尔值判断。"

#### **第三层：计算层 (Calculation) \- 解决“评分准确性”**

**将算分逻辑剥离出 AI。** AI 只负责定性（True/False/Level），代码负责定量（加减分）。

* **流程:** AI 返回 {"step\_1\_met": true, "step\_2\_met": false} \-\> 后端 Python 代码读取 Schema，发现 Step 1 是 2 分，Step 2 是 3 分 \-\> 计算得出 2 \+ 0 \= 2 分。

### **3\. 具体场景解决方案**

#### **场景 A：理科（数学/物理/编程） \- 步骤分与关键词**

理科评分通常是**确定性**的，包含“关键步骤”和“最终结果”。

* **策略:** 分治法 (Divide and Conquer)。  
* **Prompt 优化:** 将题目拆解为原子化的检查点 (Checkpoints)。  
* **示例逻辑:**  
  1. **UI:** 老师设置3个得分点（公式正确、计算过程、最终结果）。  
  2. **Prompt:** "请分析学生的回答。他是否列出了 F=ma？(输出 Y/N)；他是否带入了数值 10kg？(输出 Y/N)。"  
  3. **Code:** 根据 AI 的 Y/N 序列，累加预设的分数。

#### **场景 B：文科（语文/历史/政治） \- 维度评分与模糊匹配**

文科评分通常是**非确定性**的，包含“语言流畅度”、“观点新颖性”、“情感色彩”。

* **策略:** 评估量表 (Rubric Matrix)。  
* **Prompt 优化:** 使用 Few-Shot (少样本提示)，给 AI 提供 1-2 个“满分范例”和“低分范例”。  
* **示例逻辑:**  
  1. **UI:** 老师选择评分维度（内容 40%，结构 30%，文采 30%）。  
  2. **Prompt:** "你是一位资深语文老师。请从'内容'维度评价，分为 A/B/C/D 四档。A档标准：... B档标准：..."  
  3. **Code:** 映射档位到分数（如 A=9-10分, B=7-8分），取中位数或结合 AI 给出的具体分值进行加权。

#### **场景 C：特殊规则 (Special Constraints)**

* **倒扣分机制 (如：错别字扣分):**  
  * 独立的一个 AI Task 专门找错别字，返回列表。代码层执行 Max(0, Total \- count \* 0.5)。  
  * **原因:** 大模型很不擅长做“每出现一次扣 0.5 分”这种累加计算，交给代码最稳妥。

### **4\. 推荐的 Prompt 结构模板 (针对开发者)**

不要试图用一个通用的 Prompt 解决所有问题，而是根据 Schema 组装 Prompt。

\# Role  
你是一个专业的\[学科\]阅卷助手。

\# Task  
针对以下题目和评分标准，分析学生的回答。

\# Input  
【题目】: {{ question\_content }}  
【标准答案/参考要点】: {{ reference\_answer }}  
【学生回答】: {{ student\_answer }}

\# Grading Schema (Dynamic Injected)  
请严格按照以下检查点进行验证：  
1\. \[ID: 001\] {{ rule\_desc\_1 }} (判定标准: {{ criteria\_1 }})  
2\. \[ID: 002\] {{ rule\_desc\_2 }} (判定标准: {{ criteria\_2 }})

\# Output Requirements  
请仅输出合法的 JSON，不要包含 Markdown 格式：  
{  
  "analysis": "简短的思维链分析...",  
  "checkpoints": {  
    "001": { "met": true, "evidence": "学生提到了..." },  
    "002": { "met": false, "evidence": "未找到相关描述" }  
  },  
  "general\_comments": "评语"  
}

### **5\. 总结：实施路线图**

1. **标准化 (Schema First):** 定义一套 JSON 协议，能够描述 90% 的题型（单选、多选、填空、简答、代码、作文）。  
2. **结构化 UI (Frontend):** 开发“评分规则编辑器”，让老师不用懂 Prompt 也能配置规则。  
3. **AI 原子化 (Backend):** 将评分拆解为“语义提取”、“逻辑验证”、“格式检查”等原子任务。  
4. **计算确定性 (Logic):** 分数计算永远由代码执行，AI 只做语义判别。

这种方案虽然前期开发成本比“写一段长 Prompt”要高，但它是唯一能够保证**稳定性、可维护性**并扩展到多学科的工业级解决方案。

---

## **6\. v3 落地更新（2026-02-06）**

### **6.1 数据协议升级**
- 已统一落地 **RubricJSON v3**：`metadata + strategyType + content + constraints`，并保留 v2 自动迁移。
- 前后端均使用类型与校验（后端 zod + validator），读时自动转 v3。

### **6.2 评分链路落地**
- **AI 判定 → 代码算分** 已成为主路径。
- AI 仅输出判定 JSON（`checkpoints`/`dimensions`），算分由 `score-engine` 统一执行。
- 低置信度触发 `needsReview`，前端自动暂停。

### **6.3 模板库支撑**
- 新增 **RubricTemplate** 表与 CRUD 接口。
- 支持系统模板、用户模板、推荐模板三类入口。

### **6.4 关键实现位置（便于对照）**
- v3 Schema：`aigradingbackend/src/lib/rubric-v3.ts`
- 转换器：`aigradingbackend/src/lib/rubric-convert.ts`
- 评分引擎：`aigradingbackend/src/lib/score-engine.ts`
- 模板接口：`aigradingbackend/src/app/api/rubric/templates/route.ts`
