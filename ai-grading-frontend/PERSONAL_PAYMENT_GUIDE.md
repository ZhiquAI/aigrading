# 个人收款码 + 激活码使用指南

## 快速开始

### 1. 准备收款码

将你的微信和支付宝收款码保存为图片:
- `/public/images/wechat-qr.png` - 微信收款码
- `/public/images/alipay-qr.png` - 支付宝收款码

### 2. 修改联系方式

编辑 `components/PurchasePage.tsx`,替换:
```typescript
<p>🤝 客服微信: <strong>your-wechat-id</strong></p>
<p>📧 客服邮箱: <strong>support@example.com</strong></p>
```

### 3. 创建激活码表

```sql
CREATE TABLE activation_codes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL,
    quota INT NOT NULL COMMENT '-1表示无限',
    validity_days INT NOT NULL COMMENT '-1表示永久',
    status ENUM('unused', 'used', 'expired') DEFAULT 'unused',
    used_by BIGINT NULL,
    used_at TIMESTAMP NULL,
    generated_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. 生成激活码

```bash
# 安装依赖
npm install mysql2

# 生成激活码
node scripts/generate-code.js basic 10

# 输出:
# ✅ 1. A3K9-HN2P-X7F4-M8WQ
# ✅ 2. B7M2-Y4NP-K9R3-L6TH
# ...
# 💾 已保存到: codes_basic_1737172800000.txt
```

---

## 日常使用流程

### 用户购买

1. 用户扫码转账 ¥19.9
2. 用户添加你的微信,发送截图
3. 你生成激活码: `node scripts/generate-code.js basic 1`
4. 复制激活码发给用户
5. 用户输入激活码,自动充值 ✅

### 批量处理

如果有多个用户:
```bash
# 一次生成 50 个基础版激活码
node scripts/generate-code.js basic 50

# 根据订单逐个发送给用户
```

---

## 套餐定价建议

| 套餐 | 额度 | 建议价格 | 成本 | 利润 |
|------|------|----------|------|------|
| 基础版 | 1000次 | ¥19.9 | ~¥2 | ¥18 |
| 专业版 | 3000次 | ¥49.9 | ~¥6 | ¥44 |
| 永久版 | 无限 | ¥99 | ~¥0 | ¥99 |

*成本估算基于 Gemini API 调用费用*

---

## FAQ

### Q: 激活码文件丢了怎么办?
A: 数据库中有记录,可以查询:
```sql
SELECT code FROM activation_codes 
WHERE status = 'unused' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Q: 如何查看已使用的激活码?
A: 
```sql
SELECT ac.code, ac.used_at, u.email 
FROM activation_codes ac
LEFT JOIN users u ON ac.used_by = u.id
WHERE ac.status = 'used'
ORDER BY ac.used_at DESC;
```

### Q: 激活码重复了怎么办?
A: MD5哈希概率极低,如果出现,重新生成一个即可。

---

## 自动化建议 (可选)

如果用户量大,可以考虑:
1. 创建简单的后台管理页面
2. 一键生成 + 复制激活码
3. 查看激活记录
4. 统计销售数据

需要的话我可以帮你实现! 🚀
