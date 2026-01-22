# Mock 模式测试指南

## 🧪 本地测试（无需部署）

### 当前配置

系统已配置为 **Mock 模式**，可以直接测试 UI 和交互逻辑。

---

## 测试激活码

### 可用的测试激活码

| 激活码 | 类型 | 额度 | 状态 |
|--------|------|------|------|
| `TEST-1111-2222-3333` | 试用版 | 300次 | ✅ 可用 |
| `BASIC-AAAA-BBBB-CCCC` | 基础版 | 1000次 | ✅ 可用 |
| `PRO-XXXX-YYYY-ZZZZ` | 专业版 | 3000次 | ✅ 可用 |
| `USED-9999-8888-7777` | 基础版 | 1000次 | ❌ 已使用 |

---

## 测试步骤

### Step 1: 启动开发服务器

```bash
npm run dev
```

### Step 2: 测试额度显示

- 打开应用
- 查看 `QuotaDisplay` 组件
- 应该显示 "未激活" 或 "额度为0"

### Step 3: 测试激活流程

1. 点击"输入激活码"或"购买额度"
2. 弹出激活码输入框
3. 输入: `TEST-1111-2222-3333`
4. 点击"激活"
5. 应该提示"激活成功"
6. 额度显示变为 `300 / 300`

### Step 4: 测试批改扣减

1. 使用批改功能批改一份答卷
2. 批改成功后额度应该变为 `299 / 300`
3. 继续批改，额度继续减少

### Step 5: 测试额度用完

1. 在浏览器控制台手动设置额度为0:
```javascript
// 打开开发者工具 -> Console
localStorage.setItem('device_id', 'test-device');
// 手动调用 Mock 中的 consumeQuota 直到额度为0
```

2. 再次尝试批改
3. 应该提示"额度不足"
4. 显示购买引导

### Step 6: 测试错误激活码

1. 输入错误的激活码: `WRONG-CODE-1234-5678`
2. 应该提示"激活码无效或已使用"

3. 输入已使用的激活码: `USED-9999-8888-7777`
4. 应该提示"激活码无效或已使用"

---

## 查看 Mock 数据

打开浏览器控制台，查看日志:

```
🧪 [CloudBase] Using MOCK mode for local testing
[Mock] Checking quota for device: xxx-xxx
[Mock] Verifying activation code: TEST-1111-2222-3333
[Mock] Activation successful. New quota: { remaining: 300, ... }
```

---

## 切换到真实模式

当你准备部署真实 CloudBase 时:

### 1. 修改 `.env.local`:

```bash
# 关闭 Mock 模式
VITE_USE_MOCK=false

# 填入真实环境 ID
VITE_CLOUDBASE_ENV_ID=your-real-env-id
```

### 2. 部署 CloudBase:

```bash
./deploy.sh
```

### 3. 重启开发服务器:

```bash
npm run dev
```

---

## 常见问题

### Q: 激活后额度没变化?
A: 刷新页面，Mock 数据存在内存中。

### Q: 想重置测试数据?
A: 刷新页面即可，Mock 数据每次都重新初始化。

### Q: Mock 模式下如何调试?
A: 打开浏览器控制台，查看 `[Mock]` 开头的日志。

---

**准备好测试了吗？** 🚀

```bash
npm run dev
```

然后打开应用，试试激活码: `TEST-1111-2222-3333`
