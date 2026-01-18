/**
 * 激活码生成工具
 * 用法: node scripts/generate-code.js <type> <count>
 * 示例: node scripts/generate-code.js basic 10
 */

const crypto = require('crypto');
const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'grading_db'
};

// 套餐配置
const packages = {
    trial: { quota: 300, validity: 30, name: '体验版' },
    basic: { quota: 1000, validity: 90, name: '基础版' },
    pro: { quota: 3000, validity: 180, name: '专业版' },
    unlimited: { quota: -1, validity: -1, name: '永久版' }
};

/**
 * 生成激活码 (16位,带校验位)
 */
function generateActivationCode() {
    // 去除易混淆字符: 0OI1l
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';

    // 生成15位随机字符
    for (let i = 0; i < 15; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }

    // 添加校验位
    const hash = crypto.createHash('md5').update(code).digest('hex');
    code += hash[0].toUpperCase();

    // 格式化为 XXXX-XXXX-XXXX-XXXX
    return code.match(/.{1,4}/g).join('-');
}

/**
 * 主函数
 */
async function main() {
    const args = process.argv.slice(2);
    const type = args[0];
    const count = parseInt(args[1]) || 1;

    if (!type || !packages[type]) {
        console.error('❌ 用法: node generate-code.js <type> <count>');
        console.error('可用类型:', Object.keys(packages).join(', '));
        process.exit(1);
    }

    const pkg = packages[type];
    console.log(`\n🎫 生成 ${pkg.name} 激活码 x ${count}`);
    console.log(`📊 额度: ${pkg.quota === -1 ? '无限' : pkg.quota}次`);
    console.log(`⏰ 有效期: ${pkg.validity === -1 ? '永久' : pkg.validity + '天'}\n`);

    const connection = await mysql.createConnection(dbConfig);

    try {
        const codes = [];

        for (let i = 0; i < count; i++) {
            const code = generateActivationCode();

            await connection.execute(
                `INSERT INTO activation_codes 
                 (code, type, quota, validity_days, status, generated_by, created_at) 
                 VALUES (?, ?, ?, ?, 'unused', 'admin', NOW())`,
                [code, type, pkg.quota, pkg.validity]
            );

            codes.push(code);
            console.log(`✅ ${i + 1}. ${code}`);
        }

        console.log(`\n🎉 成功生成 ${codes.length} 个激活码!\n`);

        // 保存到文件
        const fs = require('fs');
        const filename = `codes_${type}_${Date.now()}.txt`;
        fs.writeFileSync(
            filename,
            codes.join('\n') + '\n\n' +
            `类型: ${pkg.name}\n` +
            `额度: ${pkg.quota === -1 ? '无限' : pkg.quota}次\n` +
            `有效期: ${pkg.validity === -1 ? '永久' : pkg.validity + '天'}\n` +
            `生成时间: ${new Date().toLocaleString()}\n`
        );

        console.log(`💾 已保存到文件: ${filename}\n`);

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await connection.end();
    }
}

main();
