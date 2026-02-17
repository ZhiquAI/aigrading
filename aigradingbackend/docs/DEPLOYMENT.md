# 🚀 一键部署脚本

## 后端环境变量模板

复制此文件为 `.env.local` 并填入实际值:

```env
# ============== AI API 配置 ==============

# Gemini API (必填)
GEMINI_API_KEY=your_gemini_api_key_here

# OpenAI API (可选,如果使用中转平台)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_BASE_URL=https://your-api-proxy.com/v1

# ============== 数据库配置 ==============

# LibSQL / Turso (推荐)
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=your_auth_token

# 或 PostgreSQL (Vercel)
# POSTGRES_URL=postgresql://...
# POSTGRES_PRISMA_URL=postgresql://...

# ============== 认证配置 ==============

# JWT Secret (随机生成一个长字符串)
JWT_SECRET=your_very_long_random_secret_string_here

# ============== CORS 配置 ==============

# 允许的前端域名 (部署后更新)
ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173

# ============== 其他配置 ==============

NODE_ENV=production
```

## 前端环境变量模板

复制此文件为 `.env.local` 并填入实际值:

```env
# ============== API 配置 ==============

# 后端 API 地址 (部署后填入)
VITE_API_BASE_URL=https://your-backend.vercel.app/api

# ============== CloudBase 配置 (如果使用) ==============

VITE_CLOUDBASE_ENV_ID=your_cloudbase_env_id

# ============== 多平台 API 配置 (可选) ==============

# CherryIN
VITE_CHERRYIN_API_KEY=your_cherryin_key
VITE_CHERRYIN_BASE_URL=https://open.cherryin.ai/v1

# 老张AI
VITE_LAOZHANG_API_KEY=your_laozhang_key
VITE_LAOZHANG_BASE_URL=https://api.laozhang.ai/v1

# DMXAPI
VITE_DMXAPI_KEY=your_dmxapi_key
VITE_DMXAPI_BASE_URL=https://api.dmxapi.cn/v1

# Poloapi
VITE_POLOAPI_KEY=your_poloapi_key
VITE_POLOAPI_BASE_URL=https://api.poloapi.top/v1
```

## 快速部署命令

### 方式 1: 命令行部署 (推荐首次使用)

```bash
# 1. 安装 Vercel CLI
npm install -g vercel

# 2. 登录
vercel login

# 3. 部署后端
cd ai-grading-backend
vercel --prod

# 4. 部署前端 (记得先更新 VITE_API_BASE_URL)
cd ../ai-grading-frontend
vercel --prod
```

### 方式 2: GitHub 自动部署 (推荐长期使用)

```bash
# 1. 初始化 Git (如果还没有)
git init
git add .
git commit -m "Initial commit"

# 2. 创建 GitHub 仓库并推送
# 在 GitHub 网站创建仓库后:
git remote add origin https://github.com/yourusername/ai-grading.git
git push -u origin main

# 3. 登录 Vercel
# 访问: https://vercel.com
# 点击 "Import Project"
# 选择 GitHub 仓库
# 配置环境变量
# 点击 Deploy
```

## 环境变量设置 (Vercel Dashboard)

### 后端项目

1. 进入 Vercel Dashboard
2. 选择 `ai-grading-backend` 项目
3. Settings → Environment Variables
4. 添加以下变量:

```
GEMINI_API_KEY=...
DATABASE_URL=...
DATABASE_AUTH_TOKEN=...
JWT_SECRET=...
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

### 前端项目

1. 进入 Vercel Dashboard
2. 选择 `ai-grading-frontend` 项目
3. Settings → Environment Variables
4. 添加以下变量:

```
VITE_API_BASE_URL=https://your-backend.vercel.app/api
VITE_CLOUDBASE_ENV_ID=... (如果使用)
```

## 部署后验证

### 1. 检查后端

```bash
# 访问健康检查端点
curl https://your-backend.vercel.app/api/health

# 期望返回
{"status":"ok"}
```

### 2. 检查前端

访问: `https://your-frontend.vercel.app`

- [ ] 页面正常加载
- [ ] 无控制台错误
- [ ] 能连接后端 API

### 3. 测试核心功能

- [ ] 上传图片评分
- [ ] 生成评分标准
- [ ] 多平台切换
- [ ] 数据保存

## 故障排查

### 问题 1: 前端无法连接后端

**检查**:
1. `VITE_API_BASE_URL` 是否正确
2. 后端 CORS 配置
3. 网络请求是否被阻止

**解决**:
```bash
# 在前端项目重新部署
vercel --prod --force
```

### 问题 2: 环境变量不生效

**检查**:
1. Vercel Dashboard 中是否正确设置
2. 变量名前缀是否正确 (前端用 `VITE_`)
3. 是否重新部署

**解决**:
```bash
# 强制重新部署
vercel --prod --force
```

### 问题 3: 数据库连接失败

**检查**:
1. `DATABASE_URL` 格式是否正确
2. 数据库是否运行
3. 网络连接

**解决**:
```bash
# 测试数据库连接
npx prisma db push
```

## 性能优化建议

### 1. 启用缓存

在 `vercel.json` 添加:
```json
{
  "headers": [
    {
      "source": "/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000"
        }
      ]
    }
  ]
}
```

### 2. 图片优化

使用 Vercel Image Optimization:
```tsx
import Image from 'next/image';

<Image 
  src="/path/to/image.jpg" 
  width={500} 
  height={300}
  alt="Description"
/>
```

### 3. 分析性能

Vercel Dashboard → Analytics → 查看:
- 页面加载时间
- API 响应时间
- 用户流量

## 成本估算

### Vercel Free Plan 限额

- ✅ 100GB 带宽/月
- ✅ 100 小时构建时间/月
- ✅ 无限项目
- ✅ 自动 HTTPS

### 预估使用量 (学校项目)

假设:
- 200 个用户/月
- 每人使用 10 次
- 每次请求 500KB

**总流量**: 200 × 10 × 500KB = 1GB/月

**结论**: 完全在免费额度内! ✅

## 下一步

1. ✅ 部署成功后,测试所有功能
2. ✅ 绑定自定义域名 (可选)
3. ✅ 设置 GitHub 自动部署
4. ✅ 监控性能和错误
5. ✅ 向用户推广!

---

**祝部署顺利!** 🚀
