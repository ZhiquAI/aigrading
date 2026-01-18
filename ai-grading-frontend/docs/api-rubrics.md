# 评分细则后端 API 规范

## 概述

评分细则 API 采用 RESTful 设计，支持 CRUD 操作和 AI 生成。

**Base URL**: `http://localhost:3000`

---

## 认证

所有请求需携带以下 Header：

| Header | 说明 |
|--------|------|
| `x-device-id` | 设备唯一标识，用于区分不同客户端 |

---

## 数据格式

### RubricJSON v2

```typescript
interface RubricJSON {
    version: "2.0";
    questionId: string;         // 如 "18-2"
    title: string;              // 如 "影响分析"
    totalScore: number;
    createdAt: string;          // ISO 8601
    updatedAt: string;          // ISO 8601
    scoringStrategy: {
        type: "pick_n" | "all" | "weighted";
        maxPoints?: number;
        pointValue?: number;
        allowAlternative: boolean;
        strictMode: boolean;
    };
    answerPoints: Array<{
        id: string;
        content: string;
        keywords: string[];
        requiredKeywords?: string[];
        score: number;
        deductionRules?: string;
    }>;
    gradingNotes: string[];
    alternativeRules?: string;
}
```

---

## API 端点

### 1. 获取评分细则列表

**GET** `/api/rubrics`

#### Response

```json
{
    "success": true,
    "rubrics": [
        {
            "questionId": "18-2",
            "title": "影响分析",
            "totalScore": 6,
            "pointCount": 5,
            "updatedAt": "2026-01-16T00:00:00.000Z"
        }
    ]
}
```

---

### 2. 获取单个评分细则

**GET** `/api/rubrics/:questionId`

#### Response

```json
{
    "success": true,
    "rubric": { /* RubricJSON */ }
}
```

#### Error (404)

```json
{
    "success": false,
    "error": "评分细则不存在"
}
```

---

### 3. 保存评分细则

**POST** `/api/rubrics`

#### Request Body

```json
{
    /* RubricJSON */
}
```

#### Response

```json
{
    "success": true,
    "rubric": { /* RubricJSON with updatedAt */ }
}
```

#### 冲突处理

如果后端已有更新版本（`updatedAt` 更新），返回 409：

```json
{
    "success": false,
    "error": "conflict",
    "serverRubric": { /* 服务器版本 */ },
    "clientRubric": { /* 客户端版本 */ }
}
```

---

### 4. 删除评分细则

**DELETE** `/api/rubrics/:questionId`

#### Response

```json
{
    "success": true
}
```

---

### 5. AI 生成评分细则

**POST** `/api/ai/rubric/generate`

#### Request Body

```json
{
    "questionImage": "base64...",   // 可选
    "answerImage": "base64...",     // 可选，至少提供一个
    "questionId": "18-2",           // 可选
    "outputFormat": "json"          // 固定为 json
}
```

#### Response

```json
{
    "success": true,
    "rubric": { /* RubricJSON */ },
    "provider": "gemini"            // 使用的 AI 提供商
}
```

---

### 6. AI 优化评分细则

**POST** `/api/ai/rubric/refine`

#### Request Body

```json
{
    "currentRubric": { /* RubricJSON */ },
    "suggestion": "用户的修改建议",
    "outputFormat": "json"
}
```

#### Response

```json
{
    "success": true,
    "rubric": { /* 优化后的 RubricJSON */ }
}
```

---

## 错误响应

### 标准错误格式

```json
{
    "success": false,
    "error": "错误描述",
    "code": "ERROR_CODE"    // 可选
}
```

### 错误码

| HTTP Status | Code | 说明 |
|-------------|------|------|
| 400 | `INVALID_REQUEST` | 请求参数无效 |
| 401 | `UNAUTHORIZED` | 未授权 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `CONFLICT` | 版本冲突 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |
| 503 | `AI_UNAVAILABLE` | AI 服务不可用 |

---

## 实现建议

### 后端存储

建议使用 JSON 文件存储（简单场景）或 SQLite（需要查询）：

```
/data/rubrics/
  ├── 18-2.json
  ├── 19-1.json
  └── 19-2.json
```

### 冲突解决

1. 比较 `updatedAt` 时间戳
2. 如果服务器版本更新，返回 409 让客户端决定
3. 客户端可选择：覆盖 / 合并 / 保留服务器版本
