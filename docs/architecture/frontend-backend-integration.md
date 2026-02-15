# 前端与后端交互文档

## 1. 整体交互架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           前端 (Chrome Extension)                        │
│                                                                          │
│   ┌──────────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│   │   UI 组件        │───▶│   Zustand Store  │───▶│ proxyService   │  │
│   │ (React)         │◀───│   (状态管理)      │◀───│ (API 代理)     │  │
│   └──────────────────┘    └──────────────────┘    └───────┬────────┘  │
└─────────────────────────────────────────────────────────────┼────────────┘
                                                              │ HTTP
                                                              │ JSON
                                                              ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                           后端 (Next.js API)                              │
│                                                                          │
│   ┌──────────────────┐    ┌──────────────────┐    ┌────────────────┐  │
│   │   API Routes    │───▶│   业务逻辑 (lib/) │───▶│ Prisma ORM     │  │
│   │ /api/ai/grade  │    │ gpt.ts/score-    │    │ PostgreSQL     │  │
│   │ /api/rubric    │    │ engine.ts        │    │                │  │
│   └──────────────────┘    └──────────────────┘    └────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 身份认证机制

### 2.1 请求头设计

前端通过 HTTP 请求头传递用户身份:

```typescript
// 前端 (proxyService.ts)
const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-device-id': getDeviceId(),           // 必需：设备 ID
    'x-activation-code': activationCode || '' // 可选：激活码
};
```

### 2.2 优先级

| 场景 | 标识方式 | 说明 |
|------|----------|------|
| 已激活用户 | `x-activation-code` | 跨设备同步，配额共享 |
| 匿名用户 | `x-device-id` | 本地存储，免费 10 次试用 |

### 2.3 设备 ID 生成

```typescript
// 前端 - 获取/生成设备 ID
function getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
}
```

---

## 3. 核心 API 交互

### 3.1 AI 评分流程

```
前端                                    后端
  │                                       │
  │ POST /api/ai/grade                   │
  │ {                                    │
  │   imageBase64: "...",                │
  │   rubric: "{...}",                   │──▶ 1. 验证设备 ID
  │   studentName: "张三",                │──▶ 2. 检查配额
  │   questionKey: "Q1",                 │──▶ 3. 调用 AI 判定
  │   strategy: "pro"                    │──▶ 4. 计算分数
  │ }                                    │──▶ 5. 扣减配额
  │◀─── {                                │──▶ 6. 保存记录
  │   success: true,                     │
  │   data: { score, breakdown, ... }   │
  │ }                                    │
```

#### 请求示例

```typescript
const response = await fetch(`${API_BASE_URL}/api/ai/grade`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-device-id': 'device_abc123',
        'x-activation-code': 'TEST-1111-2222-3333'
    },
    body: JSON.stringify({
        imageBase64: 'data:image/jpeg;base64,...',
        rubric: '{"version":"3.0",...}',
        studentName: '张三',
        questionNo: '第1题',
        questionKey: 'history_q1',
        strategy: 'pro'
    })
});
```

#### 响应格式

```typescript
{
    success: true,
    data: {
        score: 8,
        maxScore: 10,
        breakdown: [
            { label: "要点1", score: 3, max: 3, comment: "完整回答" },
            { label: "要点2", score: 2, max: 3, comment: "部分回答" },
            { label: "要点3", score: 3, max: 4, comment: "完整回答" }
        ],
        comment: "| 项目 | 得分 | 说明 |\n|---|---|---|...",
        provider: "gptsapi-judge",
        remaining: 299,
        totalUsed: 1
    },
    message: "批改完成"
}
```

### 3.2 后端处理逻辑

```typescript
// aigradingbackend/src/app/api/ai/grade/route.ts

// 1. 获取配额 (优先激活码，回退设备)
const quotaInfo = await getAvailableQuota(deviceId, activationCode);

// 2. AI 判定 (多 Provider 回退)
try {
    judge = await judgeWithGPT(...);     // GPT-4o (首选)
} catch {
    judge = await judgeWithZhipu(...);    // 智谱 GLM-4
}

// 3. 分数计算
const result = scoreRubric(rubricV3, judge.judge);

// 4. 扣减配额
await deductQuota(quotaInfo.id, quotaInfo.type, deviceId);
```

---

## 4. 评分细则同步

### 4.1 保存 Rubric

```typescript
// 前端
POST /api/rubric
{
    questionKey: "Q1",
    rubric: { ... },           // Rubric v3 JSON
    examId: "exam_123",
    lifecycleStatus: "draft"
}

// 响应 - 成功
{ success: true }

// 响应 - 冲突
{
    success: false,
    conflict: true,
    serverRubric: { ... },
    clientRubric: { ... }
}
```

### 4.2 加载 Rubric

```typescript
// GET /api/rubric?questionKey=Q1

// 响应
{
    success: true,
    rubric: {
        version: "3.0",
        metadata: { questionId: "Q1", title: "..." },
        strategyType: "point_accumulation",
        content: { points: [...] }
    }
}
```

### 4.3 加载所有 Rubric

```typescript
// GET /api/rubric 或 GET /api/rubric?examId=exam_123

// 响应
{
    success: true,
    rubrics: [
        { questionId: "Q1", title: "...", examId: "exam_123", lifecycleStatus: "draft" },
        { questionId: "Q2", title: "...", examId: "exam_123", lifecycleStatus: "published" }
    ]
}
```

---

## 5. 考试管理

### 5.1 API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/exams` | 获取考试列表 |
| POST | `/api/exams` | 创建考试 |
| PUT | `/api/exams/[id]` | 更新考试 |
| DELETE | `/api/exams/[id]` | 删除考试 |

### 5.2 请求示例

```typescript
// 创建考试
POST /api/exams
{
    name: "高三第一次月考",
    date: "2024-10-15",
    subject: "历史",
    grade: "高三"
}
```

---

## 6. 激活码管理

### 6.1 验证激活码

```typescript
// POST /api/activation/verify
{
    code: "TEST-1111-2222-3333",
    deviceId: "device_abc123"
}

// 响应
{
    success: true,
    data: {
        type: "trial",
        quota: 300,
        remaining: 299,
        expiresAt: null
    }
}
```

### 6.2 查询激活状态

```typescript
// GET /api/activation/verify?deviceId=xxx&code=xxx

// 响应
{
    data: {
        isPaid: true,
        code: "TEST-1111-2222-3333",
        type: "trial",
        quota: 300,
        remaining: 299,
        used: 1,
        status: "active"
    }
}
```

---

## 7. 配额系统

### 7.1 配额检查流程

```
┌─────────────────────────────────────────────┐
│           配额检查流程                        │
├─────────────────────────────────────────────┤
│                                             │
│  1. 检查激活码配额                           │
│     │                                       │
│     ▼                                       │
│  2. 如果无码/无效 → 设备免费配额 (10次)      │
│     │                                       │
│     ▼                                       │
│  3. 每次调用 deductQuota()                  │
│                                             │
│  4. 试用码用完 → 自动过期                    │
└─────────────────────────────────────────────┘
```

### 7.2 配额类型

| 类型 | 来源 | 配额 |
|------|------|------|
| 激活码 (trial) | 测试码 | 300 次，一次性 |
| 激活码 (basic) | 正式版 | 1000 次，可复用 |
| 激活码 (pro) | 专业版 | 3000 次，可复用 |
| 设备免费 | 匿名用户 | 10 次 |

---

## 8. 图片处理

### 8.1 前端压缩

在发送图片前进行压缩优化:

```typescript
// proxyService.ts - 图片压缩
const compressedImage = await compressImageBase64(imageBase64, {
    maxWidth: 1000,    // 限制宽度
    quality: 0.6,      // JPEG 60% 质量
    grayscale: true    // 转灰度
});
// 预计压缩 70-90%
```

### 8.2 压缩效果

| 原始图片 | 压缩后 | 压缩率 |
|----------|--------|--------|
| ~500KB | ~60KB | 88% |
| ~1MB | ~150KB | 85% |
| ~2MB | ~300KB | 85% |

---

## 9. v1 vs v2 API 对比

### 9.1 API 路径

| 功能 | v1 (aigradingfrontend) | v2 (grading-platform-v2) |
|------|------------------------|-------------------------|
| 评分 | `/api/ai/grade` | `/api/v2/gradings/evaluate` |
| 细则 | `/api/rubric` | `/api/v2/rubrics` |
| 考试 | `/api/exams` | `/api/v2/exams` |
| 记录 | - | `/api/v2/records` |
| 授权 | `/api/activation/verify` | `/api/v2/licenses/status` |

### 9.2 响应格式

| 版本 | 格式 |
|------|------|
| v1 | `{ success: boolean, data?: any, message?: string }` |
| v2 | `{ ok: boolean, data?: any }` 或 `{ ok: false, error: { code, message } }` |

### 9.3 Header 对比

**v1**:
```typescript
const headers = {
    'Content-Type': 'application/json',
    'x-device-id': getDeviceId(),
    'x-activation-code': getActivationCode() || ''
};
```

**v2**:
```typescript
const buildHeaders = (extraHeaders?: Record<string, string>): HeadersInit => {
    const headers = {
        "content-type": "application/json",
        "x-device-id": getDeviceId(),
    };
    const activationCode = getActivationCode();
    if (activationCode) {
        headers["x-activation-code"] = activationCode;
    }
    return { ...headers, ...extraHeaders };
};
```

---

## 10. 错误处理

### 10.1 常见错误码

| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| `INVALID_REQUEST` | 请求参数错误 | 400 |
| `QUOTA_EXHAUSTED` | 配额已用完 | 403 |
| `RUBRIC_FORMAT_INVALID` | Rubric 格式错误 | 400 |
| `AI_SERVICE_UNAVAILABLE` | AI 服务不可用 | 502 |
| `CONFLICT` | 数据冲突 | 409 |

### 10.2 前端错误处理

```typescript
try {
    const result = await gradeWithProxy(imageBase64, rubric);
    // 处理成功结果
} catch (error) {
    if (error.message.includes('配额')) {
        // 显示充值提示
    } else if (error.message.includes('超时')) {
        // 显示重试提示
    } else {
        // 显示通用错误
    }
}
```

---

## 11. 关键设计要点

1. **强制后端代理** - 所有 AI 调用必须经过后端，不支持前端直连
2. **设备 ID 必需** - 每个请求必须包含 `x-device-id`
3. **激活码可选** - 用于跨设备同步和配额共享
4. **配额预检查** - 评分前检查余额，不足则拒绝
5. **异步记录** - 批改记录异步保存，不阻塞响应
