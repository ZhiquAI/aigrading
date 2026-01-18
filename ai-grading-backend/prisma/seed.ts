import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 开始插入测试数据...');

    // 清空现有数据（可选）
    await prisma.activationRecord.deleteMany();
    await prisma.usageRecord.deleteMany();
    await prisma.deviceQuota.deleteMany();
    await prisma.activationCode.deleteMany();

    // 创建测试激活码
    const codes = [
        {
            code: 'TEST-1111-2222-3333',
            type: 'trial',
            quota: 300,
            reusable: false,  // 试用码：一次性
            maxDevices: 1,
            status: 'active',
        },
        {
            code: 'BASIC-AAAA-BBBB-CCCC',
            type: 'basic',
            quota: 1000,
            reusable: true,   // 付费码：可重复
            maxDevices: 999,
            status: 'active',
        },
        {
            code: 'PRO-XXXX-YYYY-ZZZZ',
            type: 'pro',
            quota: 3000,
            reusable: true,   // 付费码：可重复
            maxDevices: 999,
            status: 'active',
        },
        {
            code: 'PERM-AAAA-BBBB-CCCC',
            type: 'permanent',
            quota: 999999,
            reusable: true,
            maxDevices: 999,
            status: 'active',
        },
    ];

    for (const codeData of codes) {
        const code = await prisma.activationCode.create({
            data: codeData
        });
        console.log(`✅ 创建激活码: ${code.code} (${code.type}, ${code.quota}次)`);
    }

    console.log('✨ 测试数据插入完成！');
    console.log('\n可用的测试激活码:');
    console.log('  - TEST-1111-2222-3333 (试用码, 300次, 一次性)');
    console.log('  - BASIC-AAAA-BBBB-CCCC (基础码, 1000次, 可重复)');
    console.log('  - PRO-XXXX-YYYY-ZZZZ (专业码, 3000次, 可重复)');
    console.log('  - PERM-AAAA-BBBB-CCCC (永久码, 999999次, 可重复)');
}

main()
    .catch((e) => {
        console.error('❌ 插入数据失败:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
