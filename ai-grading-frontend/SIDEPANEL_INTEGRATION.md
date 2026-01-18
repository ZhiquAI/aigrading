# Chrome Sidepanel 插件集成指南

## 📐 Sidepanel 尺寸规格

Chrome Sidepanel 标准尺寸:
- **宽度**: 400-500px (固定，用户可调整)
- **高度**: 浏览器窗口高度
- **特点**: 垂直布局，窄屏优化

---

## 🎨 UI 组件适配

### 已优化的组件

1. **ActivationModal** - 激活码输入框
   - ✅ 宽度自适应
   - ✅ 内边距减小
   - ✅ 字体缩小

2. **QuotaDisplay** - 额度显示
   - ✅ 移除最小宽度限制
   - ✅ 数字大小优化

3. **PurchasePage** - 购买页面
   - ✅ 单列布局
   - ✅ 卡片自适应

---

## 🔌 集成到插件

### Step 1: 在主应用中引入组件

```typescript
// App.tsx 或主组件文件
import QuotaDisplay from './components/QuotaDisplay';
import ActivationModal from './components/ActivationModal';
import { useState } from 'react';

export default function App() {
    const [showActivation, setShowActivation] = useState(false);

    return (
        <div className="app">
            {/* 顶部额度显示 */}
            <QuotaDisplay 
                onPurchaseClick={() => {/* 跳转购买页 */}}
                onActivateClick={() => setShowActivation(true)}
            />

            {/* 主要内容 */}
            <YourMainContent />

            {/* 激活码弹窗 */}
            {showActivation && (
                <ActivationModal 
                    onSuccess={() => {
                        setShowActivation(false);
                        // 刷新额度
                    }}
                    onClose={() => setShowActivation(false)}
                />
            )}
        </div>
    );
}
```

### Step 2: 添加额度拦截逻辑

```typescript
// 在批改功能中
import { checkQuota, consumeQuota } from './services/cloudbaseService';
import { getDeviceId } from './utils/device';

async function handleGrade(imageData: string, rubric: any) {
    const deviceId = getDeviceId();
    
    // 1. 验证额度
    const quotaResult = await checkQuota(deviceId);
    if (!quotaResult.canUse) {
        // 显示购买引导
        showPurchaseModal();
        throw new Error(quotaResult.message);
    }
    
    // 2. 执行批改
    const result = await gradeAnswer(imageData, rubric);
    
    // 3. 扣减额度
    consumeQuota(deviceId).catch(console.error);
    
    return result;
}
```

### Step 3: 测试窄屏适配

```bash
# 访问测试页面
http://localhost:3001/test-payment.html

# 浏览器中按 F12，切换到移动设备模式
# 设置宽度: 400px
# 测试所有组件
```

---

## 📊 推荐布局

```
┌─────────────────────┐
│   QuotaDisplay      │  ← 顶部固定
│   300 / 1000        │
├─────────────────────┤
│                     │
│   主要内容区        │  ← 滚动区域
│   (批改界面)        │
│                     │
│                     │
└─────────────────────┘
```

---

## ⚙️ 推荐配置

在设置页面添加"购买额度"入口:

```typescript
<SettingsItem
    icon="🎫"
    title="我的额度"
    subtitle={`剩余 ${quota.remaining} 次`}
    onClick={() => setShowActivation(true)}
/>
```

---

## 测试清单

- [ ] 宽度 400px 下组件正常显示
- [ ] 激活码输入框适配窄屏
- [ ] 额度显示清晰可见
- [ ] 购买页面在 sidepanel 中可用
- [ ] 所有按钮可点击（不溢出）

---

测试页面已优化为 450px 宽度，模拟真实 sidepanel 环境！🚀
