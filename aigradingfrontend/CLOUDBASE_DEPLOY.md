# CloudBase 部署指南

## 前置要求

1. 注册腾讯云账号
2. 实名认证
3. 开通 CloudBase 服务

---

## 部署步骤

### Step 1: 安装 CLI

```bash
npm install -g @cloudbase/cli
```

### Step 2: 登录

```bash
tcb login
```

### Step 3: 创建环境

```bash
# 创建环境 (选择按量计费,免费额度够用)
tcb env:create my-grading-env --region ap-shanghai
```

**记录环境 ID**: `my-grading-env-xxx`

### Step 4: 初始化数据库

在 CloudBase 控制台完成:

1. 进入 **数据库** → **创建集合**

**集合 1: activation_codes**
```json
{
    "code": "String",
    "type": "String",
    "quota": "Number",
    "validity_days": "Number",
    "status": "String",
    "used_at": "Date",
    "used_by": "String",
    "created_at": "Date",
    "expires_at": "Date"
}
```

**集合 2: user_quotas**
```json
{
    "device_id": "String",
    "remaining": "Number",
    "total": "Number",
    "used": "Number",
    "activation_type": "String",
    "created_at": "Date",
    "updated_at": "Date",
    "expires_at": "Date"
}
```

**集合 3: usage_logs**
```json
{
    "device_id": "String",
    "action": "String",
    "created_at": "Date"
}
```

### Step 5: 部署云函数

```bash
cd /Users/hero/Desktop/ai-智能批改助手

# 部署三个云函数
tcb functions:deploy quota-check --path cloudbase/functions/quota-check
tcb functions:deploy quota-consume --path cloudbase/functions/quota-consume
tcb functions:deploy activation-verify --path cloudbase/functions/activation-verify
```

### Step 6: 配置环境变量

创建 `.env.local`:
```bash
VITE_CLOUDBASE_ENV_ID=my-grading-env-xxx
```

### Step 7: 安装前端依赖

```bash
npm install @cloudbase/js-sdk
```

### Step 8: 测试

```bash
# 启动开发服务器
npm run dev

# 测试额度查询
# 打开控制台查看日志
```

---

## 生成激活码

使用之前创建的脚本:

```bash
# 生成10个基础版激活码
node scripts/generate-code.js basic 10
```

**手动添加到数据库**:

在 CloudBase 控制台 → 数据库 → activation_codes → 添加记录:设置:

```json
{
    "code": "A3K9-HN2P-X7F4-M8WQ",
    "type": "basic",
    "quota": 1000,
    "validity_days": 90,
    "status": "unused",
    "created_at": { "$date":  "2026-01-18T00:00:00.000Z" },
    "expires_at": { "$date": "2027-01-18T00:00:00.000Z" }
}
```

---

## 验证部署

### 1. 测试额度查询

打开浏览器控制台:
```javascript
import { checkQuota } from './services/cloudbaseService';
import { getDeviceId } from './utils/device';

const deviceId = getDeviceId();
const result = await checkQuota(deviceId);
console.log(result);
```

### 2. 测试激活码

在 UI 中输入激活码，查看是否成功充值。

---

## 常见问题

### Q: 云函数调用失败？
A: 检查环境 ID 是否正确，是否已匿名登录。

### Q: 数据库连接失败？
A: 确保集合名称正确，权限设置为"所有用户可读写"（开发环境）。

### Q: 激活码验证失败？
A: 检查数据库中是否有对应激活码，status 是否为 "unused"。

---

## 成本估算

**免费额度** (每月):
- 云函数调用: 100万次
- 数据库读写: 5万次/天
- 流量: 5GB

**你的场景** (1000用户):
- 每用户300次 = 30万次调用
- **完全免费** ✅

---

完成以上步骤后，系统即可正常运行！🎉
