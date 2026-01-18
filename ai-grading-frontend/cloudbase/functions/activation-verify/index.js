const cloud = require('@cloudbase/node-sdk');
const app = cloud.init({ env: cloud.SYMBOL_CURRENT_ENV });
const db = app.database();
const _ = db.command;

/**
 * 激活码验证云函数
 * 验证激活码并充值额度
 */
exports.main = async (event) => {
    const { code, deviceId } = event;

    if (!code || !deviceId) {
        return {
            success: false,
            message: '激活码和设备ID不能为空'
        };
    }

    // 格式化激活码（去空格，转大写）
    const formattedCode = code.replace(/\s/g, '').toUpperCase();

    try {
        // 查询激活码
        const { data: codes } = await db.collection('activation_codes')
            .where({
                code: formattedCode,
                status: 'unused'
            })
            .get();

        if (codes.length === 0) {
            return {
                success: false,
                message: '激活码无效或已使用'
            };
        }

        const activation = codes[0];

        // 检查激活码是否过期
        if (activation.expires_at && new Date(activation.expires_at) < new Date()) {
            // 标记为过期
            await db.collection('activation_codes')
                .doc(activation._id)
                .update({ status: 'expired' });

            return {
                success: false,
                message: '激活码已过期'
            };
        }

        // 开始事务
        const transaction = await db.startTransaction();

        try {
            // 1. 标记激活码为已使用
            await transaction.collection('activation_codes')
                .doc(activation._id)
                .update({
                    status: 'used',
                    used_at: new Date(),
                    used_by: deviceId
                });

            // 2. 查询设备是否已有额度
            const { data: quotas } = await transaction.collection('user_quotas')
                .where({ device_id: deviceId })
                .get();

            if (quotas.length === 0) {
                // 新设备，创建额度记录
                const expiresAt = activation.validity_days > 0
                    ? new Date(Date.now() + activation.validity_days * 24 * 60 * 60 * 1000)
                    : null;

                await transaction.collection('user_quotas').add({
                    device_id: deviceId,
                    remaining: activation.quota,
                    total: activation.quota,
                    used: 0,
                    activation_type: activation.type,
                    created_at: new Date(),
                    updated_at: new Date(),
                    expires_at: expiresAt
                });
            } else {
                // 已有额度，累加充值
                const quota = quotas[0];
                const newExpiry = activation.validity_days > 0
                    ? new Date(Date.now() + activation.validity_days * 24 * 60 * 60 * 1000)
                    : null;

                await transaction.collection('user_quotas')
                    .doc(quota._id)
                    .update({
                        remaining: _.inc(activation.quota),
                        total: _.inc(activation.quota),
                        activation_type: activation.type,
                        updated_at: new Date(),
                        expires_at: newExpiry || quota.expires_at
                    });
            }

            // 提交事务
            await transaction.commit();

            return {
                success: true,
                message: '激活成功！',
                quota: activation.quota,
                type: activation.type
            };

        } catch (error) {
            // 回滚事务
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error('[activation-verify] Error:', error);
        return {
            success: false,
            message: '激活失败: ' + error.message
        };
    }
};
