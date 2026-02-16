# Educacy 全盘重构设计稿

## 入口
- `index.html`

## 模块页
- `rubric.html`：细则模块
- `grading.html`：阅卷模块
- `records.html`：记录模块
- `settings.html`：设置模块

## 设计基线
- 完整继承 `draft-d-educacy-replica` 的视觉语言：
  - 柔和教育后台色板
  - 轻量阴影与圆角卡片
  - 清晰表格与信息层级
- 统一样式文件：`shared.css`

## 评审建议
1. 四个模块的视觉统一性是否达标
2. 模块信息架构是否符合现有业务流
3. 是否保留当前信息密度，还是再收敛/再增强
4. 是否允许在实施时增加轻微动效（不改信息结构）

## 下一步（待你确认）
确认后进入 Antd 实施阶段：
1. 先做 Token 和 Layout 基座
2. 分模块替换（Rubric -> Grading -> Records -> Settings）
3. 每阶段做可回滚提交与构建验证
