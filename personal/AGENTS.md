# AGENTS.md - AI 智能批改助手开发指南

本文档为 AI 代理在此代码库中工作提供全面的开发指南和最佳实践。

## 📋 项目概述

这是一个基于 React + TypeScript 的 AI 智能批改助手 Chrome 扩展，支持智学网、好分数等主流阅卷平台的 AI 辅助批改。

### 技术栈
- **前端**: React 19.2.0 + TypeScript 5.8.2
- **构建工具**: Vite 6.2.0
- **样式**: Tailwind CSS 4.1.17
- **状态管理**: Zustand 5.0.9
- **测试**: Vitest 4.0.16 + jsdom
- **AI 集成**: @google/genai, OpenAI, 智谱 AI

## 🚀 命令行工具

### 开发命令
```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run preview      # 预览构建结果
```

### 测试命令
```bash
npm run test         # 运行所有测试
npm run test:watch   # 监听模式运行测试
npm run test -- --coverage                # 查看测试覆盖率
npm run test -- path/to/file.test.ts     # 运行单个测试文件
```

### Chrome 扩展开发
```bash
# 构建后加载到 Chrome 扩展程序
# chrome://extensions/ -> 加载已解压的扩展程序 -> 选择 ./dist 目录
```

## 🎨 代码风格指南

### 文件和目录结构
```
src/
├── components/          # React 组件
│   ├── grading/         # 批改相关组件
│   ├── history/         # 历史记录组件
│   └── ui/              # 通用 UI 组件
├── services/            # 业务逻辑服务层
├── stores/              # Zustand 状态管理
├── hooks/               # 自定义 React Hooks
├── utils/               # 工具函数
├── types.ts             # 全局类型定义
└── contexts/            # React Context
```

### 命名约定
- **组件**: PascalCase (例: `GradingView`, `HistoryCard`)
- **文件**: kebab-case for folders, PascalCase for components
- **函数/变量**: camelCase (例: `handleSaveRubric`, `currentQuestionKey`)
- **常量**: UPPER_SNAKE_CASE (例: `DEFAULT_CONFIG`, `STORAGE_KEY_CONFIG`)
- **接口/类型**: PascalCase (例: `StudentResult`, `PageContext`)

### 导入顺序
```typescript
// 1. React 相关
import React, { useState, useEffect } from 'react';

// 2. 第三方库
import { PenTool, BarChart3 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

// 3. 内部模块 (按层级排序)
import { AppProvider } from './contexts/AppContext';
import { storage } from './utils/storage';
import { toast } from './components/Toast';
import { StudentResult, Tab } from './types';
```

### TypeScript 规范
- **严格类型**: 所有函数参数和返回值必须有类型注解
- **接口优先**: 使用 `interface` 而非 `type` (除非需要联合类型)
- **枚举使用**: 对于固定选项使用 `enum` (例: `Tab`, `GradingMode`, `ModelProvider`)
- **泛型**: 合理使用泛型提高代码复用性

```typescript
// ✅ 好的示例
export interface AppConfig {
  provider: ModelProviderType;
  endpoint: string;
  modelName: string;
  apiKey: string;
}

export const getAppConfig = (): AppConfig => {
  // 实现
};

// ❌ 避免使用 any
const processData = (data: any) => {
  // 改为明确类型
};
```

## 🧪 测试规范

### 测试文件结构
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { functionName } from '../path/to/module';

// Mock 设置
vi.mock('../path/to/dependency');

describe('模块名', () => {
  beforeEach(() => {
    // 测试前重置
  });

  describe('功能分组', () => {
    it('应该实现预期行为', async () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = await functionName(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Mock 最佳实践
- **Chrome API**: 使用 `vi.stubGlobal('chrome', mockChrome)`
- **LocalStorage**: 使用 `vi.stubGlobal('localStorage', mockLocalStorage)`
- **异步函数**: 使用 `vi.fn().mockResolvedValue(value)`
- **外部服务**: 统一在测试文件顶部 Mock

## 🎯 组件开发规范

### React 组件模板
```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { IconComponent } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { toast } from './Toast';

interface ComponentProps {
  requiredProp: string;
  optionalProp?: number;
  onEvent?: (data: any) => void;
}

const Component: React.FC<ComponentProps> = ({
  requiredProp,
  optionalProp = 0,
  onEvent
}) => {
  const [state, setState] = useState<Type>(initialValue);
  const { storeValue, setStoreValue } = useAppStore();
  
  const handleAction = useCallback(async () => {
    try {
      // 业务逻辑
      onEvent?.(result);
    } catch (error) {
      toast.error('操作失败');
      console.error('[Component] Action failed:', error);
    }
  }, [onEvent]);

  return (
    <div className="flex flex-col space-y-4">
      {/* JSX 内容 */}
    </div>
  );
};

export default Component;
```

### 样式规范
- **Tailwind 优先**: 使用 Tailwind CSS 类而非内联样式
- **响应式**: 使用 `sm:`, `md:`, `lg:` 前缀
- **深色模式**: 使用 `dark:` 前缀配合 `darkMode: 'class'`
- **组件样式**: 避免过度自定义，优先使用 Tailwind 原子类

## 🔧 服务层开发

### 服务模块模板
```typescript
import { TypeFromTypes } from '../types';
import { storage } from '../utils/storage';

const STORAGE_KEY = 'module_config';
const DEFAULT_CONFIG = { /* 默认值 */ };

export const functionName = async (param: Type): Promise<ReturnType> => {
  try {
    const result = await operation(param);
    return result;
  } catch (error) {
    console.error('[ModuleName] Operation failed:', error);
    throw new Error('操作失败');
  }
};

export const getConfig = async (): Promise<ConfigType> => {
  const saved = await storage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
};
```

## 🔒 错误处理和安全

### 错误处理模式
```typescript
export const safeOperation = async () => {
  try {
    const result = await riskyOperation();
    return { success: true, data: result };
  } catch (error) {
    console.error('[Module] Operation failed:', error);
    return { success: false, error: error.message };
  }
};
```

### 安全最佳实践
- **API Key 加密**: 使用 `utils/crypto.ts` 中的 `encrypt/decrypt` 函数
- **数据验证**: 对外部输入进行类型检查和验证
- **敏感信息**: 避免在日志中输出敏感数据
- **Chrome 存储**: 优先使用 `chrome.storage.local` 而非 `localStorage`

## 📊 性能优化

### React 性能
- **懒加载**: 使用 `React.lazy()` 和 `Suspense` 按需加载组件
- **useCallback/useMemo**: 对复杂计算和回调函数进行记忆化
- **虚拟滚动**: 使用 `@tanstack/react-virtual` 处理长列表
- **状态管理**: 避免不必要的重渲染，合理拆分状态

### 代码分割
```typescript
const GradingView = lazy(() => import('./components/GradingView'));
const HistoryView = lazy(() => import('./components/HistoryView'));

<Suspense fallback={<LoadingFallback />}>
  <GradingView />
</Suspense>
```

## 🔄 Git 工作流

### 提交信息规范
```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 构建过程或辅助工具的变动
```

### 分支策略
- `main`: 生产环境代码
- `develop`: 开发环境代码
- `feature/*`: 功能分支
- `hotfix/*`: 紧急修复分支

## 📝 调试和日志

### 日志规范
```typescript
console.log('[ModuleName] 操作描述:', data);
console.warn('[ModuleName] 警告信息:', warning);
console.error('[ModuleName] 错误信息:', error);

if (process.env.NODE_ENV === 'development') {
  console.log('[Debug] 详细信息:', debugData);
}
```

### Chrome 扩展调试
- **Background Script**: 在 chrome://extensions/ 中点击"背景页"
- **Content Script**: 在目标页面的 DevTools 中调试
- **Side Panel**: 在扩展弹窗中右键检查元素

## 🎨 UI/UX 指南

### 设计系统
- **颜色**: 使用 Tailwind 的颜色变量，支持深色模式
- **间距**: 使用 `space-y-*`, `gap-*` 等原子类
- **圆角**: 统一使用 `rounded-lg` (8px)
- **阴影**: 使用 `shadow-sm`, `shadow-md` 等预设阴影

### 交互规范
- **加载状态**: 使用 `<Loader2 className="animate-spin" />`
- **错误提示**: 使用 `toast.error()` 显示错误信息
- **成功反馈**: 使用 `toast.success()` 显示成功信息
- **确认操作**: 危险操作需要用户二次确认

## 🧪 开发工具推荐

### VS Code 扩展
- **TypeScript Importer**: 自动导入类型
- **Tailwind CSS IntelliSense**: Tailwind 类名提示
- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化

### 浏览器工具
- **React Developer Tools**: React 组件调试
- **Chrome DevTools**: 常规调试和性能分析
- **Lighthouse**: 性能和可访问性检查

---

**注意**: 在此代码库中工作时，请始终遵循上述指南。如有疑问，优先参考现有代码的实现模式。