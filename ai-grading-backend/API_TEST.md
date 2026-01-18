# 测试API Endpoints

## 准备工作
1. ✅ 创建了 src/lib/db.ts
2. ✅ 推送了数据库schema
3. ⚠️ 测试数据插入失败（数据库连接问题）

## 测试方案

由于数据库连接问题，我们有两个选择：

### 方案A: 使用本地SQLite数据库（推荐）
修改prisma/schema.prisma使用SQLite：
```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

### 方案B: 直接测试API（即使数据库为空）
可以测试API的基本功能和错误处理

## 当前建议

使用 `curl` 或 Postman 测试API endpoints：

### 测试1: 查询额度
```bash
curl http://localhost:3001/api/client/quota/check?deviceId=test-device-123
```

### 测试2: 验证激活码（会失败因为没数据）
```bash
curl -X POST http://localhost:3001/api/client/activation/verify \
  -H "Content-Type: application/json" \
  -H "X-Device-ID: test-device-123" \
  -d '{"code":"TEST-1111-2222-3333"}'
```

### 测试3: 消费额度（会失败因为没数据）
```bash
curl -X POST http://localhost:3001/api/client/quota/consume \
  -H "Content-Type: application/json" \
  -H "X-Device-ID: test-device-123" \
  -d '{"amount":1}'
```

## 下一步

1. 修复数据库连接问题
2. 或改用本地SQLite
3. 或手动在Supabase后台插入测试数据
