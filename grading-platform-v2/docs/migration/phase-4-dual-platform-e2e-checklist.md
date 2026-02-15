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

## Execution Template

对每个平台逐条记录以下信息：

1. 执行时间（本地时区）
2. 浏览器与扩展版本
3. Case ID
4. 实际结果（通过/失败）
5. 证据链接（截图、日志片段、request-id）
6. 缺陷编号（如有）

## Exit Criteria

- 两个平台 R1-R8 全部通过。
- 无 P0/P1 缺陷遗留。
- `api/v2` 请求日志中错误率符合发布阈值。

## Current Status

- 文档与执行模板已就绪。
- 待执行：真实平台账号下的双平台手工回归与证据归档。
