# Admin Console UI 框架引入方案

## 目标
在 admin-console 引入 shadcn/ui + Tailwind CSS 框架，与 extension-app 保持统一的 UI 设计系统。

## 现状分析

| 项目 | 状态 |
|------|------|
| admin-console | 空项目，仅有 main.tsx |
| extension-app | 基础组件，纯 CSS 变量系统 |
| ui-kit | 空包 (仅导出版本号) |
| Tailwind CSS | 未引入 |
| shadcn/ui | 设计规范已制定 (docs/design/shadcn-ui-spec.md) |

## 方案设计

### 核心决策：组件复用策略

**推荐方案 B：直接在 apps 中实现，便于迭代**

原因：
- ui-kit 为空，从零构建周期长
- admin-console 和 extension-app 是独立应用，UI 差异较大
- shadcn/ui 的 "copy to project" 模式天然支持独立定制

### 实施步骤

#### 1. 在 admin-console 安装 shadcn/ui + Tailwind

```bash
cd grading-platform-v2/apps/admin-console

# 初始化 shadcn/ui (选择 Tailwind)
npx shadcn@latest init -y

# 安装核心组件
npx shadcn@latest add button card input table dialog sheet tabs form label badge avatar scroll-area separator
```

#### 2. 配置项目结构

```
apps/admin-console/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn/ui 组件 (copy 到项目)
│   │   └── shared/       # 共享业务组件
│   ├── features/         # 功能模块
│   ├── lib/              # 工具函数
│   ├── styles.css        # 全局样式 + CSS 变量
│   └── App.tsx           # 主应用
├── tailwind.config.js
└── components.json       # shadcn 配置
```

#### 3. 设计系统适配

从 `docs/design/shadcn-ui-spec.md` 提取设计令牌到项目的 `styles.css`：

```css
/* admin-console/src/styles.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Primary - 科技蓝 */
  --primary: #006FEE;
  --primary-foreground: #ffffff;
  /* ... 其他设计令牌 */
}
```

#### 4. 开发管理后台页面

基于 shadcn/ui 组件构建：
- 仪表盘 (Dashboard)
- 激活码管理
- 用户管理
- 批改记录查询
- 系统设置

## 关键文件

### 新增/修改文件
- `apps/admin-console/package.json` - 添加依赖
- `apps/admin-console/tailwind.config.js` - Tailwind 配置
- `apps/admin-console/components.json` - shadcn 配置
- `apps/admin-console/src/styles.css` - 全局样式 + 设计令牌
- `apps/admin-console/src/components/ui/*.tsx` - shadcn 组件
- `apps/admin-console/src/App.tsx` - 主应用

### 参考文件
- `docs/design/shadcn-ui-spec.md` - 设计规范
- `grading-platform-v2/apps/extension-app/src/styles.css` - 现有样式参考

## 验证方式

1. **构建验证**:
   ```bash
   cd grading-platform-v2
   pnpm build  # 验证 admin-console 构建成功
   ```

2. **开发验证**:
   ```bash
   cd grading-platform-v2/apps/admin-console
   pnpm dev    # 访问 http://localhost:3100
   ```

3. **UI 验证**:
   - 检查 shadcn 组件渲染正常
   - 设计令牌 (颜色、间距、圆角) 生效
   - 响应式布局正常

## 预期时间
- 基础框架搭建: 约 30 分钟
- 核心组件安装: 约 15 分钟
- 首屏 Dashboard: 约 1 小时
