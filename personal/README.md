# 智阅AI 个人版

纯前端 AI 智能阅卷助手，无需后端服务，数据存储在本地。

## 特点

- ✅ **纯前端** - 无需搭建后端服务
- ✅ **免费使用** - 使用自己的 AI API Key
- ✅ **本地存储** - 数据保存在浏览器本地
- ✅ **支持多平台** - 智学网、好分数

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建扩展

```bash
npm run build
```

### 3. 安装到 Chrome

1. 打开 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `dist` 文件夹

### 4. 配置 API Key

首次使用时，在「设置」中配置你的 AI API Key：

- **Gemini**: [获取 API Key](https://aistudio.google.com/app/apikey)
- **智谱**: [获取 API Key](https://open.bigmodel.cn/)
- **阿里云**: [获取 API Key](https://dashscope.console.aliyun.com/)

## 与企业版的区别

| 功能 | 个人版 | 企业版 |
|------|--------|--------|
| AI 调用 | 使用自己的 Key | 后端代理 |
| 数据存储 | 本地浏览器 | 云端同步 |
| 配额管理 | 无 | 激活码配额 |
| 多设备 | 不同步 | 自动同步 |
| 适用场景 | 个人使用 | 学校部署 |

## 开发

```bash
# 开发模式
npm run dev

# 构建
npm run build
```
