# Educacy 侧边栏交互设计稿

## 目标
在不改业务逻辑前提下，先审查四个模块的关键状态流转是否合理。

## 页面
- `index.html`：交互稿总览
- `rubric-interaction.html`：欢迎/列表/创建/生成中/结果
- `grading-interaction.html`：待开始/扫描中/AI思考/结果确认/人工复核
- `records-interaction.html`：加载中/列表/详情展开/导出反馈
- `settings-interaction.html`：账户页/平台切换/测试中/测试成功/保存成功

## 交互说明
- 顶部“状态切换条”可点击切换场景
- 页面按钮可触发状态跳转或 Toast 反馈
- 所有页面按 360-390px 侧边栏尺寸设计

## 下一步
你确认状态流和信息层级后，我再按此稿实施到真实模块（保持 store/service 不动，仅替换 UI 壳层）。

## 实施约束
- 结构冻结清单（先确认，再实施）：`/Users/hero/Desktop/ai-grading/docs/评分细则生成页_结构锁定清单_v1.md`
