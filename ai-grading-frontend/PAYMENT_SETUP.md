# 付费系统使用指南

## 🎯 系统说明

**混合架构**: 后端验证额度 + 前端直连 AI

- ✅ 保持前端直连速度 (10-15s)
- ✅ 后端控制额度 (<100ms)
- ✅ 实现简单,只需2个API

---

## 📦 已创建的文件

### 后端 API

1. **`pages/api/quota/check.ts`**
   - 功能: 快速验证用户额度
   - 响应时间: <100ms
   - 返回: `{ canUse: boolean, remaining: number }`

2. **`pages/api/quota/consume.ts`**
   - 功能: 异步上报使用记录
   - 特点: 立即返回,不阻塞前端
   - 后台扣减额度和记录日志

### 前端修改

1. **`services/geminiService.ts`**
   - 在 `assessStudentAnswer` 函数中集成验证逻辑
   - 流程: 验证额度 → AI批改 → 上报使用

---

## 🚀 快速开始

### 1. 安装依赖

```bash
# 后端依赖
npm install jsonwebtoken
npm install @types/jsonwebtoken --save-dev

# 如果使用 Next.js
npm install next
```

### 2. 配置环境变量

创建 `.env.local`:
```bash
# JWT 密钥
JWT_SECRET=your-super-secret-key-change-this

# Gemini API Key (后端用)
GEMINI_API_KEY=your-gemini-api-key

# 数据库连接 (MySQL)
DATABASE_URL=mysql://user:password@localhost:3306/grading_db
```

### 3. 创建数据库表

```sql
-- 用户表
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户额度表
CREATE TABLE user_quotas (
    user_id BIGINT PRIMARY KEY,
    remaining INT NOT NULL DEFAULT 300 COMMENT '-1 表示无限',
    total INT NOT NULL,
    used INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 消费记录表
CREATE TABLE usage_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_time (user_id, created_at)
);
```

### 4. 创建数据库连接 (示例)

创建 `lib/db.ts`:
```typescript
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'grading_db',
    waitForConnections: true,
    connectionLimit: 10
});

export const db = {
    query: async (sql: string, params?: any[]) => {
        const [rows] = await pool.execute(sql, params);
        return rows;
    }
};
```

然后在 API 文件中导入:
```typescript
import { db } from '../../../lib/db';
```

### 5. 测试流程

#### 5.1 创建测试用户
```sql
-- 插入测试用户
INSERT INTO users (id, email, password_hash) 
VALUES (1, 'test@example.com', '$2b$10$...');

-- 分配额度
INSERT INTO user_quotas (user_id, remaining, total) 
VALUES (1, 300, 300);
```

#### 5.2 获取 JWT Token
```bash
# 临时测试 Token (开发时可用)
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
    { userId: 1 }, 
    'your-super-secret-key-change-this'
);
console.log('Token:', token);
"
```

#### 5.3 测试验证接口
```bash
curl -X POST http://localhost:3000/api/quota/check \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# 预期响应:
# { "canUse": true, "remaining": 300 }
```

#### 5.4 测试上报接口
```bash
curl -X POST http://localhost:3000/api/quota/consume \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# 预期响应:
# { "success": true }

# 再次查询,应该变成 299
```

---

## 🔧 集成到前端

前端代码已自动集成,用户登录后将 JWT Token 存储到 `localStorage`:

```typescript
// 登录成功后
localStorage.setItem('auth_token', jwtToken);

// 之后调用批改接口会自动验证额度
const result = await assessStudentAnswer(imageBase64, rubric, 'pro');
```

---

## ⚠️ 已知问题

1. **后端 API 文件缺少 db 导入**
   - 需要创建 `lib/db.ts` 并在 API 文件中导入
   - 或者使用 Prisma/TypeORM 等 ORM

2. **用户认证系统未实现**
   - 需要补充 `/api/auth/register` 和 `/api/auth/login`
   - 需要密码哈希 (bcrypt)

3. **支付系统待实现**
   - 对接虎皮椒或其他支付平台
   - 实现支付回调自动充值

---

## 📋 下一步

**立即可做**:
1. [ ] 创建数据库连接层 (`lib/db.ts`)
2. [ ] 实现用户注册/登录接口
3. [ ] 测试完整流程

**短期计划**:
4. [ ] 部署后端到 Vercel
5. [ ] 对接支付系统
6. [ ] 添加额度充值页面

**长期优化**:
7. [ ] 添加使用统计面板
8. [ ] 实现 Redis 缓存
9. [ ] 添加监控告警

---

## 🆘 遇到问题?

1. **额度验证失败但能正常批改**
   - 这是降级处理,验证失败不会阻塞用户
   - 检查后端日志查看具体错误

2. **后端 30-40 秒超时**
   - 确保后端部署到云端 (不要用本地)
   - 推荐 Vercel (免费且快速)

3. **Token 验证失败**
   - 检查 JWT_SECRET 是否一致
   - 检查 Token 是否过期

---

**完成实施后,请告诉我遇到的任何问题!** 🚀
