# Phase 4 - Dual Platform E2E Regression Checklist

## Scope

- Product: `apps/extension-app`
- Bridge: `packages/extension-bridge`
- Platforms:
  - 智学网（zhixue）
  - 好分数（haofenshu）

## Preconditions

- Extension build artifact is generated from current branch.
- `api-server` is available and `api/v2` responds normally.
- Test account has valid license / quota.
- Browser cache is cleared or extension storage reset before each platform run.

## Regression Matrix

| Case ID | Flow | 智学网 | 好分数 | Expected Result |
| --- | --- | --- | --- | --- |
| R1 | 页面识别与上下文读取 | ☐ | ☐ | 识别到平台、题号、学生信息（若可用） |
| R2 | 评分细则首页与工作区切换 | ☐ | ☐ | UI 状态切换正确，无重复面板、无遮挡 |
| R3 | 评分细则生成（输入页 -> 结果页） | ☐ | ☐ | 生成成功并跳转结果页，按钮状态正确 |
| R4 | 批改模式检测（辅助/自动） | ☐ | ☐ | 状态卡字段正确，模式切换行为符合预期 |
| R5 | 批改写分（Bridge apply） | ☐ | ☐ | 分数写回页面成功，失败时返回可读错误 |
| R6 | 记录落库（records batch） | ☐ | ☐ | 记录可在阅卷记录页读取与导出 |
| R7 | 设置页（激活码/策略/BYOK） | ☐ | ☐ | 保存后可重新读取，字段值一致 |
| R8 | 错误兜底与重试 | ☐ | ☐ | 网络或平台异常时展示统一错误并支持重试 |

## Case Steps (Execution Standard)

### R1 页面识别与上下文读取

1. 打开目标阅卷页面并启动 sidepanel。
2. 检查是否识别平台标识、题号、学生信息（若页面可提供）。
3. 切换题目或刷新页面，验证上下文是否更新。

### R2 评分细则首页与工作区切换

1. 在“评分细则”首页点击“立即开始”进入生成页。
2. 在生成页、结果页、列表页之间来回切换。
3. 检查是否存在重复面板、遮挡、滚动异常。

### R3 评分细则生成（输入页 -> 结果页）

1. 在生成页填写最小必需字段并上传题图（必要时）。
2. 点击“生成细则”。
3. 验证成功跳转结果页，顶部标题、按钮状态、得分点区域正确。

### R4 批改模式检测（辅助/自动）

1. 进入“智能批改”页，观察环境检测状态卡。
2. 在设置页切换辅助/自动模式与策略。
3. 返回批改页确认模式字段与动作按钮状态一致。

### R5 批改写分（Bridge apply）

1. 在有可写目标的试题页面触发批改写分。
2. 验证页面分数或评语被正确写回。
3. 人为制造一次失败场景，检查失败提示与恢复路径。

### R6 记录落库（records batch）

1. 完成一次批改后进入“阅卷记录”页。
2. 检查新记录是否出现，字段是否完整（时间/题目/得分）。
3. 验证导出按钮行为（CSV/JSON）与可读性。

### R7 设置页（激活码/策略/BYOK）

1. 从右上角齿轮进入设置页。
2. 修改激活码、策略与模型配置后保存。
3. 关闭并重开 sidepanel，验证配置值可回读。

### R8 错误兜底与重试

1. 模拟接口失败或网络波动。
2. 验证提示文案、错误容器样式、重试按钮行为。
3. 恢复网络后重试，验证流程可继续。

## Execution Worksheet

对每个平台逐条记录以下信息：

1. 执行时间（本地时区）
2. 浏览器与扩展版本
3. Case ID
4. 实际结果（通过/失败）
5. 证据链接（截图、日志片段、request-id）
6. 缺陷编号（如有）

### 智学网（zhixue）执行记录

| Case ID | 结果(Pass/Fail) | 执行时间 | request-id | 证据路径 | 缺陷编号 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Pending |  |  |  |  |  |
| R2 | Pending |  |  |  |  |  |
| R3 | Pending |  |  |  |  |  |
| R4 | Pending |  |  |  |  |  |
| R5 | Pending |  |  |  |  |  |
| R6 | Pending |  |  |  |  |  |
| R7 | Pending |  |  |  |  |  |
| R8 | Pending |  |  |  |  |  |

### 好分数（haofenshu）执行记录

| Case ID | 结果(Pass/Fail) | 执行时间 | request-id | 证据路径 | 缺陷编号 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Pending |  |  |  |  |  |
| R2 | Pending |  |  |  |  |  |
| R3 | Pending |  |  |  |  |  |
| R4 | Pending |  |  |  |  |  |
| R5 | Pending |  |  |  |  |  |
| R6 | Pending |  |  |  |  |  |
| R7 | Pending |  |  |  |  |  |
| R8 | Pending |  |  |  |  |  |

### 缺陷登记模板（回归期）

| Defect ID | Platform | Case ID | Severity(P0-P3) | 现象 | 复现步骤 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| TBD | zhixue/haofenshu | R? | P? |  |  | Open |

## Exit Criteria

- 两个平台 R1-R8 全部通过。
- 无 P0/P1 缺陷遗留。
- `api/v2` 请求日志中错误率符合发布阈值。

## Current Status

- 文档与执行模板已就绪。
- 待执行：真实平台账号下的双平台手工回归与证据归档。
