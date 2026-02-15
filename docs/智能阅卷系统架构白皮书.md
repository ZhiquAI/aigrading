# **智能阅卷系统架构白皮书 (Intelligent Grading System Architecture)**

## **1\. 核心理念：通用框架，动态适配 (One Framework, Dynamic Adaptability)**

本架构旨在通过一套统一的代码库，支持全学科（语文、数学、英语、物理、化学、历史、政治等）的智能阅卷需求。 我们不为每个学科写死代码，而是通过“动态提示词工程” (Dynamic Prompt Engineering) 和 **“自适应前端组件” (Adaptive UI)** 来应对题型和学科的变化。

## **2\. 系统三层架构 (The Three-Layer Architecture)**

### **第一层：表现层 (Adaptive Frontend)**

* **功能：** 数据的采集与展示。  
* **核心组件：**  
  1. **配置弹窗 (GradingModal)**：  
     * 支持粘贴上传 (Clipboard Paste) 试题与答案图片。  
     * 收集关键元数据：subject (学科), type (题型), score (总分), strategy (策略)。  
  2. **细则编辑器 (RubricResultDisplay)**：  
     * **多态渲染 (Polymorphic Rendering)**：根据后端返回的数据类型，自动切换展示模式。  
       * *文科题* \-\> 显示关键词标签 (Tags) \+ 同义词 (Synonyms)。  
       * *理科作图* \-\> 显示检查清单 (Checklist)。  
       * *理科计算* \-\> 显示公式与步骤 (Step-by-Step)。  
     * **视觉反馈**：使用不同颜色的 Badge (红/绿/蓝) 区分精确匹配与模糊匹配。

### **第二层：逻辑层 (Backend Logic Factory)**

* **功能：** 将简单的用户输入转化为复杂的 AI 指令。  
* **核心模块：**  
  1. **提示词工厂 (gemini\_prompt\_builder.ts)**：  
     * 这是系统的“大脑”。它包含一个巨大的 switch/case 逻辑树。  
     * **输入：** type="物理计算题"  
     * **输出：** "请将答案拆解为公式、代入过程、结果与单位..."  
  2. **多模态处理器 (gemini\_api\_handler.ts)**：  
     * 负责将图片 Buffer 转换为 Base64 格式。  
     * 负责调用 Gemini API，将 System Prompt \+ Images 打包发送。

### **第三层：智能层 (Generative AI Engine)**

* **模型选型：** Google Gemini 2.5 Flash (推荐) 或 Pro。  
* **核心能力：**  
  * **多模态理解 (Multimodal)**：直接读取试题图片中的文字、图表、几何图形、手写体。  
  * **逻辑推理 (Reasoning)**：处理“综合题”的自动拆解，处理“观点论述题”的逻辑验证。

## **3\. 数据流转全景图 (Data Flow)**

sequenceDiagram  
    participant T as 老师 (Teacher)  
    participant FE as 前端 (React)  
    participant BE as 后端 (Node.js)  
    participant AI as Gemini AI

    T-\>\>FE: 1\. 上传试题+答案图片 (Ctrl+V)  
    T-\>\>FE: 2\. 选择 \[学科:物理\] \[题型:计算题\]  
    FE-\>\>BE: 3\. 发送 API 请求 (Images \+ Metadata)  
      
    Note over BE: 提示词工厂启动  
    BE-\>\>BE: 组装 Prompt: "我是物理专家...请拆解公式..."  
    BE-\>\>BE: 图片转 Base64  
      
    BE-\>\>AI: 4\. 发送 \[Prompt \+ Base64 Images\]  
      
    Note over AI: 视觉分析 \+ 逻辑推理  
    AI-\>\>BE: 5\. 返回结构化 JSON  
      
    BE-\>\>FE: 6\. 转发 JSON 数据  
      
    Note over FE: 自适应组件渲染  
    FE-\>\>T: 7\. 展示为: \[公式G=mg\] \[结果18N\]  
    T-\>\>FE: 8\. 微调并保存为模版

## **4\. 关键技术突破点**

1. **去 OCR 化 (No-OCR):**  
   * 传统方案：OCR转文字 \-\>文字发给LLM \-\> 丢失图表信息。  
   * **本方案：** 直接传图。AI 能看懂电路图、函数图像、历史地图，保留了完整的题目语义。  
2. **结构化输出 (Structured Output):**  
   * 强制 AI 输出严格的 JSON 格式。  
   * 解决了“AI 写了一篇作文，程序没法存数据库”的问题。  
3. **学科特化策略 (Subject-Specific Strategy):**  
   * **历史/政治：** 启用 Synonym Expansion (同义词泛化)，解决“意思对即可”的判分难点。  
   * **数学/物理：** 启用 Step Decomposition (步骤拆解) 和 Exact Match (精确匹配)，确保科学严谨性。

## **5\. 下一步行动建议 (Next Steps)**

既然“评分标准生成”已经跑通，接下来的开发重点应转向 **“批量阅卷” (Batch Grading)**：

1. **学生答卷切图：** 开发一个前端工具，让老师框选学生答卷区域，或者使用 OpenCV 自动切图。  
2. **阅卷推理管道：**  
   * 输入：\[评分细则 JSON\] \+ \[学生答卷图片\]  
   * Prompt： "请根据上述评分细则，对这张学生答卷进行打分。如果不符合某条细则，说明理由。"  
   * 输出：{ score: 3, reason: "公式正确，但结果计算错误" }