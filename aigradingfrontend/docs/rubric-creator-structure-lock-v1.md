# 评分细则生成页_结构锁定清单_v1

> 目的：在进行 Educacy 风格 UI 重构时，保证 `RubricPanel` 生成链路的页面结构与业务流程不被破坏。

## 1. 适用范围
- 文件：`aigradingfrontend/src/components/v2/views/RubricPanel.tsx`
- 结构冻结范围：`viewState = welcome | list | input | generating | result`
- 业务冻结范围：字段、校验、状态机、生成与保存行为

## 2. 当前状态机（冻结）
| 状态 | 入口 | 退出 | 说明 |
|---|---|---|---|
| `welcome` | 默认进入 | 创建/导入/进入模板库 | 引导页（3 条路径） |
| `list` | 从 welcome 进入模板库 | 返回 welcome / 新建 / 选模板 | 模板列表页（委托 `RubricListView`） |
| `input` | 新建、套用模板、重生 | 生成 / 返回 / 结果 | 评分细则生成表单主页面 |
| `generating` | 点击生成后 | 成功进入 result / 失败回 input | AI 处理中间页 |
| `result` | 生成成功、导入、编辑已有细则 | 保存后回 list / 重新生成 | 结果预览与保存 |

代码锚点：
- `ViewState` 定义：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:38`
- 默认状态：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:128`
- 各状态渲染分支：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:867`, `:925`, `:936`, `:976`, `:991`

## 3. 页面结构冻结（重点：`input`）

### 3.1 `input` 页面必须保留的结构层级
1. 顶层容器（滚动区 + 固定底部 CTA）
2. 全局生成错误提示区（`generationError`）
3. Section A：考试信息
- 返回按钮
- 考试名称
- 年级
- 科目
4. Section B：题目详情
- 任务粒度（整题/小问）
- 题号（必填）
- 小问号（仅小问模式必填）
- 总分（必填）
- 题型
- 策略
- 策略推荐说明（含“采用推荐”动作）
5. Section C：高级设置（可折叠）
- 个性化规则文本域
- 快速规则按钮组
6. Section D：上传图片区
- 试题图片（必传）
- 参考答案（可选）
- 拖拽/点击/粘贴
7. Fixed Footer：主动作区
- 条件不满足时：`重新开始填写`
- 条件满足时：`一键生成评分细则`

代码锚点：
- 输入页主容器：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:991`
- 错误提示：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:994`
- 考试信息段：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:1003`
- 题目详情段：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:1083`
- 高级设置段：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:1254`
- 上传图片区：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:1295`
- 固定底部 CTA：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:1390`

### 3.2 `generating` 页面必须保留的元素
- 顶部标题 + 预计耗时
- 中心加载视觉
- 动态阶段文案（`GENERATING_MESSAGES[generationStep]`）
- 进度条（`generatingProgress`）

代码锚点：
- 生成消息定义：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:50`
- 生成页渲染：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:936`
- 步骤定时轮播：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:241`

### 3.3 `result` 页面必须保持委托关系
- 继续使用 `RubricResultView`
- 继续传递：`rubric / examName / subject / questionNo / onSave / onRegenerate / onSaveTemplate`

代码锚点：
- `RubricResultView` 委托：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:976`

## 4. 字段与校验冻结

### 4.1 必填规则（不可改）
- `examName` 必填
- `questionNo` 必填
- `subQuestionNo` 在 `taskScope=subquestion` 时必填
- `totalScore` 必须为正数
- `questionImage` 必须上传

代码锚点：
- 校验函数：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:619`

### 4.2 生成按钮可用条件（不可改）
- `hasQuestionNo && hasValidTotalScore && hasQuestionImage && !isGenerating`

代码锚点：
- `canGenerate`：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:832`

### 4.3 图片输入能力（不可删）
- upload
- drag & drop
- paste（依赖 `activeUploadTarget`）

代码锚点：
- 上传：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:572`
- 拖拽：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:581`
- 粘贴：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:593`

## 5. 行为冻结（业务动作）
- 生成：`handleGenerate`（调用 `generateRubricFromImages`）
- 保存细则：`handleSaveRubric`
- 保存模板：`handleSaveTemplate`
- 重新生成：`handleRegenerate`
- 表单重置：`handleResetForm`

代码锚点：
- 生成主逻辑：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:640`
- 持久化主逻辑：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:748`
- 保存细则：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:778`
- 保存模板：`/Users/hero/Desktop/ai-grading/aigradingfrontend/src/components/v2/views/RubricPanel.tsx:795`

## 6. UI 重构允许与禁止

### 6.1 允许改动
- 配色、字体、字号、圆角、阴影、图标
- 同一结构内的排版方式（上下/左右布局）
- 组件外观替换（如 Button/Input 换成 Antd 风格壳层）

### 6.2 禁止改动
- 删除或合并上述 4 个主 Section（考试信息/题目详情/高级设置/上传图片）
- 改变必填规则与校验触发时机
- 改变 `viewState` 状态机路径
- 改变 `handleGenerate/persistRubric` 的触发语义
- 删除固定底部主 CTA 区

## 7. 回归验收清单（每次改 UI 必测）
1. 从 `welcome -> input` 能正常进入
2. 不上传试题图点击生成会报错
3. 上传试题图后生成按钮状态正确
4. `subquestion` 模式缺小问号会报错
5. `generating` 页面阶段文案与进度有变化
6. 生成成功能进入 `result`
7. `result` 的保存/保存模板/重新生成动作都可达
8. 固定底部 CTA 在小屏仍可点击

## 8. 执行策略（后续实施约束）
- 先做“同结构换皮”：仅替换 className/UI 组件，不改 handler 与 state 字段。
- 每次提交必须附带本清单第 7 节结果。
- 出现结构变更需求，必须先提交“结构变更提案”再改代码。
