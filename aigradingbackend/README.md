# AI 批改助手 - 后端服务

基于 Next.js 的后端 API 服务，为 AI 批改助手 Chrome 扩展提供用户认证和数据同步功能。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **ORM**: Prisma 5
- **认证**: JWT

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npx prisma migrate dev
```

### 3. 启动开发服务器

```bash
npm run dev
```

服务将在 http://localhost:3000 启动。

## API 接口

### 健康检查

```
GET /api/health
```

返回服务状态。

### 用户注册

```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "123456",
  "name": "用户名"  // 可选
}
```

### 用户登录

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "123456"
}
```

### 获取用户信息

```
GET /api/user/profile
Authorization: Bearer <token>
```

## 项目结构

```
ai-grading-backend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── health/route.ts      # 健康检查
│   │   │   ├── auth/
│   │   │   │   ├── register/route.ts # 用户注册
│   │   │   │   └── login/route.ts    # 用户登录
│   │   │   └── user/
│   │   │       └── profile/route.ts  # 用户信息
│   │   └── ...
│   └── lib/
│       ├── prisma.ts           # 数据库客户端
│       ├── auth.ts             # JWT 工具
│       └── api-response.ts     # 统一响应格式
├── prisma/
│   ├── schema.prisma           # 数据库模型
│   └── dev.db                  # SQLite 数据库文件
└── ...
```

## 数据库模型

- **User**: 用户信息
- **Config**: 用户配置（模型设置、评分标准等）
- **GradingRecord**: 批改记录

## 环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
# 数据库连接
DATABASE_URL="file:./dev.db"

# JWT 密钥（请更换为随机字符串！）
JWT_SECRET="your-super-secret-jwt-key"
```

## 常用命令

```bash
# 开发
npm run dev

# 数据库迁移
npm run db:migrate

# 数据库管理界面
npm run db:studio

# 构建
npm run build

# 生产运行
npm start
```

## 后续开发计划

- [ ] 配置同步 API（/api/sync/rubric）
- [ ] 批改记录同步 API（/api/sync/history）
- [ ] 手机号登录（阿里云短信）
- [ ] 部署到阿里云/腾讯云
