# 数据库 "readonly database" 错误排查记录

> **日期**: 2026-01-24  
> **问题**: Prisma SQLite "attempt to write a readonly database" 错误  
> **影响**: 后端 API 无法正常工作，所有数据库写入操作失败

---

## 🔴 问题现象

后端 API 持续报错：

```
Invalid `prisma.deviceQuota.create()` invocation:
ConnectorError(ConnectorError { 
  user_facing_error: None, 
  kind: QueryError(SqliteError { 
    extended_code: 8, 
    message: Some("attempt to write a readonly database") 
  }), 
  transient: false 
})
```

尽管所有配置文件都显示使用 PostgreSQL，运行时仍然报 SQLite 错误。

---

## 🔍 排查过程

### 阶段 1：检查配置文件

| 检查项 | 结果 |
|--------|------|
| `prisma/schema.prisma` | 本地是 SQLite，服务器是 PostgreSQL |
| `.env DATABASE_URL` | 正确配置为 Supabase PostgreSQL |
| `ecosystem.config.js` | 正确传递 DATABASE_URL |

**结论**: 配置文件看起来正确，但问题仍然存在。

### 阶段 2：尝试修复权限

```bash
chmod 777 prisma
chmod 666 dev.db
```

**结论**: 无效，问题仍存在。

### 阶段 3：重新生成 Prisma Client

```bash
rm -rf node_modules/.prisma
npx prisma generate
npm run build
```

检查生成的客户端：
```bash
grep 'activeProvider' node_modules/.prisma/client/index.js
# 输出: "activeProvider": "postgresql"
```

**结论**: Prisma Client 显示 PostgreSQL，但运行时仍报 SQLite 错误。

### 阶段 4：直接测试 Prisma 连接

```bash
node -e "
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
p.deviceQuota.create({data: {...}})
  .then(r => console.log('SUCCESS:', r.id))
  .catch(e => console.log('ERROR:', e.message));
"
```

**结果**: **成功创建记录！**

**关键发现**: 直接用 Node.js 调用 Prisma 成功，但通过 Next.js API 路由调用失败。

### 阶段 5：检查 BUILD_ID

```bash
cat .next/BUILD_ID
# 输出: sgTjTuHHCrI8uG2aToAif

curl http://localhost:3000/api/debug | grep buildId
# 输出: "buildId":"FpuWji_Vt_Lzxh4aWVhBO" (旧的!)
```

**关键发现**: 响应中的 BUILD_ID 与磁盘上的不同！说明请求被另一个服务处理。

### 阶段 6：检查端口占用

```bash
netstat -tlnp | grep 3000
# 输出: tcp6 0 0 :::3000 :::* LISTEN 3503724/next-server

pm2 list
# 显示 backend 在不断重启 (↺ 136 次)
```

**关键发现**: 端口被另一个 next-server 进程占用，PM2 的新服务无法启动。

### 阶段 7：追踪进程来源

```bash
ls -la /proc/3503724/cwd
# 输出: /proc/3503724/cwd -> /opt/ai-grading/aigradingbackend

ps -ef | grep 3503724
# 输出: admin 3503724 71462 ... next-server
```

**根本原因找到！**

---

## 🎯 根本原因

服务器上存在 **两个独立的后端部署**：

| 位置 | 用户 | PM2 实例 | 数据库配置 | 状态 |
|------|------|---------|-----------|------|
| `/opt/ai-grading/aigradingbackend` | admin | `/home/admin/.pm2` | **SQLite** (旧) | ⚠️ 占用端口 3000 |
| `/var/www/ai-grading/code/aigradingbackend` | root | `/root/.pm2` | PostgreSQL (新) | ❌ 无法启动 |

### 问题链路

```
用户请求 → OpenResty (端口 80) → 127.0.0.1:3000 → 旧服务 (SQLite) → 错误
                                                    ↑
                                              admin 的 PM2 管理
```

admin 用户的 PM2 服务运行了 2 天多，一直占用端口 3000，导致：
1. root 的新服务因端口冲突无法启动
2. OpenResty 代理的请求全部被旧服务处理
3. 旧服务使用 SQLite 配置，导致 "readonly database" 错误

---

## ✅ 解决方案

### 1. 停止 admin 用户的 PM2 服务

```bash
su - admin -c 'pm2 stop all && pm2 delete all && pm2 save --force'
```

### 2. 启动 root 用户的正确服务

```bash
cd /var/www/ai-grading/code/aigradingbackend
pm2 start ecosystem.config.js
pm2 save
```

### 3. 验证修复

```bash
curl http://localhost:3000/api/debug
# 输出: {"success":true,"dbUrl":"postgresql://...","count":16,"createdId":"..."}
```

---

## 📝 经验教训

### 1. 单一部署源

服务器上应只保留一个部署位置，避免多个版本冲突。建议：
- 删除或禁用 `/opt/ai-grading` 中的旧部署
- 统一使用 `/var/www/ai-grading/code` 作为部署目录

### 2. 用户 PM2 隔离

不同用户的 PM2 实例是完全独立的：
- `root` 的 PM2: `/root/.pm2`
- `admin` 的 PM2: `/home/admin/.pm2`

需要分别管理，检查时注意切换用户。

### 3. 端口冲突诊断

当服务无法启动或行为异常时，首先检查：

```bash
# 检查端口占用
netstat -tlnp | grep [端口号]

# 追踪进程来源
ls -la /proc/[PID]/cwd
ps -ef | grep [PID]
```

### 4. BUILD_ID 验证

Next.js 的 BUILD_ID 可以用来验证响应是否来自正确的构建：

```bash
# 磁盘上的 BUILD_ID
cat .next/BUILD_ID

# 响应中的 BUILD_ID
curl -s http://localhost:3000/... | grep buildId
```

---

## 🔧 相关文件修改

| 文件 | 修改内容 |
|------|---------|
| `aigradingbackend/prisma/schema.prisma` | 从 SQLite 改为 PostgreSQL，使用 `env("DATABASE_URL")` |
| `aigradingbackend/ecosystem.config.js` | 添加 DATABASE_URL 环境变量 |

---

## 📎 附录：关键命令速查

```bash
# 检查所有用户的 PM2 进程
ps aux | grep 'PM2'

# 切换用户操作 PM2
su - [用户名] -c 'pm2 list'

# 追踪进程工作目录
ls -la /proc/[PID]/cwd

# 强制杀死端口占用
fuser -k [端口]/tcp

# 重新构建 Next.js (完全清理)
rm -rf .next node_modules/.prisma
npx prisma generate
npm run build
```
